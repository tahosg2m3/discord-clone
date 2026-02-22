const { messageService } = require('../../services/messageService');
const storage = require('../../storage/inMemory');

exports.handleSend = async (io, socket, data) => {
  const { content, channelId, userId, username } = data;
  
  const finalUserId = socket.userData?.userId || userId;
  const finalUsername = socket.userData?.username || username;

  if (!content?.trim() || !finalUsername) return;

  const message = await messageService.createMessage({
    username: finalUsername,
    userId: finalUserId,
    content: content.trim(),
    channelId,
  });

  // 1. O kanalda olan HERKESE mesajı gönder
  io.to(`channel:${channelId}`).emit('message:receive', message);
  
  // 2. GARANTİ SİSTEMİ: Mesajı atan kişiye "kesinlikle" ayrıca gönder. 
  // (Eğer anlık internet kopması vb. yüzünden odadan düşmüşse bile kendi mesajını saniyesinde görür)
  socket.emit('message:receive', message);

  // DM Bildirim Kontrolü
  const channelObj = storage.getChannelById(channelId);
  if (channelObj) {
    const serverObj = storage.getServerById(channelObj.serverId);
    if (serverObj && serverObj.isDM) {
       serverObj.dmUserIds.forEach(uid => {
           // Karşı tarafa bildirim gönder (kendi kendine bildirim atmasını engelle)
           if (uid !== finalUserId) {
             io.to(`user:${uid}`).emit('dm:notification', { channelId, message });
           }
       });
    }
  }
};

exports.handleEdit = (io, socket, data) => {
  const { messageId, content, channelId, userId } = data;
  const finalUserId = socket.userData?.userId || userId;
  const updatedMessage = messageService.updateMessageWithChannel(channelId, messageId, content, finalUserId);

  if (updatedMessage) {
    io.to(`channel:${channelId}`).emit('message:update', updatedMessage);
  }
};

exports.handleDelete = (io, socket, data) => {
  const { messageId, channelId, userId } = data;
  const finalUserId = socket.userData?.userId || userId;
  const result = messageService.deleteMessageWithChannel(channelId, messageId, finalUserId);

  if (result) {
    io.to(`channel:${channelId}`).emit('message:delete', { messageId });
  }
};