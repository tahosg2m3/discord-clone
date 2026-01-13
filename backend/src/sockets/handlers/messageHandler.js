const { messageService } = require('../../services/messageService');

exports.handleSend = async (io, socket, data) => {
  const { content, channelId } = data;

  if (!content?.trim() || !socket.userData.username) return;

  // Mesaj oluştur (Async çünkü OpenGraph fetch yapıyor)
  const message = await messageService.createMessage({
    username: socket.userData.username,
    userId: socket.userData.userId, // userId artık zorunlu
    content: content.trim(),
    channelId,
  });

  io.to(`channel:${channelId}`).emit('message:receive', message);
};

exports.handleEdit = (io, socket, data) => {
  const { messageId, content, channelId } = data;
  const updatedMessage = messageService.updateMessage(messageId, content, socket.userData.userId);

  if (updatedMessage) {
    io.to(`channel:${channelId}`).emit('message:update', updatedMessage);
  }
};

exports.handleDelete = (io, socket, data) => {
  const { messageId, channelId } = data;
  const result = messageService.deleteMessage(messageId, socket.userData.userId);

  if (result) {
    io.to(`channel:${channelId}`).emit('message:delete', { messageId });
  }
};