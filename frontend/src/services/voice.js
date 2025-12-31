export const createPeerConnection = (socket, remoteUserId, stream) => {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  stream.getTracks().forEach(track => {
    pc.addTrack(track, stream);
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('voice:signal', {
        to: remoteUserId,
        data: { candidate: event.candidate }
      });
    }
  };

  return pc;
};
const stream = await navigator.mediaDevices.getUserMedia({
  audio: true
});
navigator.mediaDevices.getDisplayMedia()