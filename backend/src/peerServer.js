const express = require('express');
const http = require('http');
const { ExpressPeerServer } = require('peer');

function normalizePort(value, fallback) {
  const port = Number(value || fallback);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
}

function createPeerCorsOrigin() {
  const configuredOrigins = String(process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  return (origin, callback) => {
    // Non-browser health checks have no Origin header. Browser clients must
    // come from an explicitly configured renderer origin.
    if (!origin || configuredOrigins.includes(origin)) callback(null, true);
    else callback(new Error('PeerJS origin is not allowed.'));
  };
}

const startPeerServer = () => {
  const port = normalizePort(process.env.PEER_PORT, 9000);
  const host = String(process.env.PEER_HOST || process.env.HOST || '127.0.0.1').trim() || '127.0.0.1';
  const app = express();
  const httpServer = http.createServer(app);
  const connectedClients = new Set();
  const controller = {
    ready: false,
    startupError: null,
    isReady() {
      return this.ready && httpServer.listening && !this.startupError;
    },
    close(callback) {
      this.ready = false;
      connectedClients.forEach(client => {
        try {
          client.getSocket()?.close();
        } catch (_) {
          // A peer may already be disconnecting; shutdown remains best effort.
        }
      });
      connectedClients.clear();

      if (!httpServer.listening) {
        callback?.();
        return;
      }

      httpServer.close(callback);
      httpServer.closeIdleConnections?.();
    },
  };
  const peerServer = ExpressPeerServer(httpServer, {
    path: '/peerjs',
    allow_discovery: false,
    corsOptions: {
      origin: createPeerCorsOrigin(),
      methods: ['GET', 'POST', 'OPTIONS'],
    },
  });

  app.use(peerServer);

  peerServer.on('connection', client => {
    connectedClients.add(client);
    console.log(`🎤 Peer connected: ${client.getId()}`);
  });

  peerServer.on('disconnect', client => {
    connectedClients.delete(client);
    console.log(`👋 Peer disconnected: ${client.getId()}`);
  });

  peerServer.on('error', error => {
    console.error('PeerJS connection error:', error.message);
  });

  httpServer.once('error', error => {
    controller.startupError = error;
    controller.ready = false;
    console.error(`PeerJS server error: ${error.message}`);
  });

  httpServer.listen(port, host, () => {
    controller.ready = true;
    console.log(`📡 PeerJS server running on http://${host}:${port}/peerjs`);
  });
  httpServer.once('close', () => {
    controller.ready = false;
  });

  return controller;
};

module.exports = { startPeerServer };
