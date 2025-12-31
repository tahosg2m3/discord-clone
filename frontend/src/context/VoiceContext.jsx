// frontend/src/context/VoiceContext.jsx
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
  const [connectedUsers, setConnectedUsers] = useState([]);
  
  // Görüntülü görüşme için state
  const [remoteStreams, setRemoteStreams] = useState([]); 

  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peersRef = useRef({});

  // Boş video track oluşturucu (Ekran paylaşımı hazırlığı için)
  const createDummyVideoTrack = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 640, 480);
    const stream = canvas.captureStream(1); // 1 FPS
    return stream.getVideoTracks()[0];
  };

  useEffect(() => {
    if (!user) return;

    const newPeer = new Peer(user.id, {
      host: import.meta.env.VITE_PEER_HOST || 'localhost',
      port: import.meta.env.VITE_PEER_PORT || 9000,
      path: '/peerjs',
      secure: import.meta.env.VITE_PEER_SECURE === 'true',
    });

    newPeer.on('open', (id) => {
      console.log('🎤 Peer connected:', id);
      setPeer(newPeer);
    });

    newPeer.on('call', (call) => {
      console.log('📞 Incoming call from:', call.peer);
      
      if (localStreamRef.current) {
        call.answer(localStreamRef.current);
        call.on('stream', (remoteStream) => {
          addRemoteStream(call.peer, remoteStream);
        });
      }
    });

    newPeer.on('error', (err) => console.error('PeerJS Error:', err));

    return () => {
      newPeer.destroy();
    };
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    socket.on('voice:user-joined', ({ userId, username }) => {
      console.log('👤 User joined voice:', username);
      setConnectedUsers(prev => {
        if(prev.find(u => u.userId === userId)) return prev;
        return [...prev, { userId, username }];
      });
      
      if (peer && localStreamRef.current) {
        const call = peer.call(userId, localStreamRef.current);
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
      // Ses akışını al
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      
      // Boş bir video izi ekle (Ekran paylaşımı için yer tutucu)
      const videoTrack = createDummyVideoTrack();
      const combinedStream = new MediaStream([audioStream.getAudioTracks()[0], videoTrack]);

      localStreamRef.current = combinedStream;
      setInVoiceChannel(true);

      if (socket) {
        socket.emit('voice:join', { channelId, userId: user.id, username: user.username });
      }
    } catch (error) {
      console.error('Failed to join voice:', error);
      alert('Microphone access denied or not found.');
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

    Object.values(peersRef.current).forEach(call => call.close());
    peersRef.current = {};

    setInVoiceChannel(false);
    setIsSharingScreen(false);
    setConnectedUsers([]);
    setRemoteStreams([]); // Streamleri temizle

    if (socket) {
      socket.emit('voice:leave', { userId: user.id });
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleDeafen = () => {
    const newDeafenState = !isDeafened;
    setIsDeafened(newDeafenState);
  };

  const shareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = stream;
      setIsSharingScreen(true);

      const screenTrack = stream.getVideoTracks()[0];

      // Mevcut bağlantılardaki video izini (dummy track) ekran paylaşımı ile değiştir
      Object.values(peersRef.current).forEach(call => {
        const sender = call.peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      screenTrack.onended = () => stopScreenShare();
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

    // Geriye boş video izini (Dummy Track) koy
    const dummyTrack = createDummyVideoTrack();
    Object.values(peersRef.current).forEach(call => {
      const sender = call.peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(dummyTrack);
      }
    });
  };

  // State tabanlı stream yönetimi
  const addRemoteStream = (userId, stream) => {
    setRemoteStreams(prev => {
      if (prev.some(s => s.userId === userId)) return prev;
      return [...prev, { userId, stream }];
    });
  };

  const removeRemoteStream = (userId) => {
    setRemoteStreams(prev => prev.filter(s => s.userId !== userId));
  };

  const value = {
    inVoiceChannel,
    isMuted,
    isDeafened,
    isSharingScreen,
    connectedUsers,
    remoteStreams, // UI'da kullanmak için dışa aktar
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleDeafen,
    shareScreen,
    stopScreenShare,
  };

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  );
};