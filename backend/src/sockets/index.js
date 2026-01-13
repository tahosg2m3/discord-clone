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

    // Kullanıcı kimliğini doğruladığında (Login sonrası)
    socket.on('authenticate', (data) => {
      socket.userData.userId = data.userId;
      socket.userData.username = data.username;
      
      // 1. Kendi özel odasına katıl
      socket.join(`user:${data.userId}`);
      
      // 2. Durumunu 'online' yap
      storage.updateUserStatus(data.userId, 'online');
      
      // 3. Arkadaşlarına haber ver
      storage.getUserFriends(data.userId).forEach(friend => {
        io.to(`user:${friend.id}`).emit('status:update', {
          userId: data.userId, username: data.username, status: 'online'
        });
      });

      // 4. YENİ: Üye olduğu TÜM sunucuların bildirim odasına katıl
      // Bu sayede o sunuculardaki MemberList'te "Online" görünecek
      const allServers = storage.getAllServers();
      allServers.forEach(server => {
        const members = storage.serverMembers.get(server.id) || [];
        if (members.includes(data.userId)) {
          const roomName = `server:${server.id}`;
          socket.join(roomName);
          // O sunucudaki herkese "Ben online oldum" de
          socket.to(roomName).emit('presence:update', { 
            userId: data.userId, 
            status: 'online',
            serverId: server.id // Hangi sunucu için olduğu opsiyonel
          });
        }
      });
    });

    // --- Events ---
    socket.on('user:join', (data) => userHandler.handleJoin(io, socket, data));
    socket.on('user:leave', (data) => userHandler.handleLeave(io, socket, data));
    
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
      // Bu eski yöntem (channel members), artık API kullanıyoruz ama kalsın
      const members = userService.getChannelMembers(data.channelId);
      socket.emit('members:update', { members });
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
      if (socket.userData.username && socket.userData.currentChannel) {
        userService.removeUser(socket.userData.currentChannel, socket.id);
        const room = `channel:${socket.userData.currentChannel}`;
        io.to(room).emit('user:left', { username: socket.userData.username, timestamp: Date.now() });
      }
      
      if (socket.userData.userId) {
        // Durumu offline yap
        storage.updateUserStatus(socket.userData.userId, 'offline');
        
        // Arkadaşlara bildir
        storage.getUserFriends(socket.userData.userId).forEach(friend => {
          io.to(`user:${friend.id}`).emit('status:update', { userId: socket.userData.userId, status: 'offline' });
        });

        // YENİ: Üye olduğu sunuculara bildir (Socket server odalarından otomatik çıkar ama event atmamız lazım)
        const allServers = storage.getAllServers();
        allServers.forEach(server => {
            const members = storage.serverMembers.get(server.id) || [];
            if (members.includes(socket.userData.userId)) {
                // 'server:xxx' odasına haber ver
                io.to(`server:${server.id}`).emit('presence:update', { 
                    userId: socket.userData.userId, 
                    status: 'offline' 
                });
            }
        });
      }
      
      console.log('❌ Client disconnected:', socket.id);
    });
  });
};