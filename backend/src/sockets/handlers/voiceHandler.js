module.exports = (io, socket) => {
  socket.on('voice:join', (channelId) => {
    socket.join(channelId);
    socket.to(channelId).emit('voice:user-joined', socket.id);
  });

  socket.on('voice:signal', ({ to, data }) => {
    io.to(to).emit('voice:signal', {
      from: socket.id,
      data
    });
  });

  socket.on('disconnect', () => {
    socket.broadcast.emit('voice:user-left', socket.id);
  });
};
