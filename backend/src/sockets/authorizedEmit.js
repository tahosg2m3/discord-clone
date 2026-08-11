const storage = require('../storage/inMemory');
const { platformService } = require('../services/platformService');

function socketUserId(socket) {
  if (socket?.authUser?.id) return socket.authUser.id;
  return socket?.userData?.authenticated ? (socket.userData.userId || null) : null;
}

function serverMemberIds(serverId) {
  const members = typeof storage.getServerMembers === 'function'
    ? (storage.getServerMembers(serverId) || [])
    : (storage.serverMembers?.get(serverId) || []);
  return members.map(member => member?.id || member).filter(Boolean);
}

function canUseServerPermission(server, userId, permission) {
  if (!server || !userId || !storage.isServerMember(server.id, userId)) return false;
  return server.creatorId === userId
    || storage.hasPermission(server.id, userId, 'ADMINISTRATOR')
    || !permission
    || storage.hasPermission(server.id, userId, permission);
}

function emitToServerMembers(io, serverId, eventName, payload, permission = null) {
  if (!io) return;
  const server = storage.getServerById(serverId);
  if (!server || server.isDM) return;
  const roomSocketIds = io.sockets?.adapter?.rooms?.get(`server:${serverId}`);
  if (roomSocketIds) {
    roomSocketIds.forEach(socketId => {
      const targetSocket = io.sockets.sockets.get(socketId);
      if (canUseServerPermission(server, socketUserId(targetSocket), permission)) {
        targetSocket.emit(eventName, payload);
      }
    });
    return;
  }
  serverMemberIds(serverId).forEach(userId => {
    if (canUseServerPermission(server, userId, permission)) {
      io.to(`user:${userId}`).emit(eventName, payload);
    }
  });
}

function getChannelViewerSockets(io, channelId, permission = 'VIEW_CHANNEL') {
  const channel = storage.getChannelById(channelId);
  const server = channel && storage.getServerById(channel.serverId);
  if (!io || !channel || !server) return [];
  const canView = socket => {
    const userId = socketUserId(socket);
    if (!userId) return false;
    if (server.isDM) return Boolean(server.dmUserIds?.includes(userId));
    return storage.isServerMember(server.id, userId)
      && platformService.hasChannelPermission(channel.id, userId, 'VIEW_CHANNEL')
      && (permission === 'VIEW_CHANNEL'
        || platformService.hasChannelPermission(channel.id, userId, permission));
  };
  const roomSocketIds = io.sockets?.adapter?.rooms?.get(`server:${server.id}`);
  const candidates = roomSocketIds
    ? [...roomSocketIds].map(socketId => io.sockets.sockets.get(socketId))
    : [...(io.sockets?.sockets?.values?.() || [])];
  return candidates.filter(canView);
}

function emitToChannelViewers(io, channelId, eventName, payload, {
  currentRoomOnly = false,
  permission = 'VIEW_CHANNEL',
} = {}) {
  if (!io) return;
  const channel = storage.getChannelById(channelId);
  const server = channel && storage.getServerById(channel.serverId);
  if (!channel || !server) return;
  const roomName = currentRoomOnly ? `channel:${channelId}` : `server:${server.id}`;
  const roomSocketIds = io.sockets?.adapter?.rooms?.get(roomName);
  const canView = userId => {
    if (!userId) return false;
    if (server.isDM) return Boolean(server.dmUserIds?.includes(userId));
    return storage.isServerMember(server.id, userId)
      && platformService.hasChannelPermission(channel.id, userId, 'VIEW_CHANNEL')
      && (permission === 'VIEW_CHANNEL'
        || platformService.hasChannelPermission(channel.id, userId, permission));
  };
  if (roomSocketIds) {
    roomSocketIds.forEach(socketId => {
      const targetSocket = io.sockets.sockets.get(socketId);
      if (canView(socketUserId(targetSocket))) targetSocket.emit(eventName, payload);
    });
    return;
  }
  if (currentRoomOnly) {
    // Never fall back to a blind room broadcast. Some legacy adapters expose
    // membership only on each socket rather than through adapter.rooms.
    io.sockets?.sockets?.forEach?.(targetSocket => {
      if (targetSocket?.rooms?.has?.(`channel:${channelId}`) && canView(socketUserId(targetSocket))) {
        targetSocket.emit(eventName, payload);
      }
    });
    return;
  }
  (server.isDM ? (server.dmUserIds || []) : serverMemberIds(server.id)).forEach(userId => {
    if (canView(userId)) io.to(`user:${userId}`).emit(eventName, payload);
  });
}

function emitAudit(io, serverId, entry) {
  emitToServerMembers(io, serverId, 'audit:new', { serverId, entry }, 'VIEW_AUDIT_LOG');
}

module.exports = {
  emitAudit,
  emitToChannelViewers,
  emitToServerMembers,
  getChannelViewerSockets,
};
