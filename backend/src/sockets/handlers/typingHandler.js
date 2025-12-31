const typingUsers = new Map(); // channelId -> Set of usernames

exports.handleStart = (io, socket, data) => {
  const { channelId } = data;
  
  if (!socket.userData.username) return;

  const roomName = `channel:${channelId}`;
  
  // Add to typing users
  if (!typingUsers.has(channelId)) {
    typingUsers.set(channelId, new Set());
  }
  typingUsers.get(channelId).add(socket.userData.username);

  // Notify others (not self)
  socket.to(roomName).emit('typing:active', {
    username: socket.userData.username,
  });
};

exports.handleStop = (io, socket, data) => {
  const { channelId } = data;
  
  if (!socket.userData.username) return;

  const roomName = `channel:${channelId}`;

  // Remove from typing users
  if (typingUsers.has(channelId)) {
    typingUsers.get(channelId).delete(socket.userData.username);
  }

  // Notify others
  socket.to(roomName).emit('typing:inactive', {
    username: socket.userData.username,
  });
};
