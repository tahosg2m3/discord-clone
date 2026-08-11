const { userService } = require('../../services/userService');
const storage = require('../../storage/inMemory');
const { platformService } = require('../../services/platformService');

function canViewChannel(channelId, userId) {
  const channel = storage.getChannelById(channelId);
  const server = channel && storage.getServerById(channel.serverId);
  if (!channel || !server) return false;
  if (server.isDM) return Boolean(server.dmUserIds?.includes(userId));
  return storage.isServerMember(server.id, userId)
    && platformService.hasChannelPermission(channel.id, userId, 'VIEW_CHANNEL');
}

exports.handleJoin = (io, socket, data = {}) => {
  const { channelId } = data;
  const userId = socket.userData?.userId;
  const username = socket.userData?.username;

  if (!userId || !username || !channelId) {
    socket.emit('error', { message: 'Authenticated user and channelId required' });
    return;
  }

  if (!canViewChannel(channelId, userId)) {
    socket.emit('error', { message: 'You do not have access to this channel' });
    return;
  }

  const roomName = `channel:${channelId}`;

  if (socket.userData.currentChannel) {
    socket.leave(`channel:${socket.userData.currentChannel}`);
    userService.removeUser(socket.userData.currentChannel, socket.id);
  }

  socket.join(roomName);
  socket.userData.currentChannel = channelId;
  userService.addUser(channelId, { id: socket.id, username, joinedAt: Date.now() });

  socket.to(roomName).emit('user:joined', { username, timestamp: Date.now() });
  io.to(roomName).emit('members:update', { members: userService.getChannelMembers(channelId) });
  console.log(`👤 ${username} joined channel ${channelId}`);
};

exports.handleLeave = (io, socket, data = {}) => {
  // İstemcinin channelId değeri güvenilmez; sadece gerçekten katıldığı odadan çıkar.
  const channelId = socket.userData.currentChannel;
  if (!channelId) return;

  const roomName = `channel:${channelId}`;
  socket.leave(roomName);

  if (socket.userData.username) {
    userService.removeUser(channelId, socket.id);
    socket.to(roomName).emit('user:left', { username: socket.userData.username, timestamp: Date.now() });
    io.to(roomName).emit('members:update', { members: userService.getChannelMembers(channelId) });
  }

  if (socket.userData.currentChannel === channelId) socket.userData.currentChannel = null;
};
