const storage = require('../../storage/inMemory');

// channelId -> [{ userId, username, peerId, socketId, streamMode, audioEnabled }]
const voiceChannels = new Map();

const VOICE_MODERATION_ACTIONS = {
  mute: { permission: 'MUTE_MEMBERS', changes: { serverMuted: true } },
  unmute: { permission: 'MUTE_MEMBERS', changes: { serverMuted: false } },
  deafen: { permission: 'DEAFEN_MEMBERS', changes: { serverDeafened: true } },
  undeafen: { permission: 'DEAFEN_MEMBERS', changes: { serverDeafened: false } },
  disconnect: { permission: 'MOVE_MEMBERS' },
};

function sameId(first, second) {
  return String(first || '') === String(second || '');
}

function isValidPeerId(peerId) {
  return /^[A-Za-z0-9_-]{1,255}$/.test(peerId);
}

function getVoiceCapabilities(channel, userId) {
  const empty = {
    channelId: channel?.id || null,
    serverId: channel?.serverId || null,
    canConnect: false,
    canSpeak: false,
    canStream: false,
    serverMuted: false,
    serverDeafened: false,
    isTimedOut: false,
  };

  if (!channel || channel.type !== 'voice') return empty;
  const server = storage.getServerById(channel.serverId);
  if (!server || server.isDM || !storage.isServerMember(server.id, userId)) return empty;

  const moderation = storage.getMemberModerationState(server.id, userId);
  const canConnect = !moderation.isTimedOut && storage.hasPermission(server.id, userId, 'CONNECT');
  return {
    channelId: channel.id,
    serverId: server.id,
    canConnect,
    canSpeak: canConnect && storage.hasPermission(server.id, userId, 'SPEAK'),
    canStream: canConnect && storage.hasPermission(server.id, userId, 'STREAM'),
    ...moderation,
  };
}

function isVoiceChannelAccessible(channel, userId) {
  return getVoiceCapabilities(channel, userId).canConnect;
}

function getPublicMembers(channelId) {
  const channel = storage.getChannelById(channelId);
  if (!channel) return [];

  return (voiceChannels.get(channelId) || []).map((participant) => {
    const moderation = storage.getMemberModerationState(channel.serverId, participant.userId);
    return {
      userId: participant.userId,
      username: participant.username,
      peerId: participant.peerId,
      streamMode: participant.streamMode || 'none',
      ...moderation,
    };
  });
}

function broadcastVoiceMembers(io, channelId) {
  const channel = storage.getChannelById(channelId);
  if (!channel) return;

  io.to(`server:${channel.serverId}`).emit('voice:channel-members', {
    channelId,
    members: getPublicMembers(channelId),
  });
}

function reply(callback, payload) {
  if (typeof callback === 'function') callback(payload);
}

function sendCapabilities(socket, capabilities) {
  socket.emit('voice:capabilities', capabilities);
}

function removeVoiceSocket(io, channelId, socketId, { notify = true } = {}) {
  const users = voiceChannels.get(channelId) || [];
  const userIndex = users.findIndex((member) => member.socketId === socketId);
  if (userIndex === -1) return null;

  const [participant] = users.splice(userIndex, 1);
  const channel = storage.getChannelById(channelId);
  const targetSocket = io.sockets.sockets.get(socketId);
  targetSocket?.leave(`voice:${channelId}`);

  if (notify) {
    io.to(`voice:${channelId}`).emit('voice:user-left', {
      channelId,
      serverId: channel?.serverId,
      userId: participant.userId,
    });
  }
  if (users.length === 0) voiceChannels.delete(channelId);
  broadcastVoiceMembers(io, channelId);
  return participant;
}

function sendModerationEvent(io, targetUserId, payload) {
  io.to(`user:${targetUserId}`).emit('voice:moderated', payload);
}

function disconnectUserFromServerVoice(io, serverId, userId) {
  if (!io) return false;
  let disconnected = false;

  for (const channelId of [...voiceChannels.keys()]) {
    const channel = storage.getChannelById(channelId);
    if (!channel || !sameId(channel.serverId, serverId)) continue;
    const participant = (voiceChannels.get(channelId) || []).find((member) => sameId(member.userId, userId));
    if (!participant) continue;
    removeVoiceSocket(io, channelId, participant.socketId);
    disconnected = true;
  }

  return disconnected;
}

