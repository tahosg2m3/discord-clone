const messageHandler = require('./handlers/messageHandler');
const userHandler = require('./handlers/userHandler');
const typingHandler = require('./handlers/typingHandler');
const voiceHandler = require('./handlers/voiceHandler');
const dmHandler = require('./handlers/dmHandler');
const statusHandler = require('./handlers/statusHandler');
const { userService } = require('../services/userService');
const storage = require('../storage/inMemory');
const { verifyAuthToken } = require('../middleware/auth');

const activeUserSockets = new Map();

function getUserServerIds(userId) {
  return storage.getAllServers()
    .filter(server => storage.isServerMember(server.id, userId))
    .map(server => server.id);
}

function broadcastPresence(io, userId, status) {
  getUserServerIds(userId).forEach(serverId => {
    io.to(`server:${serverId}`).emit('presence:update', { userId, status, serverId });
  });
}

function socketToken(socket) {
  const handshakeToken = socket.handshake.auth?.token;
  if (typeof handshakeToken === 'string') return handshakeToken;

  const authorization = socket.handshake.headers?.authorization;
  return typeof authorization === 'string' && authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;
}

module.exports = (io) => {
  // Socket.IO bağlantısı daha event çalışmadan gerçek JWT ile doğrulanır.
  io.use((socket, next) => {
    try {
      const { user } = verifyAuthToken(socketToken(socket));
      socket.authUser = { id: user.id, username: user.username };
      return next();
    } catch (error) {
      return next(new Error('Oturum geçersiz veya süresi dolmuş. Lütfen tekrar giriş yap.'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    socket.userData = {
      userId: null,
      username: null,
      currentChannel: null,
      authenticated: false,
    };

    const ensureAuthenticated = callback => (...args) => {
      if (!socket.userData.authenticated) {
        socket.emit('auth:error', { message: 'Önce socket bağlantısını doğrulaman gerekiyor.' });
        return undefined;
      }
      return callback(...args);
    };

    // Eski istemcinin gönderdiği userId/username artık güvenilmez. Kimlik sadece JWT'den gelir.
    socket.on('authenticate', () => {
      if (socket.userData.authenticated) {
        socket.emit('presence:ready');
        return;
      }

      const user = storage.getUserById(socket.authUser?.id);
      if (!user) {
        socket.emit('auth:error', { message: 'Kullanıcı bulunamadı.' });
        socket.disconnect(true);
        return;
      }

      socket.userData.userId = user.id;
      socket.userData.username = user.username;
      socket.userData.authenticated = true;

      const userSockets = activeUserSockets.get(user.id) || new Set();
      const wasOffline = userSockets.size === 0;
      userSockets.add(socket.id);
      activeUserSockets.set(user.id, userSockets);

      socket.join(`user:${user.id}`);
      storage.updateUserStatus(user.id, 'online');

      getUserServerIds(user.id).forEach(serverId => socket.join(`server:${serverId}`));

      if (wasOffline) {
        storage.getUserFriends(user.id).forEach(friend => {
          io.to(`user:${friend.id}`).emit('status:update', {
            userId: user.id,
            username: user.username,
            status: 'online',
          });
        });
        broadcastPresence(io, user.id, 'online');
      }

      socket.emit('presence:ready');
    });

    socket.on('user:join', ensureAuthenticated(data => userHandler.handleJoin(io, socket, data)));
    socket.on('user:leave', ensureAuthenticated(data => userHandler.handleLeave(io, socket, data)));

    socket.on('message:send', ensureAuthenticated(data => messageHandler.handleSend(io, socket, data)));
    socket.on('message:edit', ensureAuthenticated(data => messageHandler.handleEdit(io, socket, data)));
    socket.on('message:delete', ensureAuthenticated(data => messageHandler.handleDelete(io, socket, data)));
    socket.on('message:reaction:toggle', ensureAuthenticated(data => messageHandler.handleReactionToggle(io, socket, data)));
    socket.on('message:pin:toggle', ensureAuthenticated(data => messageHandler.handlePinToggle(io, socket, data)));
    socket.on('message:search', ensureAuthenticated((data, callback) => messageHandler.handleSearch(io, socket, data, callback)));
    // Okunma bilgisinin kalıcılığı sonraki veri tabanı aşamasında eklenecek; event güvenle kabul edilir.
    socket.on('channel:read', ensureAuthenticated(() => {}));

    socket.on('typing:start', ensureAuthenticated(data => typingHandler.handleStart(io, socket, data)));
    socket.on('typing:stop', ensureAuthenticated(data => typingHandler.handleStop(io, socket, data)));

    voiceHandler(io, socket);

    socket.on('dm:send', ensureAuthenticated(data => dmHandler.handleSendDM(io, socket, data)));
    socket.on('status:change', ensureAuthenticated(data => statusHandler.handleStatusChange(io, socket, data)));
    socket.on('users:get-online', ensureAuthenticated(data => statusHandler.handleGetOnlineUsers(io, socket, data)));

    socket.on('members:request', ensureAuthenticated(data => {
      const members = userService.getChannelMembers(data.channelId);
      socket.emit('members:update', { members });
    }));

    socket.on('disconnect', () => {
      if (socket.userData.username && socket.userData.currentChannel) {
        userService.removeUser(socket.userData.currentChannel, socket.id);
        io.to(`channel:${socket.userData.currentChannel}`).emit('user:left', {
          username: socket.userData.username,
          timestamp: Date.now(),
        });
      }

      if (socket.userData.authenticated && socket.userData.userId) {
        const userId = socket.userData.userId;
        const userSockets = activeUserSockets.get(userId);
        userSockets?.delete(socket.id);

        if (!userSockets || userSockets.size === 0) {
          activeUserSockets.delete(userId);
          storage.updateUserStatus(userId, 'offline');

          storage.getUserFriends(userId).forEach(friend => {
            io.to(`user:${friend.id}`).emit('status:update', { userId, status: 'offline' });
          });
          broadcastPresence(io, userId, 'offline');
        }
      }

      console.log('❌ Client disconnected:', socket.id);
    });
  });
};
