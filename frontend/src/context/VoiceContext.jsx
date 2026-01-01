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
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});
  
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peersRef = useRef({});

  const createDummyVideoTrack = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000000"; 
    ctx.fillRect(0, 0, 640, 480);
    const stream = canvas.captureStream(1);
    const track = stream.getVideoTracks()[0];
    track.enabled = true;
    return track;
  };

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const newPeer = new Peer(user.id, {
      host: import.meta.env.VITE_PEER_HOST || 'localhost',
      port: import.meta.env.VITE_PEER_PORT || 9000,
      path: '/peerjs',
      secure: import.meta.env.VITE_PEER_SECURE === 'true',
    });

    newPeer.on('open', (id) => {
      if (!mounted) return;
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
        peersRef.current[call.peer] = call;
      }
    });

    newPeer.on('error', (err) => console.error('PeerJS Error:', err));

    return () => {
      mounted = false;
      newPeer.destroy();
      setPeer(null);
    };
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    socket.on('voice:user-joined', ({ userId, username }) => {
      console.log('👤 User joined voice:', username);
      setConnectedUsers(prev => {
        if (prev.find(u => u.userId === userId)) return prev;
        return [...prev, { userId, username }];
      });
      
      if (peer && localStreamRef.current) {
        if (peersRef.current[userId]) peersRef.current[userId].close();
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
      removeRemoteStream(userId);
      if (peersRef.current[userId]) {
        peersRef.current[userId].close();
        delete peersRef.current[userId];
      }
    });

    return () => {
      socket.off('voice:user-joined');
      socket.off('voice:user-left');
    };
  }, [socket, peer]);

  const joinVoiceChannel = async (channelId) => {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const videoTrack = createDummyVideoTrack();
      const combinedStream = new MediaStream([audioStream.getAudioTracks()[0], videoTrack]);

      localStreamRef.current = combinedStream;
      setInVoiceChannel(true);
      setIsMuted(false); // Başlangıçta mute kapalı olsun

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
    setIsCameraOn(false);
    setConnectedUsers([]);
    setRemoteStreams({});

    if (socket) {
      socket.emit('voice:leave', { userId: user.id });
    }
  };

  // GÜNCELLENMİŞ TOGGLE MUTE
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        console.log('Microphone toggled. Muted:', !audioTrack.enabled);
      } else {
        console.warn('No audio track found to mute.');
      }
    }
  };

  const toggleDeafen = () => {
    setIsDeafened(!isDeafened);
  };

  const toggleCamera = async () => {
    if (isSharingScreen) {
        alert("Cannot turn on camera while sharing screen.");
        return;
    }

    if (!isCameraOn) {
        try {
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const videoTrack = videoStream.getVideoTracks()[0];
            replaceVideoTrack(videoTrack);
            setIsCameraOn(true);
            videoTrack.onended = () => toggleCamera(); 
        } catch (e) {
            console.error("Camera access failed", e);
        }
    } else {
        const dummyTrack = createDummyVideoTrack();
        replaceVideoTrack(dummyTrack);
        setIsCameraOn(false);
    }
  };

  const shareScreen = async () => {
    if (isCameraOn) setIsCameraOn(false); 

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = stream;
      setIsSharingScreen(true);
      const screenTrack = stream.getVideoTracks()[0];
      replaceVideoTrack(screenTrack);
      screenTrack.onended = () => stopScreenShare();
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
    const dummyTrack = createDummyVideoTrack();
    replaceVideoTrack(dummyTrack);
    console.log('🖥️ Stopped screen sharing');
  };

  const replaceVideoTrack = (newTrack) => {
    if (localStreamRef.current) {
        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldVideoTrack) {
            localStreamRef.current.removeTrack(oldVideoTrack);
            oldVideoTrack.stop();
        }
        localStreamRef.current.addTrack(newTrack);
    }

    Object.values(peersRef.current).forEach(call => {
      const sender = call.peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(newTrack);
      }
    });
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
    localStream: localStreamRef.current,
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