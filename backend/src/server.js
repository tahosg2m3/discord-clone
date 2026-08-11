// backend/src/server.js - KOMPLE GÜNCEL VERSİYON
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Route/middleware modülleri yüklenmeden önce .env'i oku; JWT ve APP_DATA_DIR
// gibi güvenlik/persist ayarları modül yüklenirken kullanılır.
dotenv.config();

const storage = require('./storage/inMemory');

const serverRoutes = require('./routes/servers');
const roleRoutes = require('./routes/roles');
const channelRoutes = require('./routes/channels');
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const dmRoutes = require('./routes/dm');
const friendRoutes = require('./routes/friends');
const uploadRoutes = require('./routes/upload');
const platformRoutes = require('./routes/platform');

const setupSocketHandlers = require('./sockets');
const { startPeerServer } = require('./peerServer');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./middleware/logger');

const app = express();
const server = http.createServer(app);
const uploadsDirectory = process.env.APP_DATA_DIR
  ? path.join(path.resolve(process.env.APP_DATA_DIR), 'uploads')
  : path.join(__dirname, '../uploads');

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 10e6, // 10MB for file uploads
});

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(logger);

// Static files for uploads
app.use('/uploads', express.static(uploadsDirectory));

// Routes
app.use('/api/servers', serverRoutes);
app.use('/api/servers', roleRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dm', dmRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/upload', uploadRoutes);
// Yeni Discord-benzeri özellikler tam API yollarını kendi router'ında tanımlar.
// Eski endpoint'ler yukarıda kalır ve geriye dönük uyumluluğunu korur.
app.use('/api', platformRoutes);

app.get('/health', (req, res) => {
  if (process.env.DESKTOP_INSTANCE_TOKEN) {
    res.set('X-Discord-Clone-Instance', process.env.DESKTOP_INSTANCE_TOKEN);
  }
  const peerReady = Boolean(peerServerController?.isReady());
  res.status(peerReady ? 200 : 503).json({
    status: peerReady ? 'ok' : (peerServerController?.startupError ? 'error' : 'starting'),
    services: { api: 'ok', peer: peerReady ? 'ok' : 'unavailable' },
    timestamp: new Date().toISOString(),
  });
});

setupSocketHandlers(io);
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
const HOST = String(process.env.HOST || '127.0.0.1').trim() || '127.0.0.1';
let peerServerController = null;

server.once('error', error => {
  console.error(`HTTP server could not start: ${error.message}`);
  storage.close();
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🌐 CORS enabled for ${process.env.CLIENT_URL || 'http://localhost:5173'}`);

  peerServerController = startPeerServer();
});

let isShuttingDown = false;

function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`${signal} signal received: closing HTTP server`);

  // Debounce edilmiş son yazıyı bağlantıları kapatmadan önce diske bas.
  // Paketli Electron, Windows'ta da çalışan IPC kapanış mesajını kullanır.
  storage.flush();

  let pendingServers = 2;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    storage.close();
    console.log('HTTP and PeerJS servers closed');
    process.exit(0);
  };
  const markServerClosed = () => {
    pendingServers -= 1;
    if (pendingServers <= 0) finish();
  };

  try {
    io.close(() => {
      if (!server.listening) {
        markServerClosed();
        return;
      }

      server.close(markServerClosed);
      server.closeIdleConnections?.();
    });
  } catch (_) {
    if (server.listening) server.close(markServerClosed);
    else markServerClosed();
  }

  if (peerServerController) peerServerController.close(markServerClosed);
  else markServerClosed();

  setTimeout(() => {
    if (finished) return;
    storage.close();
    process.exit(1);
  }, 10_000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('message', message => {
  if (message?.type === 'discord-clone:shutdown') shutdown('IPC');
});
process.parentPort?.once('message', event => {
  if (event?.data?.type === 'discord-clone:shutdown') shutdown('IPC');
});

app.set('io', io);