module.exports = (io, socket) => {
  const fail = (message, callback, capabilities) => {
    if (capabilities) sendCapabilities(socket, capabilities);
    socket.emit('voice:error', { message });
    reply(callback, { success: false, error: message, capabilities });
  };

  socket.on('voice:capabilities-request', (data = {}, callback) => {
    const userId = socket.userData?.userId;
    const channelId = String(data.channelId || '');
    const channel = storage.getChannelById(channelId);
    const capabilities = getVoiceCapabilities(channel, userId);

    if (!socket.userData?.authenticated || !userId || !channelId || !capabilities.canConnect) {
      reply(callback, {
        success: false,
        error: 'Bu ses kanalına bağlanma yetkin yok.',
        capabilities,
      });
      return;
    }

    sendCapabilities(socket, capabilities);
    reply(callback, { success: true, capabilities });
  });

  socket.on('voice:join', (data = {}, callback) => {
    const userId = socket.userData?.userId;
    const username = socket.userData?.username;
    const channelId = String(data.channelId || '');
    const peerId = String(data.peerId || '');
    const channel = storage.getChannelById(channelId);
    const capabilities = getVoiceCapabilities(channel, userId);

    if (!socket.userData?.authenticated || !userId || !username || !channelId || !isValidPeerId(peerId)) {
      fail('Ses kanalı bağlantı bilgisi geçersiz.', callback, capabilities);
      return;
    }
    if (!capabilities.canConnect) {
      fail('Bu ses kanalına bağlanma yetkin yok.', callback, capabilities);
      return;
    }

    // Aynı socket başka bir ses kanalındaysa önce temizle.
    for (const existingChannelId of [...voiceChannels.keys()]) {
      if (!sameId(existingChannelId, channelId)) removeVoiceSocket(io, existingChannelId, socket.id);
    }

    if (!voiceChannels.has(channelId)) voiceChannels.set(channelId, []);
    const users = voiceChannels.get(channelId);
    const existingUser = users.find((member) => sameId(member.userId, userId));
    let peerChanged = false;

    if (existingUser) {
      const oldSocketId = existingUser.socketId;
      peerChanged = !sameId(existingUser.peerId, peerId);
      existingUser.username = username;
      existingUser.peerId = peerId;
      existingUser.socketId = socket.id;
      if (oldSocketId !== socket.id) io.sockets.sockets.get(oldSocketId)?.leave(`voice:${channelId}`);
    } else {
      users.push({
        userId: String(userId),
        username,
        peerId,
        socketId: socket.id,
        streamMode: 'none',
        audioEnabled: false,
      });
    }

    socket.join(`voice:${channelId}`);
    // Yeni socket veya yeni PeerJS kimliği diğer katılımcıların eski WebRTC
    // çağrısını kapatıp doğru peerId ile tekrar kurmasını sağlar.
    if (!existingUser || peerChanged || existingUser.socketId === socket.id) {
      socket.to(`voice:${channelId}`).emit('voice:user-joined', {
        channelId,
        serverId: channel.serverId,
        userId: String(userId),
        username,
        peerId,
      });
    }
    socket.emit('voice:existing-users', users
      .filter((member) => !sameId(member.userId, userId))
      .map((member) => ({
        userId: member.userId,
        username: member.username,
        peerId: member.peerId,
        streamMode: member.streamMode || 'none',
        ...storage.getMemberModerationState(channel.serverId, member.userId),
      })));
    sendCapabilities(socket, capabilities);
    socket.emit('voice:moderation-state', capabilities);
    broadcastVoiceMembers(io, channelId);
    reply(callback, { success: true, capabilities });
  });

  socket.on('voice:leave', () => {
    if (!socket.userData?.authenticated) return;
    for (const channelId of [...voiceChannels.keys()]) removeVoiceSocket(io, channelId, socket.id);
  });

  socket.on('voice:stream-changed', (data = {}, callback) => {
    const userId = socket.userData?.userId;
    const channelId = String(data.channelId || '');
    const kind = String(data.kind || 'video').toLowerCase();
    const mode = String(data.mode || 'camera').toLowerCase();
    const channel = storage.getChannelById(channelId);
    const capabilities = getVoiceCapabilities(channel, userId);
    const users = voiceChannels.get(channelId) || [];
    const participant = users.find((member) => member.socketId === socket.id && sameId(member.userId, userId));

    if (!socket.userData?.authenticated || !participant || !capabilities.canConnect) {
      fail('Ses kanalındaki bağlantın doğrulanamadı.', callback, capabilities);
      return;
    }
    if (!['audio', 'video'].includes(kind)) {
      fail('Geçersiz ses/yayın durumu.', callback, capabilities);
      return;
    }
    if (kind === 'video' && !['camera', 'screen', 'none'].includes(mode)) {
      fail('Geçersiz yayın türü.', callback, capabilities);
      return;
    }
    if (kind === 'video' && mode !== 'none' && !capabilities.canStream) {
      fail('Bu ses kanalında yayın veya kamera açma yetkin yok.', callback, capabilities);
      return;
    }
    if (kind === 'audio' && data.enabled !== false && (!capabilities.canSpeak || capabilities.serverMuted)) {
      fail('Bu ses kanalında konuşma yetkin yok.', callback, capabilities);
      return;
    }

    if (kind === 'video') participant.streamMode = mode;
    if (kind === 'audio') participant.audioEnabled = Boolean(data.enabled);
    socket.to(`voice:${channelId}`).emit('voice:stream-changed', {
      channelId,
      serverId: channel.serverId,
      userId: String(userId),
      kind,
      mode: kind === 'video' ? mode : undefined,
      enabled: kind === 'audio' ? Boolean(data.enabled) : undefined,
    });
    sendCapabilities(socket, capabilities);
    broadcastVoiceMembers(io, channelId);
    reply(callback, { success: true, capabilities });
  });

  socket.on('voice:members-request', (data = {}) => {
    const serverId = String(data.serverId || '');
    const userId = socket.userData?.userId;
    if (!socket.userData?.authenticated || !storage.isServerMember(serverId, userId)) return;

    const channels = storage.getChannelsByServerId(serverId)
      .filter((channel) => channel.type === 'voice')
      .map((channel) => ({ channelId: channel.id, members: getPublicMembers(channel.id) }));
    socket.emit('voice:channels-snapshot', { serverId, channels });
  });

  socket.on('voice:moderate', (data = {}, callback) => {
    const actorId = socket.userData?.userId;
    const action = String(data.action || '').toLowerCase();
    const targetUserId = String(data.targetUserId || '');
    const channelId = String(data.channelId || '');
    const definition = VOICE_MODERATION_ACTIONS[action];
    const channel = storage.getChannelById(channelId);
    const capabilities = getVoiceCapabilities(channel, actorId);
    const moderationFail = (message) => fail(message, callback, capabilities);

    if (!socket.userData?.authenticated || !definition || !targetUserId || !capabilities.canConnect) {
      moderationFail('Sesli moderasyon işlemi geçersiz.');
      return;
    }

    const targetParticipant = (voiceChannels.get(channelId) || []).find((member) => sameId(member.userId, targetUserId));
    if (!targetParticipant) {
      moderationFail('Bu kullanıcı bu ses kanalında değil.');
      return;
    }

    if (!storage.canModerateMember(channel.serverId, actorId, targetUserId, definition.permission)) {
      moderationFail('Bu kullanıcıyı yönetmek için yetkin veya rol hiyerarşin yeterli değil.');
      return;
    }

    const eventBase = {
      action,
      channelId,
      serverId: channel.serverId,
      byUsername: socket.userData.username,
    };

    if (definition.changes) {
      const state = storage.setMemberModerationState(channel.serverId, targetUserId, definition.changes, actorId);
      const targetCapabilities = getVoiceCapabilities(channel, targetUserId);
      sendModerationEvent(io, targetUserId, { ...eventBase, state });
      io.to(`user:${targetUserId}`).emit('voice:capabilities', targetCapabilities);
      broadcastVoiceMembers(io, channelId);
      const member = storage.getServerMemberDetails(channel.serverId, targetUserId);
      io.to(`server:${channel.serverId}`).emit('server:member-updated', { serverId: channel.serverId, member });
      io.to(`server:${channel.serverId}`).emit('server:members-changed', { serverId: channel.serverId });
      reply(callback, { success: true, action, state, capabilities: targetCapabilities });
      return;
    }

    sendModerationEvent(io, targetUserId, eventBase);
    disconnectUserFromServerVoice(io, channel.serverId, targetUserId);
    reply(callback, { success: true, action });
  });

  socket.on('disconnect', () => {
    for (const channelId of [...voiceChannels.keys()]) removeVoiceSocket(io, channelId, socket.id);
  });
};

module.exports.disconnectUserFromServerVoice = disconnectUserFromServerVoice;
