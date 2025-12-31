const { messageService } = require('../../services/messageService');

exports.handleSend = (io, socket, data) => {
  const { content, channelId } = data;

  if (!content || !content.trim()) {
    socket.emit('error', { message: 'Message content required' });
    return;
  }

  if (!socket.userData.username) {
    socket.emit('error', { message: 'User not authenticated' });
    return;
  }

  // Create message
  const message = messageService.createMessage({
    username: socket.userData.username,
    content: content.trim(),
    channelId,
  });

  // Broadcast to channel room
  const roomName = `channel:${channelId}`;
  io.to(roomName).emit('message:receive', message);

  console.log(`💬 ${socket.userData.username}: ${content.substring(0, 50)}...`);
};
