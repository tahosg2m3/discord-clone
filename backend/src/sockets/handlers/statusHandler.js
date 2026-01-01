// backend/src/sockets/handlers/statusHandler.js
const storage = require('../../storage/inMemory');

exports.handleStatusChange = (io, socket, data) => {
  const { status } = data; // online, offline, dnd (do not disturb)
  
  if (!socket.userData.userId) return;

  storage.updateUserStatus(socket.userData.userId, status);

  // Notify all friends
  const friends = storage.getUserFriends(socket.userData.userId);
  friends.forEach(friend => {
    io.to(`user:${friend.id}`).emit('status:update', {
      userId: socket.userData.userId,
      username: socket.userData.username,
      status,
    });
  });

  console.log(`👤 ${socket.userData.username} status: ${status}`);
};

exports.handleGetOnlineUsers = (io, socket, data) => {
  const { serverIds } = data;
  const onlineUsers = [];

  serverIds.forEach(serverId => {
    const members = storage.getServerMembers(serverId);
    members.forEach(member => {
      const status = storage.getUserStatus(member.id);
      if (status !== 'offline') {
        onlineUsers.push({
          ...member,
          status,
        });
      }
    });
  });

  socket.emit('users:online', { users: onlineUsers });
};