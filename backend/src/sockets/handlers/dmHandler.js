const storage = require('../../storage/inMemory');
const { messageService } = require('../../services/messageService');

// Eski dm:send event'i için güvenli geriye dönük destek. Yeni arayüz normal
// message:send + DM kanalını kullanır; burada da kimlik yalnızca socket JWT'den gelir.
exports.handleSendDM = async (io, socket, data = {}) => {
  const senderId = socket.userData?.userId;
  const username = socket.userData?.username;
  const receiverId = String(data.receiverId || '');
  const content = String(data.content || '').trim();

  if (!socket.userData?.authenticated || !senderId || !username || !receiverId || !content) return;
  if (receiverId === senderId || !storage.getUserById(receiverId)) return;

  try {
    const conversation = storage.getOrCreateDMConversation(senderId, receiverId);
    const message = await messageService.createMessage({
      username,
      userId: senderId,
      content,
      channelId: conversation.channelId,
    });

    io.to(`channel:${conversation.channelId}`).emit('message:receive', message);
    socket.emit('message:receive', message);
    io.to(`user:${receiverId}`).emit('dm:notification', { channelId: conversation.channelId, message });
    io.to(`user:${receiverId}`).emit('dm:receive', { conversationId: conversation.id, message });
  } catch (error) {
    console.error('Özel mesaj gönderilemedi:', error.message);
    socket.emit('message:error', { message: 'Özel mesaj gönderilemedi.' });
  }
};
