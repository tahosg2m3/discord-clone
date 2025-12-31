const voiceChannels = new Map(); // channelId -> [users]

exports.handleJoinVoice = (io, socket, data) => {
  const { channelId, userId, username } = data;
  
  if (!voiceChannels.has(channelId)) {
    voiceChannels.set(channelId, []);
  }
  
  voiceChannels.get(channelId).push({ userId, username, socketId: socket.id });
  
  // Diğerlerine bildir
  socket.to(`voice:${channelId}`).emit('voice:user-joined', { userId, username });
  
  // Bu kullanıcıyı voice room'a ekle
  socket.join(`voice:${channelId}`);
  
  console.log(`🎤 ${username} joined voice channel ${channelId}`);
};

exports.handleLeaveVoice = (io, socket, data) => {
  const { userId } = data;
  
  // Kullanıcıyı tüm voice channel'lardan çıkar
  for (const [channelId, users] of voiceChannels.entries()) {
    const userIndex = users.findIndex(u => u.userId === userId);
    
    if (userIndex !== -1) {
      users.splice(userIndex, 1);
      socket.to(`voice:${channelId}`).emit('voice:user-left', { userId });
      socket.leave(`voice:${channelId}`);
    }
  }
};