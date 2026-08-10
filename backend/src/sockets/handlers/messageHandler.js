const { messageService } = require('../../services/messageService');
const storage = require('../../storage/inMemory');

function getChannelAccess(channelId, userId, permission = 'VIEW_CHANNEL') {
  const channel = storage.getChannelById(channelId);
  if (!channel || !userId) return { allowed: false, channel: null, server: null };

  const server = storage.getServerById(channel.serverId);
  if (!server) return { allowed: false, channel, server: null };

  if (server.isDM) {
    return {
      allowed: Array.isArray(server.dmUserIds) && server.dmUserIds.includes(userId),
      channel,
      server,
    };
  }

  const isMember = typeof storage.isServerMember === 'function'
    ? storage.isServerMember(server.id, userId)
    : (storage.serverMembers.get(server.id) || []).includes(userId);
  if (!isMember) return { allowed: false, channel, server };

  if (permission === 'SEND_MESSAGES' && typeof storage.isMemberTimedOut === 'function' && storage.isMemberTimedOut(server.id, userId)) {
    return { allowed: false, channel, server };
  }

  const allowed = typeof storage.hasPermission === 'function'
    ? storage.hasPermission(server.id, userId, permission)
    : true;

  return { allowed, channel, server };
}

function findMessage(channelId, messageId) {
  return storage.getChannelMessages(channelId).find(message => message.id === messageId);
}

function emitChannelUpdate(io, channelId, eventName, payload) {
  io.to(`channel:${channelId}`).emit(eventName, payload);
}

function notifyRecipients(io, message, server, senderId) {
  if (!server) return;

  const recipientIds = server.isDM
    ? (server.dmUserIds || [])
    : (storage.serverMembers.get(server.id) || []);
  const body = message.content || (message.attachments?.length ? 'Bir dosya gönderdi.' : 'Yeni mesaj');

  recipientIds.forEach(recipientId => {
    if (recipientId === senderId) return;

    const recipient = storage.getUserById(recipientId);
    const mentioned = Boolean(
      recipient?.username
      && message.content?.toLocaleLowerCase('tr-TR').includes(`@${recipient.username}`.toLocaleLowerCase('tr-TR')),
    );

    io.to(`user:${recipientId}`).emit('notification:new', {
      id: `message-${message.id}-${recipientId}`,
      messageId: message.id,
      channelId: message.channelId,
      title: mentioned ? `${message.username} senden bahsetti` : `${message.username} yeni mesaj gönderdi`,
      body: body.slice(0, 180),
      timestamp: message.timestamp,
      isMention: mentioned,
    });
  });
}

exports.handleSend = async (io, socket, data = {}) => {
  try {
    const { content, channelId, attachments, replyTo } = data;
    const finalUserId = socket.userData?.userId;
    const finalUsername = socket.userData?.username;
    const cleanContent = String(content || '').trim();
    const safeAttachments = Array.isArray(attachments)
      ? attachments.slice(0, 10).filter(file => file && typeof file.url === 'string')
      : [];

    if ((!cleanContent && safeAttachments.length === 0) || !finalUsername || !channelId) return;

    const access = getChannelAccess(channelId, finalUserId, 'SEND_MESSAGES');
    if (!access.allowed) {
      socket.emit('message:error', { message: 'Bu kanala mesaj gönderme yetkin yok.' });
      return;
    }

    const message = await messageService.createMessage({
      username: finalUsername,
      userId: finalUserId,
      content: cleanContent,
      channelId,
      attachments: safeAttachments,
      replyTo,
    });

    emitChannelUpdate(io, channelId, 'message:receive', message);
    socket.emit('message:receive', message);
    notifyRecipients(io, message, access.server, finalUserId);

    if (access.server.isDM) {
      access.server.dmUserIds.forEach(recipientId => {
        if (recipientId !== finalUserId) {
          io.to(`user:${recipientId}`).emit('dm:notification', { channelId, message });
        }
      });
    }
  } catch (error) {
    console.error('Mesaj gönderilirken sunucuda hata oluştu:', error);
    socket.emit('message:error', { message: 'Mesaj gönderilemedi.' });
  }
};

