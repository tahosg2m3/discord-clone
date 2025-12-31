const messageHandler = require('./handlers/messageHandler');
const userHandler = require('./handlers/userHandler');
const typingHandler = require('./handlers/typingHandler');
const messageHandler = require('./handlers/messageHandler');
const voiceHandler = require('./handlers/voiceHandler');
const { userService } = require('../services/userService');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    // Store user info on socket
    socket.userData = {
      username: null,
      currentChannel: null,
    };

    // User Events
    socket.on('user:join', (data) => userHandler.handleJoin(io, socket, data));
    socket.on('user:leave', (data) => userHandler.handleLeave(io, socket, data));

    // Message Events
    socket.on('message:send', (data) => messageHandler.handleSend(io, socket, data));

    // Typing Events
    socket.on('typing:start', (data) => typingHandler.handleStart(io, socket, data));
    socket.on('typing:stop', (data) => typingHandler.handleStop(io, socket, data));

    // Member List Request
    socket.on('members:request', (data) => {
      const members = userService.getChannelMembers(data.channelId);
      socket.emit('members:update', { members });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
      
      // Clean up user from channel
      if (socket.userData.username && socket.userData.currentChannel) {
        userService.removeUser(socket.userData.currentChannel, socket.id);
        
        // Notify channel
        const roomName = `channel:${socket.userData.currentChannel}`;
        io.to(roomName).emit('user:left', {
          username: socket.userData.username,
          timestamp: Date.now(),
        });

        // Update member list
        const members = userService.getChannelMembers(socket.userData.currentChannel);
        io.to(roomName).emit('members:update', { members });
      }
    });
  });
};
module.exports = (io) => {
  io.on('connection', (socket) => {
    messageHandler(io, socket);
    voiceHandler(io, socket);
  });
};