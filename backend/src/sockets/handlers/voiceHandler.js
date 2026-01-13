// backend/src/sockets/handlers/voiceHandler.js

const voiceChannels = new Map(); // channelId -> [users]

module.exports = (io, socket) => {
  
  // --- JOIN EVENT ---
  socket.on('voice:join', (data) => {
    // peerId'yi de alıyoruz (Dinamik ID)
    const { channelId, userId, username, peerId } = data; 
    
    if (!voiceChannels.has(channelId)) {
      voiceChannels.set(channelId, []);
    }
    
    const users = voiceChannels.get(channelId);
    
    // Kullanıcı zaten listede mi kontrol et
    const existingUser = users.find(u => u.userId === userId);
    if (!existingUser) {
        // Listeye peerId ile birlikte ekle
        users.push({ userId, username, peerId, socketId: socket.id });
    } else {
        // Eğer kullanıcı zaten varsa (sayfa yenileme vb.), peerId'sini güncelle
        existingUser.peerId = peerId;
        existingUser.socketId = socket.id;
    }
    
    // Kanalın odasına (socket room) katıl
    socket.join(`voice:${channelId}`);

    // 1. Odadaki DİĞERLERİNE haber ver (Mevcut kod)
    socket.to(`voice:${channelId}`).emit('voice:user-joined', { userId, username, peerId });

    // 2. YENİ EKLENEN KISIM: Katılan kişiye MEVCUT kullanıcıları gönder
    // Kendisi hariç diğerlerini filtrele
    const otherUsers = users.filter(u => u.userId !== userId);
    socket.emit('voice:existing-users', otherUsers);
    
    console.log(`🎤 ${username} joined voice channel ${channelId} with PeerID: ${peerId}`);
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