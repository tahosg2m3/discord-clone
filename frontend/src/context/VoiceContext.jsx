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
  
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peersRef = useRef({});

  useEffect(() => {
    if (!user) return;

    // PeerJS başlat (Dinamik Ayarlar)
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

    // Hata yönetimi ekleyelim
    newPeer.on('error', (err) => {
      console.error('PeerJS Error:', err);
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
      
      // Mevcut kullanıcıysa, ona call yap
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
    const newDeafenState = !isDeafened;
    setIsDeafened(newDeafenState);
    
    // Tüm remote stream'leri mute/unmute yap
    document.querySelectorAll('.remote-audio').forEach(audio => {
      audio.muted = newDeafenState;
    });
  };

  const shareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        audio: true 
      });
      
      screenStreamRef.current = stream;
      setIsSharingScreen(true);

      // Mevcut tüm peer'lara ekran paylaşımını gönder
      Object.values(peersRef.current).forEach(call => {
        const sender = call.peerConnection
          .getSenders()
          .find(s => s.track?.kind === 'video');
        
        if (sender) {
          sender.replaceTrack(stream.getVideoTracks()[0]);
        }
      });

      // Ekran paylaşımı durdurulduğunda (tarayıcı arayüzünden durdurulursa)
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
    console.log('🖥️ Stopped screen sharing');
  };

  const addRemoteStream = (userId, stream) => {
    let audioElement = document.getElementById(`audio-${userId}`);
    
    if (!audioElement) {
      audioElement = document.createElement('audio');
      audioElement.id = `audio-${userId}`;
      audioElement.className = 'remote-audio';
      audioElement.autoplay = true;
      audioElement.muted = isDeafened; // Mevcut deafen durumuna göre başlat
      document.body.appendChild(audioElement);
    }
    
    audioElement.srcObject = stream;
  };

  const removeRemoteStream = (userId) => {
    const audioElement = document.getElementById(`audio-${userId}`);
    if (audioElement) {
      audioElement.srcObject = null; // Stream bağlantısını kes
      audioElement.remove();
    }
  };

  const value = {
    inVoiceChannel,
    isMuted,
    isDeafened,
    isSharingScreen,
    connectedUsers,
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