exports.handleEdit = (io, socket, data = {}) => {
  try {
    const { messageId, content, channelId } = data;
    const userId = socket.userData?.userId;
    const access = getChannelAccess(channelId, userId, 'SEND_MESSAGES');
    const originalMessage = findMessage(channelId, messageId);
    if (!access.allowed || !originalMessage || originalMessage.userId !== userId) return;

    const updatedMessage = messageService.updateMessageWithChannel(channelId, messageId, String(content || '').trim(), userId);
    if (updatedMessage) emitChannelUpdate(io, channelId, 'message:update', updatedMessage);
  } catch (error) {
    console.error('Mesaj düzenleme hatası:', error);
  }
};

exports.handleDelete = (io, socket, data = {}) => {
  try {
    const { messageId, channelId } = data;
    const userId = socket.userData?.userId;
    const access = getChannelAccess(channelId, userId, 'VIEW_CHANNEL');
    const originalMessage = findMessage(channelId, messageId);
    const canManage = access.server?.isDM
      || originalMessage?.userId === userId
      || getChannelAccess(channelId, userId, 'MANAGE_MESSAGES').allowed;
    if (!access.allowed || !originalMessage || !canManage) return;

    const removed = messageService.deleteMessageWithChannel(channelId, messageId, originalMessage.userId);
    if (removed) emitChannelUpdate(io, channelId, 'message:delete', { messageId });
  } catch (error) {
    console.error('Mesaj silme hatası:', error);
  }
};

exports.handleReactionToggle = (io, socket, data = {}) => {
  try {
    const { channelId, messageId } = data;
    const emoji = String(data.emoji || '').trim();
    const userId = socket.userData?.userId;
    const access = getChannelAccess(channelId, userId, 'VIEW_CHANNEL');
    if (!access.allowed || !emoji || emoji.length > 24) return;

    const message = findMessage(channelId, messageId);
    if (!message) return;

    message.reactions = message.reactions && typeof message.reactions === 'object'
      ? message.reactions
      : {};
    const users = Array.isArray(message.reactions[emoji]) ? message.reactions[emoji] : [];
    const existingIndex = users.indexOf(userId);
    if (existingIndex === -1) users.push(userId);
    else users.splice(existingIndex, 1);

    if (users.length) message.reactions[emoji] = users;
    else delete message.reactions[emoji];
    storage.saveData?.();

    emitChannelUpdate(io, channelId, 'message:reaction:update', {
      messageId,
      reactions: message.reactions,
    });
  } catch (error) {
    console.error('Mesaj tepkisi güncellenemedi:', error);
  }
};

exports.handlePinToggle = (io, socket, data = {}) => {
  try {
    const { channelId, messageId } = data;
    const userId = socket.userData?.userId;
    const access = getChannelAccess(channelId, userId, 'MANAGE_MESSAGES');
    if (!access.allowed) {
      socket.emit('message:error', { message: 'Mesaj sabitleme yetkin yok.' });
      return;
    }

    const message = findMessage(channelId, messageId);
    if (!message) return;

    message.isPinned = !message.isPinned;
    message.pinnedBy = message.isPinned ? userId : null;
    message.pinnedAt = message.isPinned ? Date.now() : null;
    storage.saveData?.();

    emitChannelUpdate(io, channelId, 'message:pin:update', {
      messageId,
      isPinned: message.isPinned,
      pinnedBy: message.pinnedBy,
      pinnedAt: message.pinnedAt,
    });
  } catch (error) {
    console.error('Mesaj sabitleme güncellenemedi:', error);
  }
};

exports.handleSearch = (io, socket, data = {}, callback) => {
  try {
    const { channelId } = data;
    const userId = socket.userData?.userId;
    const query = String(data.query || '').trim().toLocaleLowerCase('tr-TR');
    const access = getChannelAccess(channelId, userId, 'VIEW_CHANNEL');
    if (!access.allowed) return;

    const messages = query
      ? storage.getChannelMessages(channelId)
        .filter(message => `${message.username || ''} ${message.content || ''} ${(message.attachments || []).map(file => file.filename || file.name || '').join(' ')}`.toLocaleLowerCase('tr-TR').includes(query))
        .slice(-100)
      : [];
    const payload = { channelId, messages };
    if (typeof callback === 'function') callback(payload);
    socket.emit('message:search:results', payload);
  } catch (error) {
    console.error('Mesaj araması başarısız:', error);
  }
};
