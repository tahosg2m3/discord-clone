const { PeerServer } = require('peer');

const startPeerServer = () => {
  const configuredPort = Number(process.env.PEER_PORT || 9000);
  const port = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65535
    ? configuredPort
    : 9000;
  const peerServer = PeerServer({
    port,
    path: '/peerjs',
    // Peer kimlikleri yalnızca doğrulanmış Socket.IO ses katılımcılarından
    // öğrenilir; genel PeerJS discovery saldırı yüzeyini gereksiz büyütür.
    allow_discovery: false,
  });

  peerServer.on('connection', (client) => {
    console.log(`🎤 Peer connected: ${client.getId()}`);
  });

  peerServer.on('disconnect', (client) => {
    console.log(`👋 Peer disconnected: ${client.getId()}`);
  });

  console.log(`📡 PeerJS server running on port ${port}`);
};

module.exports = { startPeerServer };
