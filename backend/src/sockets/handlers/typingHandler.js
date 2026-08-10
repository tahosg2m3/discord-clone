const storage = require('../../storage/inMemory');

const typingUsers = new Map();

function canTypeInChannel(socket, channelId) {
  const userId = socket.userData?.userId;
  const channel = storage.getChannelById(channelId);
  const server = channel && storage.getServerById(channel.serverId);
  if (!userId || !channel || !server || socket.userData.currentChannel !== channelId) return false;
  if (server.isDM) return Boolean(server.dmUserIds?.includes(userId));
  return storage.isServerMember(server.id, userId)
    && !storage.isMemberTimedOut(server.id, userId)
    && storage.hasPermission(server.id, userId, 'SEND_MESSAGES');
}

exports.handleStart = (io, socket, data = {}) => {
  const channelId = data.channelId;
  const username = socket.userData?.username;
  if (!username || !canTypeInChannel(socket, channelId)) return;

  if (!typingUsers.has(channelId)) typingUsers.set(channelId, new Set());
  typingUsers.get(channelId).add(username);
  socket.to(`channel:${channelId}`).emit('typing:active', { username });
};

exports.handleStop = (io, socket, data = {}) => {
  const channelId = data.channelId;
  const username = socket.userData?.username;
  if (!username || !canTypeInChannel(socket, channelId)) return;

  typingUsers.get(channelId)?.delete(username);
  socket.to(`channel:${channelId}`).emit('typing:inactive', { username });
};
