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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

setupSocketHandlers(io);
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🌐 CORS enabled for ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
  
  startPeerServer();
});

let isShuttingDown = false;

function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`${signal} signal received: closing HTTP server`);

  // Debounce edilmiş son yazıyı sunucu bağlantılarını kapatmadan önce diske
  // bas. Electron bu sürece SIGTERM gönderdiğinde de aynı yol çalışır.
  storage.flush();

  const finish = () => {
    storage.close();
    console.log('HTTP server closed');
    process.exit(0);
  };

  io.close(() => server.close(finish));
  setTimeout(() => {
    storage.close();
    process.exit(1);
  }, 10_000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

app.set('io', io);
