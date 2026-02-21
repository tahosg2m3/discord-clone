const { messageService } = require('../../services/messageService');
const storage = require('../../storage/inMemory');

exports.handleSend = async (io, socket, data) => {
  const { content, channelId } = data;

  if (!content?.trim() || !socket.userData.username) return;

  const message = await messageService.createMessage({
    username: socket.userData.username,
    userId: socket.userData.userId,
    content: content.trim(),
    channelId,
  });

  // O kanalda olanlara normal mesaj event'i gönder
  io.to(`channel:${channelId}`).emit('message:receive', message);

  // EĞER BU KANAL BİR DM SUNUCUSU İSE KARŞI TARAFA BİLDİRİM AT
  const channelObj = storage.getChannelById(channelId);
  if (channelObj) {
    const serverObj = storage.getServerById(channelObj.serverId);
    if (serverObj && serverObj.isDM) {
       serverObj.dmUserIds.forEach(uid => {
           // Karşı taraftaki kişinin kendi socket odasına bildirim fırlat
           io.to(`user:${uid}`).emit('dm:notification', { channelId, message });
       });
    }
  }
};

exports.handleEdit = (io, socket, data) => {
  const { messageId, content, channelId } = data;
  const updatedMessage = messageService.updateMessageWithChannel(channelId, messageId, content, socket.userData.userId);

  if (updatedMessage) {
    io.to(`channel:${channelId}`).emit('message:update', updatedMessage);
  }
};

exports.handleDelete = (io, socket, data) => {
  const { messageId, channelId } = data;
  const result = messageService.deleteMessageWithChannel(channelId, messageId, socket.userData.userId);

  if (result) {
    io.to(`channel:${channelId}`).emit('message:delete', { messageId });
  }
};