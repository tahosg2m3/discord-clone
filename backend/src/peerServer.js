const { PeerServer } = require('peer');

const startPeerServer = () => {
  const peerServer = PeerServer({
    port: 9000,
    path: '/peerjs',
    allow_discovery: true,
  });

  peerServer.on('connection', (client) => {
    console.log(`🎤 Peer connected: ${client.getId()}`);
  });

  peerServer.on('disconnect', (client) => {
    console.log(`👋 Peer disconnected: ${client.getId()}`);
  });

  console.log('📡 PeerJS server running on port 9000');
};

module.exports = { startPeerServer };
