// backend/src/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

const serverRoutes = require('./routes/servers');
const channelRoutes = require('./routes/channels');
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const setupSocketHandlers = require('./sockets');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./middleware/logger');
// PeerJS sunucu başlatıcıyı import et
const { startPeerServer } = require('./peerServer'); 

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(logger);

// Routes
app.use('/api/servers', serverRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);

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

  // PeerJS server'ı başlat
  startPeerServer();
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});