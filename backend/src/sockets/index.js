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

    socket.userData = { userId: null, username: null, currentChannel: null };

    socket.on('authenticate', (data) => {
      socket.userData.userId = data.userId;
      socket.userData.username = data.username;
      socket.join(`user:${data.userId}`);
      storage.updateUserStatus(data.userId, 'online');
      
      storage.getUserFriends(data.userId).forEach(friend => {
        io.to(`user:${friend.id}`).emit('status:update', {
          userId: data.userId, username: data.username, status: 'online'
        });
      });
    });

    // Channel Events
    socket.on('user:join', (data) => userHandler.handleJoin(io, socket, data));
    socket.on('user:leave', (data) => userHandler.handleLeave(io, socket, data));
    
    // Message Events (CRUD)
    socket.on('message:send', (data) => messageHandler.handleSend(io, socket, data));
    socket.on('message:edit', (data) => messageHandler.handleEdit(io, socket, data));
    socket.on('message:delete', (data) => messageHandler.handleDelete(io, socket, data));

    socket.on('typing:start', (data) => typingHandler.handleStart(io, socket, data));
    socket.on('typing:stop', (data) => typingHandler.handleStop(io, socket, data));

    voiceHandler(io, socket);

    socket.on('dm:send', (data) => dmHandler.handleSendDM(io, socket, data));
    socket.on('status:change', (data) => statusHandler.handleStatusChange(io, socket, data));
    socket.on('users:get-online', (data) => statusHandler.handleGetOnlineUsers(io, socket, data));

    socket.on('members:request', (data) => {
      const members = userService.getChannelMembers(data.channelId);
      socket.emit('members:update', { members });
    });

    socket.on('disconnect', () => {
      if (socket.userData.username && socket.userData.currentChannel) {
        userService.removeUser(socket.userData.currentChannel, socket.id);
        const room = `channel:${socket.userData.currentChannel}`;
        io.to(room).emit('user:left', { username: socket.userData.username, timestamp: Date.now() });
        io.to(room).emit('members:update', { members: userService.getChannelMembers(socket.userData.currentChannel) });
      }
      if (socket.userData.userId) {
        storage.updateUserStatus(socket.userData.userId, 'offline');
        storage.getUserFriends(socket.userData.userId).forEach(friend => {
          io.to(`user:${friend.id}`).emit('status:update', { userId: socket.userData.userId, status: 'offline' });
        });
      }
    });
  });
};