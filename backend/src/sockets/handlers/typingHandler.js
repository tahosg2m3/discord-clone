const storage = require('../../storage/inMemory');
const { platformService } = require('../../services/platformService');

const typingUsers = new Map();

function canTypeInChannel(socket, channelId) {
  const userId = socket.userData?.userId;
  const channel = storage.getChannelById(channelId);
  const server = channel && storage.getServerById(channel.serverId);
  if (!userId || !channel || !server || socket.userData.currentChannel !== channelId) return false;
  if (server.isDM) {
    const participants = Array.isArray(server.dmUserIds) ? server.dmUserIds : [];
    return participants.includes(userId) && !participants.some(memberId => (
      memberId !== userId && storage.isBlockedEitherDirection(userId, memberId)
    ));
  }
  return storage.isServerMember(server.id, userId)
    && !storage.isMemberTimedOut(server.id, userId)
    && platformService.hasChannelPermission(channel.id, userId, 'SEND_MESSAGES');
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
