const { userService } = require('../../services/userService');

exports.handleJoin = (io, socket, data) => {
  const { username, serverId, channelId } = data;

  if (!username || !channelId) {
    socket.emit('error', { message: 'Username and channelId required' });
    return;
  }

  const roomName = `channel:${channelId}`;

  // Leave previous channel if any
  if (socket.userData.currentChannel) {
    socket.leave(`channel:${socket.userData.currentChannel}`);
    userService.removeUser(socket.userData.currentChannel, socket.id);
  }

  // Join new channel
  socket.join(roomName);
  socket.userData.username = username;
  socket.userData.currentChannel = channelId;

  // Add user to channel members
  userService.addUser(channelId, {
    id: socket.id,
    username,
    joinedAt: Date.now(),
  });

  // Notify others in channel
  socket.to(roomName).emit('user:joined', {
    username,
    timestamp: Date.now(),
  });

  // Send updated member list to everyone
  const members = userService.getChannelMembers(channelId);
  io.to(roomName).emit('members:update', { members });

  console.log(`👤 ${username} joined channel ${channelId}`);
};

exports.handleLeave = (io, socket, data) => {
  const { channelId } = data;
  const roomName = `channel:${channelId}`;

  socket.leave(roomName);
  
  if (socket.userData.username) {
    userService.removeUser(channelId, socket.id);
    
    socket.to(roomName).emit('user:left', {
      username: socket.userData.username,
      timestamp: Date.now(),
    });

    // Update member list
    const members = userService.getChannelMembers(channelId);
    io.to(roomName).emit('members:update', { members });
  }

  socket.userData.currentChannel = null;
};
