// backend/src/sockets/index.js - KOMPLE GÜNCEL VERSİYON
const messageHandler = require('./handlers/messageHandler');
const userHandler = require('./handlers/userHandler');
const typingHandler = require('./handlers/typingHandler');
const voiceHandler = require('./handlers/voiceHandler');
const dmHandler = require('./handlers/dmHandler');
const statusHandler = require('./handlers/statusHandler');
const { userService } = require('../services/userService');
const storage = require('../storage/inMemory');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    socket.userData = {
      userId: null,
      username: null,
      currentChannel: null,
    };

    // User authentication
    socket.on('authenticate', (data) => {
      socket.userData.userId = data.userId;
      socket.userData.username = data.username;
      
      // Join personal room for DMs
      socket.join(`user:${data.userId}`);
      
      // Update status to online
      storage.updateUserStatus(data.userId, 'online');
      
      // Notify friends
      const friends = storage.getUserFriends(data.userId);
      friends.forEach(friend => {
        io.to(`user:${friend.id}`).emit('status:update', {
          userId: data.userId,
          username: data.username,
          status: 'online',
        });
      });
      
      console.log(`🔐 User authenticated: ${data.username}`);
    });

    // Channel events
    socket.on('user:join', (data) => userHandler.handleJoin(io, socket, data));
    socket.on('user:leave', (data) => userHandler.handleLeave(io, socket, data));
    socket.on('message:send', (data) => messageHandler.handleSend(io, socket, data));
    socket.on('typing:start', (data) => typingHandler.handleStart(io, socket, data));
    socket.on('typing:stop', (data) => typingHandler.handleStop(io, socket, data));

    // Voice events
    socket.on('voice:join', (data) => voiceHandler.handleJoinVoice(io, socket, data));
    socket.on('voice:leave', (data) => voiceHandler.handleLeaveVoice(io, socket, data));

    // DM events
    socket.on('dm:send', (data) => dmHandler.handleSendDM(io, socket, data));

    // Status events
    socket.on('status:change', (data) => statusHandler.handleStatusChange(io, socket, data));
    socket.on('users:get-online', (data) => statusHandler.handleGetOnlineUsers(io, socket, data));

    // Member list request
    socket.on('members:request', (data) => {
      const members = userService.getChannelMembers(data.channelId);
      socket.emit('members:update', { members });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
      
      // Clean up voice channel
      if (socket.userData.username && socket.userData.currentChannel) {
        userService.removeUser(socket.userData.currentChannel, socket.id);
        
        const roomName = `channel:${socket.userData.currentChannel}`;
        io.to(roomName).emit('user:left', {
          username: socket.userData.username,
          timestamp: Date.now(),
        });

        const members = userService.getChannelMembers(socket.userData.currentChannel);
        io.to(roomName).emit('members:update', { members });
      }

      // Update status to offline
      if (socket.userData.userId) {
        storage.updateUserStatus(socket.userData.userId, 'offline');
        
        // Notify friends
        const friends = storage.getUserFriends(socket.userData.userId);
        friends.forEach(friend => {
          io.to(`user:${friend.id}`).emit('status:update', {
            userId: socket.userData.userId,
            username: socket.userData.username,
            status: 'offline',
          });
        });
      }
    });
  });
};