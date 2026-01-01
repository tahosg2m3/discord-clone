// backend/src/sockets/handlers/dmHandler.js
const { v4: uuidv4 } = require('uuid');
const storage = require('../../storage/inMemory');

exports.handleSendDM = (io, socket, data) => {
  const { conversationId, content } = data;

  if (!content || !content.trim()) {
    socket.emit('error', { message: 'Message content required' });
    return;
  }

  if (!socket.userData.username) {
    socket.emit('error', { message: 'User not authenticated' });
    return;
  }

  const message = {
    id: uuidv4(),
    conversationId,
    senderId: socket.userData.userId,
    username: socket.userData.username,
    content: content.trim(),
    timestamp: Date.now(),
    type: 'user',
  };

  storage.addDMMessage(conversationId, message);

  // Get conversation to find other user
  const conversation = storage.dmConversations.find(c => c.id === conversationId);
  if (conversation) {
    const otherUserId = conversation.user1Id === socket.userData.userId 
      ? conversation.user2Id 
      : conversation.user1Id;

    // Send to both users
    io.to(`user:${socket.userData.userId}`).emit('dm:receive', message);
    io.to(`user:${otherUserId}`).emit('dm:receive', message);
  }

  console.log(`💬 DM from ${socket.userData.username}: ${content.substring(0, 50)}...`);
};