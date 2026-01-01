import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import Peer from 'peerjs';

const VoiceContext = createContext(null);

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (!context) throw new Error('useVoice must be used within VoiceProvider');
  return context;
};

export const VoiceProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [peer, setPeer] = useState(null);
  const [inVoiceChannel, setInVoiceChannel] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});
  
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const peersRef = useRef({});

  useEffect(() => {
    if (!user) return;

    const newPeer = new Peer(user.id, {
      host: 'localhost',
      port: 9000,
      path: '/peerjs',
    });

    newPeer.on('open', (id) => {
      console.log('🎤 Peer connected:', id);
      setPeer(newPeer);
    });

    newPeer.on('call', (call) => {
      console.log('📞 Incoming call from:', call.peer);
      
      if (localStreamRef.current || cameraStreamRef.current) {
        const streamToSend = cameraStreamRef.current || localStreamRef.current;
        call.answer(streamToSend);
        
        call.on('stream', (remoteStream) => {
          addRemoteStream(call.peer, remoteStream);
        });
      }
    });

    return () => {
      newPeer.destroy();
    };
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    socket.on('voice:user-joined', ({ userId, username }) => {
      console.log('👤 User joined voice:', username);
      setConnectedUsers(prev => [...prev, { userId, username }]);
      
      if (peer && (localStreamRef.current || cameraStreamRef.current)) {
        const streamToSend = cameraStreamRef.current || localStreamRef.current;
        const call = peer.call(userId, streamToSend);
        
        call.on('stream', (remoteStream) => {
          addRemoteStream(userId, remoteStream);
        });
        
        peersRef.current[userId] = call;
      }
    });

    socket.on('voice:user-left', ({ userId }) => {
      console.log('👋 User left voice:', userId);
      setConnectedUsers(prev => prev.filter(u => u.userId !== userId));
      
      if (peersRef.current[userId]) {
        peersRef.current[userId].close();
        delete peersRef.current[userId];
      }
      
      removeRemoteStream(userId);
    });

    return () => {
      socket.off('voice:user-joined');
      socket.off('voice:user-left');
    };
  }, [socket, peer]);

  const joinVoiceChannel = async (channelId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      
      localStreamRef.current = stream;
      setInVoiceChannel(true);

      if (socket) {
        socket.emit('voice:join', { channelId, userId: user.id, username: user.username });
      }

      console.log('🎤 Joined voice channel');
    } catch (error) {
      console.error('Failed to join voice:', error);
      alert('Microphone access denied');
    }
  };

  const leaveVoiceChannel = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }

    Object.values(peersRef.current).forEach(call => call.close());
    peersRef.current = {};

    setInVoiceChannel(false);
    setIsSharingScreen(false);
    setIsCameraOn(false);
    setConnectedUsers([]);
    setRemoteStreams({});

    if (socket) {
      socket.emit('voice:leave', { userId: user.id });
    }

    console.log('👋 Left voice channel');
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleDeafen = () => {
    setIsDeafened(!isDeafened);
  };

  const toggleCamera = async () => {
    if (isCameraOn) {
      // Turn off camera
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
        cameraStreamRef.current = null;
      }
      setIsCameraOn(false);

      // Replace with audio-only stream
      Object.values(peersRef.current).forEach(call => {
        const sender = call.peerConnection
          .getSenders()
          .find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(null);
        }
      });
    } else {
      // Turn on camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: true 
        });
        
        cameraStreamRef.current = stream;
        setIsCameraOn(true);

        // Replace stream in all peer connections
        Object.values(peersRef.current).forEach(call => {
          stream.getTracks().forEach(track => {
            const sender = call.peerConnection
              .getSenders()
              .find(s => s.track?.kind === track.kind);
            if (sender) {
              sender.replaceTrack(track);
            }
          });
        });

        console.log('📹 Camera enabled');
      } catch (error) {
        console.error('Failed to enable camera:', error);
      }
    }
  };

  const shareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        audio: true 
      });
      
      screenStreamRef.current = stream;
      setIsSharingScreen(true);

      Object.values(peersRef.current).forEach(call => {
        const sender = call.peerConnection
          .getSenders()
          .find(s => s.track?.kind === 'video');
        
        if (sender) {
          sender.replaceTrack(stream.getVideoTracks()[0]);
        }
      });

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      console.log('🖥️ Started screen sharing');
    } catch (error) {
      console.error('Failed to share screen:', error);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setIsSharingScreen(false);

    // Switch back to camera or audio
    if (cameraStreamRef.current) {
      Object.values(peersRef.current).forEach(call => {
        const sender = call.peerConnection
          .getSenders()
          .find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(cameraStreamRef.current.getVideoTracks()[0]);
        }
      });
    }

    console.log('🖥️ Stopped screen sharing');
  };

  const addRemoteStream = (userId, stream) => {
    setRemoteStreams(prev => ({
      ...prev,
      [userId]: stream,
    }));
  };

  const removeRemoteStream = (userId) => {
    setRemoteStreams(prev => {
      const updated = { ...prev };
      delete updated[userId];
      return updated;
    });
  };

  const value = {
    inVoiceChannel,
    isMuted,
    isDeafened,
    isSharingScreen,
    isCameraOn,
    connectedUsers,
    remoteStreams,
    localStream: cameraStreamRef.current || localStreamRef.current,
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    shareScreen,
    stopScreenShare,
  };

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  );
};