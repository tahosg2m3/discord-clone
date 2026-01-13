const storage = require('../../storage/inMemory');
const { v4: uuidv4 } = require('uuid');

exports.handleSendDM = (io, socket, data) => {
  const { receiverId, content } = data;
  const senderId = socket.userData.userId;
  const username = socket.userData.username; // EKLENDİ: Gönderen adı

  if (!content || !receiverId || !senderId) return;

  // 1. Konuşmayı bul veya oluştur
  const conversation = storage.getOrCreateDMConversation(senderId, receiverId);

  // 2. Mesaj objesi oluştur
  const message = {
    id: uuidv4(),
    conversationId: conversation.id,
    senderId,
    username, // EKLENDİ: Mesaj listesinde görünmesi için şart
    content,
    timestamp: Date.now(),
    type: 'text'
  };

  // 3. Mesajı kaydet
  storage.addDMMessage(conversation.id, message);

  // 4. Mesajı GÖNDER (Her iki tarafa da)
  // Alıcıya gönder
  io.to(`user:${receiverId}`).emit('dm:receive', {
    conversationId: conversation.id,
    message
  });

  // Gönderene de gönder (Ekranda görünmesi için)
  socket.emit('dm:receive', {
    conversationId: conversation.id,
    message
  });
  
  // Konuşma listesini güncelle (Son mesaj bilgisi için)
  const conversationUpdate = {
     ...conversation,
     lastMessageAt: message.timestamp,
     otherUser: storage.getUserById(senderId)
  };
  
  io.to(`user:${receiverId}`).emit('dm:conversation-update', conversationUpdate);
};