// backend/src/sockets/handlers/voiceHandler.js

const voiceChannels = new Map(); // channelId -> [users]

module.exports = (io, socket) => {
  
  // --- JOIN EVENT ---
  socket.on('voice:join', (data) => {
    const { channelId, userId, username } = data;
    
    if (!voiceChannels.has(channelId)) {
      voiceChannels.set(channelId, []);
    }
    
    const users = voiceChannels.get(channelId);
    
    // Kullanıcı zaten listede mi kontrol et (duplicate önleme)
    const existingUser = users.find(u => u.userId === userId);
    if (!existingUser) {
        users.push({ userId, username, socketId: socket.id });
    }
    
    // Kanalın odasına (socket room) katıl
    socket.join(`voice:${channelId}`);

    // Odadaki diğerlerine haber ver
    socket.to(`voice:${channelId}`).emit('voice:user-joined', { userId, username });
    
    console.log(`🎤 ${username} joined voice channel ${channelId}`);
  });

  // --- LEAVE EVENT ---
  socket.on('voice:leave', (data) => {
    const { userId } = data;
    
    // Kullanıcıyı tüm voice channel'lardan temizle
    for (const [channelId, users] of voiceChannels.entries()) {
      const userIndex = users.findIndex(u => u.userId === userId);
      
      if (userIndex !== -1) {
        users.splice(userIndex, 1);
        
        // Odadan ayrıl ve diğerlerine bildir
        socket.leave(`voice:${channelId}`);
        socket.to(`voice:${channelId}`).emit('voice:user-left', { userId });
        
        console.log(`👋 User ${userId} left voice channel ${channelId}`);
      }
    }
  });

  // --- DISCONNECT EVENT ---
  // Kullanıcı tarayıcıyı kapatırsa da temizle
  socket.on('disconnect', () => {
    for (const [channelId, users] of voiceChannels.entries()) {
      const userIndex = users.findIndex(u => u.socketId === socket.id);
      
      if (userIndex !== -1) {
        const userId = users[userIndex].userId;
        users.splice(userIndex, 1);
        
        socket.to(`voice:${channelId}`).emit('voice:user-left', { userId });
      }
    }
  });
};