import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Peer } from 'peerjs';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const VoiceContext = createContext(null);

// Yerel geliştirme, Electron ve dağıtım ortamlarında PeerJS adresi ayrı ayrı
// ayarlanabilir. Peer sunucusunda discovery kapalı olduğu için istemci tarafında
// rastgele peer keşfi yapılmaz.
const PEER_CONFIG = {
  host: import.meta.env.VITE_PEER_HOST || '127.0.0.1',
  port: Number(import.meta.env.VITE_PEER_PORT || 9000),
  path: import.meta.env.VITE_PEER_PATH || '/peerjs',
  secure: import.meta.env.VITE_PEER_SECURE === 'true',
  debug: import.meta.env.DEV ? 2 : 0,
};

const DEFAULT_CAPABILITIES = Object.freeze({
  channelId: null,
  serverId: null,
  canConnect: false,
  canSpeak: false,
  canStream: false,
  serverMuted: false,
  serverDeafened: false,
  isTimedOut: false,
});

export const useVoice = () => useContext(VoiceContext);

function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

function hasLiveAudioTrack(stream) {
  return Boolean(stream?.getAudioTracks().some((track) => track.readyState === 'live'));
}

function normalizeCapabilities(capabilities = {}) {
  return {
    ...DEFAULT_CAPABILITIES,
    ...capabilities,
    canConnect: Boolean(capabilities.canConnect),
    canSpeak: Boolean(capabilities.canSpeak),
    canStream: Boolean(capabilities.canStream),
    serverMuted: Boolean(capabilities.serverMuted),
    serverDeafened: Boolean(capabilities.serverDeafened),
    isTimedOut: Boolean(capabilities.isTimedOut),
  };
}

function sameId(first, second) {
  return String(first || '') === String(second || '');
}

export const VoiceProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [peerId, setPeerId] = useState(null);
  const [isInVoice, setIsInVoice] = useState(false);
  const [activeVoiceChannel, setActiveVoiceChannel] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [voiceChannelMembers, setVoiceChannelMembers] = useState({});
  const [voiceParticipants, setVoiceParticipants] = useState({});
  const [speakingUserIds, setSpeakingUserIds] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isServerMuted, setIsServerMuted] = useState(false);
  const [isServerDeafened, setIsServerDeafened] = useState(false);
  const [voiceCapabilities, setVoiceCapabilities] = useState(DEFAULT_CAPABILITIES);
  const [voiceError, setVoiceError] = useState('');
  const [availableDevices, setAvailableDevices] = useState({ audioinput: [], audiooutput: [], videoinput: [] });
  const [inputDeviceId, setInputDeviceId] = useState(() => localStorage.getItem('voice:input-device') || '');
  const [outputDeviceId, setOutputDeviceId] = useState(() => localStorage.getItem('voice:output-device') || '');
  const [cameraDeviceId, setCameraDeviceId] = useState(() => localStorage.getItem('voice:camera-device') || '');
  const [voiceMode, setVoiceModeState] = useState(() => localStorage.getItem('voice:mode') || 'activity');
  const [pushToTalkKey, setPushToTalkKeyState] = useState(() => localStorage.getItem('voice:ptt-key') || 'Space');
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const [noiseSuppression, setNoiseSuppressionState] = useState(() => localStorage.getItem('voice:noise-suppression') !== 'false');
  const [screenSharePreset, setScreenSharePreset] = useState(() => localStorage.getItem('voice:screen-preset') || '1080p30');

  const userRef = useRef(user);
  const socketRef = useRef(socket);
  const peerRef = useRef(null);
  const peerIdRef = useRef(null);
  const activeVoiceChannelRef = useRef(null);
  const isInVoiceRef = useRef(false);
  const voiceCapabilitiesRef = useRef(DEFAULT_CAPABILITIES);
  const audioStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const callsRef = useRef({});
  const participantsRef = useRef({});
  const remoteStreamsRef = useRef({});
  const isMutedRef = useRef(false);
  const isDeafenedRef = useRef(false);
  const leaveVoiceChannelRef = useRef(() => {});
  const pendingVoiceJoinRef = useRef(null);
  const joinInProgressRef = useRef(false);
  const rejoiningRef = useRef(false);
  const inputDeviceIdRef = useRef(inputDeviceId);
  const cameraDeviceIdRef = useRef(cameraDeviceId);
  const voiceModeRef = useRef(voiceMode);
  const pushToTalkActiveRef = useRef(false);
  const noiseSuppressionRef = useRef(noiseSuppression);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => { inputDeviceIdRef.current = inputDeviceId; localStorage.setItem('voice:input-device', inputDeviceId); }, [inputDeviceId]);
  useEffect(() => { localStorage.setItem('voice:output-device', outputDeviceId); }, [outputDeviceId]);
  useEffect(() => { cameraDeviceIdRef.current = cameraDeviceId; localStorage.setItem('voice:camera-device', cameraDeviceId); }, [cameraDeviceId]);
  useEffect(() => { voiceModeRef.current = voiceMode; localStorage.setItem('voice:mode', voiceMode); }, [voiceMode]);
  useEffect(() => { localStorage.setItem('voice:ptt-key', pushToTalkKey); }, [pushToTalkKey]);
  useEffect(() => { noiseSuppressionRef.current = noiseSuppression; localStorage.setItem('voice:noise-suppression', String(noiseSuppression)); }, [noiseSuppression]);
  useEffect(() => { localStorage.setItem('voice:screen-preset', screenSharePreset); }, [screenSharePreset]);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return undefined;
    const refreshDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAvailableDevices({
          audioinput: devices.filter(device => device.kind === 'audioinput'),
          audiooutput: devices.filter(device => device.kind === 'audiooutput'),
          videoinput: devices.filter(device => device.kind === 'videoinput'),
        });
      } catch { /* Tarayıcı cihaz listesini vermeyebilir. */ }
    };
    refreshDevices();
    navigator.mediaDevices.addEventListener?.('devicechange', refreshDevices);
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', refreshDevices);
  }, []);

  useEffect(() => {
    const editable = target => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
    const setPressed = pressed => {
      pushToTalkActiveRef.current = pressed;
      setIsPushToTalkActive(pressed);
      if (voiceModeRef.current !== 'push-to-talk') return;
      audioStreamRef.current?.getAudioTracks().forEach(track => {
        track.enabled = pressed && !isMutedRef.current && !voiceCapabilitiesRef.current.serverMuted;
      });
    };
    const down = event => {
      if (voiceModeRef.current !== 'push-to-talk' || event.code !== pushToTalkKey || editable(event.target)) return;
      event.preventDefault();
      if (!event.repeat) setPressed(true);
    };
    const up = event => {
      if (event.code !== pushToTalkKey) return;
      event.preventDefault();
      setPressed(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [pushToTalkKey]);

  useEffect(() => {
    activeVoiceChannelRef.current = activeVoiceChannel;
  }, [activeVoiceChannel]);

  useEffect(() => {
    isInVoiceRef.current = isInVoice;
  }, [isInVoice]);

  const createOutgoingStream = () => {
    const stream = new MediaStream();
    audioStreamRef.current?.getAudioTracks().forEach((track) => stream.addTrack(track));

    // Aynı anda tek video kaynağı gönderilir: ekran paylaşımı kameraya önceliklidir.
    const videoSource = screenStreamRef.current || cameraStreamRef.current;
    videoSource?.getVideoTracks().forEach((track) => stream.addTrack(track));
    return stream;
  };

  const applyDeafenState = (deafened) => {
    Object.values(remoteStreamsRef.current).forEach((stream) => {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !deafened;
      });
    });
  };

  const removeRemoteUser = (userId) => {
    setRemoteStreams((previous) => {
      const updated = { ...previous };
      delete updated[userId];
      remoteStreamsRef.current = updated;
      return updated;
    });
  };

  const addVoiceParticipant = (participant) => {
    if (!participant?.userId || !participant?.peerId) return;

    const userId = String(participant.userId);
    const normalized = { ...participant, userId, peerId: String(participant.peerId) };
    participantsRef.current = {
      ...participantsRef.current,
      [userId]: { ...participantsRef.current[userId], ...normalized },
    };
    setVoiceParticipants((previous) => ({
      ...previous,
      [userId]: { ...previous[userId], ...normalized },
    }));
  };

  const removeVoiceParticipant = (userId) => {
    const normalizedUserId = String(userId || '');
    delete participantsRef.current[normalizedUserId];
    setVoiceParticipants((previous) => {
      const updated = { ...previous };
      delete updated[normalizedUserId];
      return updated;
    });
  };

  const attachCall = (call, remoteUserId) => {
    const normalizedUserId = String(remoteUserId);
    const previousCall = callsRef.current[normalizedUserId];
    if (previousCall && previousCall !== call) previousCall.close();
    callsRef.current[normalizedUserId] = call;

    call.on('stream', (stream) => {
      // Arka planda sağırlaştırılmış kullanıcıların uzaktaki sesi de kapalı kalır.
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isDeafenedRef.current;
      });

      setRemoteStreams((previous) => {
        const updated = { ...previous, [normalizedUserId]: stream };
        remoteStreamsRef.current = updated;
        return updated;
      });
    });

    const removeCall = () => {
      if (callsRef.current[normalizedUserId] === call) {
        delete callsRef.current[normalizedUserId];
        removeRemoteUser(normalizedUserId);
      }
    };

    call.on('close', removeCall);
    call.on('error', removeCall);
  };

  const closeAllCalls = () => {
    Object.values(callsRef.current).forEach((call) => call.close());
    callsRef.current = {};
    remoteStreamsRef.current = {};
    setRemoteStreams({});
  };

  const callParticipant = (participant) => {
    const currentPeer = peerRef.current;
    const activeChannel = activeVoiceChannelRef.current;
    const localUser = userRef.current;
    const remoteUserId = String(participant?.userId || '');
    const knownParticipant = participantsRef.current[remoteUserId];

    if (
      !currentPeer
      || !localUser?.id
      || !isInVoiceRef.current
      || !activeChannel?.id
      || !remoteUserId
      || !knownParticipant?.peerId
      || sameId(remoteUserId, localUser.id)
      || callsRef.current[remoteUserId]
    ) return;

    // Her ikisinin de aynı anda arama başlatmasını önlemek için yalnızca küçük
    // kullanıcı kimliğine sahip taraf aramayı başlatır.
    if (String(localUser.id) > remoteUserId) return;

    const call = currentPeer.call(knownParticipant.peerId, createOutgoingStream(), {
      metadata: {
        userId: String(localUser.id),
        channelId: String(activeChannel.id),
      },
    });

    if (call) attachCall(call, remoteUserId);
  };

  const reconnectCalls = () => {
    const participants = Object.values(participantsRef.current);
    closeAllCalls();
    participants.forEach(callParticipant);
  };

  const emitWithAck = (event, payload, timeout = 7000) => new Promise((resolve) => {
    const currentSocket = socketRef.current;
    if (!currentSocket?.connected) {
      resolve({ success: false, error: 'Sunucu bağlantısı kurulamadı.' });
      return;
    }

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result || { success: false, error: 'Sunucu yanıt vermedi.' });
    };
    const timer = window.setTimeout(() => finish({ success: false, error: 'Sunucu yanıt vermedi.' }), timeout);

    currentSocket.emit(event, payload, finish);
  });

  const notifyStreamChanged = async (channelId, payload) => {
    const result = await emitWithAck('voice:stream-changed', { channelId, ...payload });
    if (!result?.success) {
      setVoiceError(result?.error || 'Ses/yayın durumu doğrulanamadı.');
    }
    return result;
  };

  const releaseMicrophone = () => {
    stopStream(audioStreamRef.current);
    audioStreamRef.current = null;
    setMyStream(null);
  };

  const getCurrentVideoMode = () => {
    if (screenStreamRef.current?.getVideoTracks().some((track) => track.readyState === 'live')) return 'screen';
    if (cameraStreamRef.current?.getVideoTracks().some((track) => track.readyState === 'live')) return 'camera';
    return 'none';
  };

  const applyVoiceCapabilities = (capabilities) => {
    const next = normalizeCapabilities(capabilities);
    const previous = voiceCapabilitiesRef.current;
    voiceCapabilitiesRef.current = next;
    setVoiceCapabilities(next);
    setIsServerMuted(next.serverMuted);
    setIsServerDeafened(next.serverDeafened);

    let streamChanged = false;
    if (!next.canSpeak || next.serverMuted) {
      if (audioStreamRef.current) {
        releaseMicrophone();
        streamChanged = true;
      }
      isMutedRef.current = true;
      setIsMuted(true);
    }

    if (!next.canStream && (cameraStreamRef.current || screenStreamRef.current)) {
      stopStream(cameraStreamRef.current);
      stopStream(screenStreamRef.current);
      cameraStreamRef.current = null;
      screenStreamRef.current = null;
      setCameraStream(null);
      setScreenStream(null);
      streamChanged = true;
    }

    if (next.serverDeafened) {
      isDeafenedRef.current = true;
      applyDeafenState(true);
      setIsDeafened(true);
    }

    if (streamChanged && isInVoiceRef.current) {
      reconnectCalls();
      const activeChannel = activeVoiceChannelRef.current;
      if (activeChannel?.id && socketRef.current?.connected) {
        void notifyStreamChanged(activeChannel.id, { kind: 'video', mode: getCurrentVideoMode() });
      }
    }

    // Yetkiler değiştiğinde yalnızca gerçekten değişmişse sessizce güncelle.
    if (previous.channelId && !sameId(previous.channelId, next.channelId)) {
      setVoiceError('Ses kanalı yetkilerin güncellendi.');
    }

    return next;
  };

  const requestVoiceCapabilities = async (channelId) => {
    const result = await emitWithAck('voice:capabilities-request', { channelId });
    if (result?.capabilities) applyVoiceCapabilities(result.capabilities);
    return result;
  };

  const requestVoiceChannelMembers = (serverId) => {
    if (socketRef.current?.connected && serverId) {
      socketRef.current.emit('voice:members-request', { serverId });
    }
  };

  const ensureMicrophone = async ({ skipCapabilityRefresh = false } = {}) => {
    const activeChannel = activeVoiceChannelRef.current;
    if (!isInVoiceRef.current || !activeChannel?.id) return false;

    let capabilities = voiceCapabilitiesRef.current;
    if (!skipCapabilityRefresh) {
      const result = await requestVoiceCapabilities(activeChannel.id);
      if (!result?.success) {
        setVoiceError(result?.error || 'Ses yetkilerin doğrulanamadı.');
        return false;
      }
      capabilities = normalizeCapabilities(result.capabilities);
    }

    if (!capabilities.canSpeak) {
      setVoiceError('Bu ses kanalında konuşma yetkin yok. Dinleyici olarak bağlısın.');
      return false;
    }
    if (capabilities.serverMuted) {
      setVoiceError('Mikrofonun bir moderatör tarafından susturuldu.');
      return false;
    }

    if (hasLiveAudioTrack(audioStreamRef.current)) {
      audioStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMutedRef.current && (voiceModeRef.current !== 'push-to-talk' || pushToTalkActiveRef.current);
      });
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(inputDeviceIdRef.current ? { deviceId: { exact: inputDeviceIdRef.current } } : {}),
          echoCancellation: true,
          noiseSuppression: noiseSuppressionRef.current,
          autoGainControl: true,
        },
        video: false,
      });
      if (!isInVoiceRef.current || !sameId(activeVoiceChannelRef.current?.id, activeChannel.id)) {
        stopStream(stream);
        return false;
      }

      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMutedRef.current && (voiceModeRef.current !== 'push-to-talk' || pushToTalkActiveRef.current);
      });
      audioStreamRef.current = stream;
      setMyStream(stream);

      const result = await notifyStreamChanged(activeChannel.id, {
        kind: 'audio',
        enabled: !isMutedRef.current && (voiceModeRef.current !== 'push-to-talk' || pushToTalkActiveRef.current),
      });
      if (!result?.success) {
        releaseMicrophone();
        return false;
      }

      reconnectCalls();
      return true;
    } catch (error) {
      if (error.name !== 'NotAllowedError') {
        console.error('Mikrofon erişim hatası:', error);
      }
      setVoiceError('Mikrofon izni verilmedi veya mikrofon bulunamadı. Dinleyici olarak bağlı kalabilirsin.');
      return false;
    }
  };

  const ensureStreamPermission = async (channel) => {
    const result = await requestVoiceCapabilities(channel.id);
    const capabilities = normalizeCapabilities(result?.capabilities);
    if (!result?.success || !capabilities.canStream) {
      setVoiceError(result?.error || 'Bu ses kanalında yayın veya kamera açma yetkin yok.');
      return false;
    }
    return true;
  };

  const stopScreenShare = () => {
    const stream = screenStreamRef.current;
    if (!stream) return;

    stream.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    screenStreamRef.current = null;
    setScreenStream(null);
    reconnectCalls();

    const activeChannel = activeVoiceChannelRef.current;
    if (activeChannel?.id && socketRef.current?.connected) {
      void notifyStreamChanged(activeChannel.id, { kind: 'video', mode: getCurrentVideoMode() });
    }
  };

  const stopCamera = () => {
    const stream = cameraStreamRef.current;
    if (!stream) return;

    stream.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    cameraStreamRef.current = null;
    setCameraStream(null);
    reconnectCalls();

    const activeChannel = activeVoiceChannelRef.current;
    if (activeChannel?.id && socketRef.current?.connected) {
      void notifyStreamChanged(activeChannel.id, { kind: 'video', mode: getCurrentVideoMode() });
    }
  };

  const toggleCamera = async () => {
    const activeChannel = activeVoiceChannelRef.current;
    if (!isInVoiceRef.current || !activeChannel?.id) {
      setVoiceError('Kamerayı açmak için önce bir ses kanalına katıl.');
      return;
    }
    if (cameraStreamRef.current) {
      stopCamera();
      return;
    }
    if (!(await ensureStreamPermission(activeChannel))) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraDeviceIdRef.current ? { deviceId: { exact: cameraDeviceIdRef.current } } : true,
        audio: false,
      });
      if (!isInVoiceRef.current || !sameId(activeVoiceChannelRef.current?.id, activeChannel.id)) {
        stopStream(stream);
        return;
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) videoTrack.onended = stopCamera;
      cameraStreamRef.current = stream;
      setCameraStream(stream);

      const result = await notifyStreamChanged(activeChannel.id, {
        kind: 'video',
        mode: getCurrentVideoMode(),
      });
      if (!result?.success) {
        stopCamera();
        return;
      }
      reconnectCalls();
    } catch (error) {
      if (error.name !== 'NotAllowedError') console.error('Kamera erişim hatası:', error);
      setVoiceError('Kamera izni verilmedi veya kamera bulunamadı.');
    }
  };

  const toggleScreenShare = async () => {
    const activeChannel = activeVoiceChannelRef.current;
    if (!isInVoiceRef.current || !activeChannel?.id) {
      setVoiceError('Yayın açmak için önce bir ses kanalına katıl.');
      return;
    }
    if (screenStreamRef.current) {
      stopScreenShare();
      return;
    }
    if (!(await ensureStreamPermission(activeChannel))) return;

    try {
      const presets = {
        '720p30': { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
        '1080p30': { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } },
        '1080p60': { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 60 } },
      };
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: presets[screenSharePreset] || presets['1080p30'], audio: false });
      if (!isInVoiceRef.current || !sameId(activeVoiceChannelRef.current?.id, activeChannel.id)) {
        stopStream(stream);
        return;
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) videoTrack.onended = stopScreenShare;
      screenStreamRef.current = stream;
      setScreenStream(stream);

      const result = await notifyStreamChanged(activeChannel.id, {
        kind: 'video',
        mode: getCurrentVideoMode(),
      });
      if (!result?.success) {
        stopScreenShare();
        return;
      }
      reconnectCalls();
    } catch (error) {
      if (error.name !== 'NotAllowedError') {
        console.error('Ekran paylaşımı hatası:', error);
        setVoiceError('Ekran paylaşımı başlatılamadı.');
      }
    }
  };

  const leaveVoiceChannel = ({ notifyServer = true } = {}) => {
    const activeChannel = activeVoiceChannelRef.current;
    const currentSocket = socketRef.current;

    // Önce ref'leri temizlemek, geç kalan PeerJS çağrılarının cevaplanmasını engeller.
    activeVoiceChannelRef.current = null;
    isInVoiceRef.current = false;
    pendingVoiceJoinRef.current = null;
    joinInProgressRef.current = false;
    rejoiningRef.current = false;

    if (notifyServer && activeChannel?.id && currentSocket?.connected) {
      currentSocket.emit('voice:leave', { channelId: activeChannel.id });
    }

    closeAllCalls();
    participantsRef.current = {};
    setVoiceParticipants({});
    setSpeakingUserIds({});
    releaseMicrophone();
    stopStream(cameraStreamRef.current);
    stopStream(screenStreamRef.current);
    cameraStreamRef.current = null;
    screenStreamRef.current = null;
    setCameraStream(null);
    setScreenStream(null);
    isMutedRef.current = false;
    isDeafenedRef.current = false;
    setIsMuted(false);
    setIsDeafened(false);
    setIsServerMuted(false);
    setIsServerDeafened(false);
    voiceCapabilitiesRef.current = DEFAULT_CAPABILITIES;
    setVoiceCapabilities(DEFAULT_CAPABILITIES);
    setIsInVoice(false);
    setActiveVoiceChannel(null);
  };

  const joinVoiceChannel = async (channel) => {
    if (!channel?.id || joinInProgressRef.current) return;
    if (!socketRef.current?.connected) {
      setVoiceError('Sunucu bağlantısı kurulamadı. Tekrar dene.');
      return;
    }
    if (!peerIdRef.current) {
      setVoiceError('Ses altyapısı hazırlanıyor. Birkaç saniye sonra tekrar dene.');
      return;
    }
    if (sameId(activeVoiceChannelRef.current?.id, channel.id)) return;

    joinInProgressRef.current = true;
    try {
      if (activeVoiceChannelRef.current) leaveVoiceChannel();

      // Mikrofon izni istemeden önce sunucunun güncel CONNECT/SPEAK/STREAM
      // yetkisini imzalı socket oturumu üzerinden al.
      const preflight = await requestVoiceCapabilities(channel.id);
      const capabilities = normalizeCapabilities(preflight?.capabilities);
      if (!preflight?.success || !capabilities.canConnect) {
        setVoiceError(preflight?.error || 'Bu ses kanalına bağlanma yetkin yok.');
        return;
      }

      const localUser = userRef.current;
      const localParticipant = {
        userId: String(localUser.id),
        username: localUser.username,
        peerId: peerIdRef.current,
      };
      participantsRef.current = { [localParticipant.userId]: localParticipant };
      setVoiceParticipants({ [localParticipant.userId]: localParticipant });
      activeVoiceChannelRef.current = channel;
      isInVoiceRef.current = true;
      setActiveVoiceChannel(channel);
      setIsInVoice(true);
      isMutedRef.current = false;
      setIsMuted(false);
      setVoiceError('');
      pendingVoiceJoinRef.current = channel.id;

      const result = await emitWithAck('voice:join', {
        channelId: channel.id,
        peerId: peerIdRef.current,
      });
      pendingVoiceJoinRef.current = null;

      if (!result?.success) {
        setVoiceError(result?.error || 'Ses kanalına bağlanılamadı.');
        leaveVoiceChannel({ notifyServer: false });
        return;
      }

      const joinedCapabilities = applyVoiceCapabilities(result.capabilities || capabilities);
      if (joinedCapabilities.canSpeak && !joinedCapabilities.serverMuted && !isMutedRef.current) {
        await ensureMicrophone({ skipCapabilityRefresh: true });
      }
    } finally {
      joinInProgressRef.current = false;
    }
  };

  const rejoinActiveVoice = async () => {
    const activeChannel = activeVoiceChannelRef.current;
    if (!isInVoiceRef.current || !activeChannel?.id) return;
    if (rejoiningRef.current) return;
    if (!socketRef.current?.connected || !peerIdRef.current) {
      setVoiceError('Ses bağlantısı yeniden kurulamadı. Kanaldan ayrıldın.');
      leaveVoiceChannel({ notifyServer: false });
      return;
    }

    rejoiningRef.current = true;
    try {
      // Sunucu bağlantısı kesildiğinde uzaktaki katılımcılar eski WebRTC
      // çağrılarını kapatır. Buradaki eski çağrıları da temizleyip yeniden
      // gelen katılımcı anlık görüntüsünden deterministik olarak kurarız.
      closeAllCalls();
      const result = await emitWithAck('voice:join', {
        channelId: activeChannel.id,
        peerId: peerIdRef.current,
      });
      if (!result?.success) {
        setVoiceError(result?.error || 'Ses bağlantısı yeniden kurulamadı. Kanaldan ayrıldın.');
        leaveVoiceChannel({ notifyServer: false });
        return;
      }

      const capabilities = applyVoiceCapabilities(result.capabilities);
      if (capabilities.canSpeak && !capabilities.serverMuted && !isMutedRef.current && !hasLiveAudioTrack(audioStreamRef.current)) {
        await ensureMicrophone({ skipCapabilityRefresh: true });
      }
    } finally {
      rejoiningRef.current = false;
    }
  };

  const toggleMute = async () => {
    const capabilities = voiceCapabilitiesRef.current;
    if (!isInVoiceRef.current) return;
    if (!capabilities.canSpeak) {
      setVoiceError('Bu ses kanalında konuşma yetkin yok.');
      return;
    }
    if (capabilities.serverMuted) {
      setVoiceError('Mikrofonun bir moderatör tarafından susturuldu.');
      return;
    }

    const nextMuted = !isMutedRef.current;
    isMutedRef.current = nextMuted;
    setIsMuted(nextMuted);

    if (!nextMuted && !hasLiveAudioTrack(audioStreamRef.current)) {
      const started = await ensureMicrophone();
      if (!started) {
        isMutedRef.current = true;
        setIsMuted(true);
      }
      return;
    }

    audioStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted && (voiceModeRef.current !== 'push-to-talk' || pushToTalkActiveRef.current);
    });
  };

  const toggleDeafen = () => {
    if (voiceCapabilitiesRef.current.serverDeafened) {
      setVoiceError('Sağırlaştırman bir moderatör tarafından uygulanıyor.');
      return;
    }
    const nextDeafened = !isDeafenedRef.current;
    isDeafenedRef.current = nextDeafened;
    applyDeafenState(nextDeafened);
    setIsDeafened(nextDeafened);
  };

  const setVoiceMode = (mode) => {
    const normalized = mode === 'push-to-talk' ? 'push-to-talk' : 'activity';
    voiceModeRef.current = normalized;
    setVoiceModeState(normalized);
    if (normalized !== 'push-to-talk') {
      pushToTalkActiveRef.current = false;
      setIsPushToTalkActive(false);
    }
    audioStreamRef.current?.getAudioTracks().forEach(track => {
      track.enabled = !isMutedRef.current && (normalized !== 'push-to-talk' || pushToTalkActiveRef.current);
    });
  };

  const setPushToTalkKey = (key) => {
    if (!key) return;
    setPushToTalkKeyState(key);
  };

  const changeInputDevice = async (deviceId) => {
    inputDeviceIdRef.current = deviceId;
    setInputDeviceId(deviceId);
    if (!isInVoiceRef.current || !voiceCapabilitiesRef.current.canSpeak) return;
    releaseMicrophone();
    await ensureMicrophone({ skipCapabilityRefresh: true });
  };

  const changeCameraDevice = async (deviceId) => {
    cameraDeviceIdRef.current = deviceId;
    setCameraDeviceId(deviceId);
    if (cameraStreamRef.current) {
      stopCamera();
      await toggleCamera();
    }
  };

  const setNoiseSuppression = async (enabled) => {
    noiseSuppressionRef.current = Boolean(enabled);
    setNoiseSuppressionState(Boolean(enabled));
    if (!isInVoiceRef.current || !audioStreamRef.current) return;
    releaseMicrophone();
    await ensureMicrophone({ skipCapabilityRefresh: true });
  };

  // PeerJS nesnesi tüm ses oturumu boyunca tek kalır. Gelen çağrılar sadece
  // sunucunun aktif katılımcı olarak bildirdiği peer kimliğiyle eşleşirse yanıtlanır.
  useEffect(() => {
    if (!user?.id) return undefined;

    const newPeer = new Peer(undefined, PEER_CONFIG);
    peerRef.current = newPeer;

    newPeer.on('open', (id) => {
      const hadPeerId = peerIdRef.current;
      peerIdRef.current = id;
      setPeerId(id);
      setVoiceError('');

      // PeerJS bağlantısı yeniden oluşturulduysa, aktif ses kanalını yeni peerId
      // ile tekrar kaydet. Başarısız olursa yerel oturumu temizleriz.
      if (hadPeerId && isInVoiceRef.current && socketRef.current?.connected) {
        void rejoinActiveVoice();
      }
    });

    newPeer.on('call', (call) => {
      const activeChannel = activeVoiceChannelRef.current;
      const localUser = userRef.current;
      const remoteUserId = String(call.metadata?.userId || '');
      const remoteChannelId = String(call.metadata?.channelId || '');
      const participant = participantsRef.current[remoteUserId];
      const isVerifiedParticipant = Boolean(
        isInVoiceRef.current
          && activeChannel?.id
          && remoteUserId
          && !sameId(remoteUserId, localUser?.id)
          && sameId(remoteChannelId, activeChannel.id)
          && participant?.peerId
          && sameId(participant.peerId, call.peer),
      );

      if (!isVerifiedParticipant) {
        // PeerJS çağrısı aktif kanal/katılımcı doğrulamasından geçmediyse medya
        // akışını hiç cevaplamadan kapatılır.
        call.close();
        return;
      }

      call.answer(createOutgoingStream());
      attachCall(call, remoteUserId);
    });

    newPeer.on('error', (error) => {
      console.error('PeerJS hatası:', error);
      setVoiceError(`Ses sunucusuna bağlanılamadı (${error.type || 'bilinmeyen hata'}).`);
    });

    return () => {
      if (peerRef.current === newPeer) peerRef.current = null;
      if (peerIdRef.current === newPeer.id) {
        peerIdRef.current = null;
        setPeerId(null);
      }
      newPeer.destroy();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleUserJoined = (participant) => {
      const activeChannel = activeVoiceChannelRef.current;
      if (!participant?.userId || !participant?.peerId) return;
      if (participant.channelId && !sameId(participant.channelId, activeChannel?.id)) return;

      const userId = String(participant.userId);
      const previousPeerId = participantsRef.current[userId]?.peerId;
      addVoiceParticipant(participant);
      if (previousPeerId && !sameId(previousPeerId, participant.peerId)) {
        callsRef.current[userId]?.close();
        delete callsRef.current[userId];
      }
      callParticipant(participant);
    };

    const handleExistingUsers = (payload) => {
      const participants = Array.isArray(payload) ? payload : payload?.participants;
      const channelId = Array.isArray(payload) ? null : payload?.channelId;
      if (!Array.isArray(participants)) return;
      if (channelId && !sameId(channelId, activeVoiceChannelRef.current?.id)) return;

      pendingVoiceJoinRef.current = null;
      participants.forEach((participant) => {
        if (!participant?.userId || !participant?.peerId) return;
        const userId = String(participant.userId);
        const previousPeerId = participantsRef.current[userId]?.peerId;
        addVoiceParticipant(participant);
        if (previousPeerId && !sameId(previousPeerId, participant.peerId)) {
          callsRef.current[userId]?.close();
          delete callsRef.current[userId];
        }
        callParticipant(participant);
      });
    };

    const handleUserLeft = ({ userId, channelId } = {}) => {
      if (channelId && !sameId(channelId, activeVoiceChannelRef.current?.id)) return;
      const normalizedUserId = String(userId || '');
      callsRef.current[normalizedUserId]?.close();
      delete callsRef.current[normalizedUserId];
      removeRemoteUser(normalizedUserId);
      removeVoiceParticipant(normalizedUserId);
    };

    const handleStreamChanged = ({ userId, channelId } = {}) => {
      if (channelId && !sameId(channelId, activeVoiceChannelRef.current?.id)) return;
      const normalizedUserId = String(userId || '');
      const participant = participantsRef.current[normalizedUserId];
      if (!participant) return;

      callsRef.current[normalizedUserId]?.close();
      delete callsRef.current[normalizedUserId];
      callParticipant(participant);
    };

    const handleChannelMembers = ({ channelId, members } = {}) => {
      if (!channelId || !Array.isArray(members)) return;
      setVoiceChannelMembers((previous) => ({ ...previous, [channelId]: members }));
    };

    const handleChannelsSnapshot = ({ channels } = {}) => {
      if (!Array.isArray(channels)) return;
      setVoiceChannelMembers((previous) => {
        const updated = { ...previous };
        channels.forEach(({ channelId, members }) => {
          if (channelId && Array.isArray(members)) updated[channelId] = members;
        });
        return updated;
      });
    };

    const handleCapabilities = (capabilities = {}) => {
      if (!sameId(capabilities.channelId, activeVoiceChannelRef.current?.id)) return;
      applyVoiceCapabilities(capabilities);
    };

    const handleModerationState = (state = {}) => {
      if (state.channelId && !sameId(state.channelId, activeVoiceChannelRef.current?.id)) return;
      applyVoiceCapabilities({ ...voiceCapabilitiesRef.current, ...state });
    };

    const handleVoiceError = ({ message } = {}) => {
      setVoiceError(message || 'Ses kanalına bağlanılamadı.');
      if (pendingVoiceJoinRef.current) {
        pendingVoiceJoinRef.current = null;
        leaveVoiceChannelRef.current({ notifyServer: false });
      }
    };

    const handleModerated = ({ action, byUsername, serverId, state } = {}) => {
      const activeChannel = activeVoiceChannelRef.current;
      if (serverId && activeChannel?.serverId && !sameId(serverId, activeChannel.serverId)) return;

      if (action === 'mute') {
        applyVoiceCapabilities({ ...voiceCapabilitiesRef.current, ...state, serverMuted: true });
        setVoiceError(`${byUsername || 'Bir moderatör'} mikrofonunu susturdu.`);
      }
      if (action === 'deafen') {
        applyVoiceCapabilities({ ...voiceCapabilitiesRef.current, ...state, serverDeafened: true });
        setVoiceError(`${byUsername || 'Bir moderatör'} seni sağırlaştırdı.`);
      }
      if (action === 'unmute') {
        applyVoiceCapabilities({ ...voiceCapabilitiesRef.current, ...state, serverMuted: false });
        setVoiceError(`${byUsername || 'Bir moderatör'} mikrofonunun sesini açtı.`);
      }
      if (action === 'undeafen') {
        applyVoiceCapabilities({ ...voiceCapabilitiesRef.current, ...state, serverDeafened: false });
        isDeafenedRef.current = false;
        applyDeafenState(false);
        setIsDeafened(false);
        setVoiceError(`${byUsername || 'Bir moderatör'} sağırlaştırmayı kaldırdı.`);
      }
      if (action === 'disconnect') {
        setVoiceError(`${byUsername || 'Bir moderatör'} seni ses kanalından çıkardı.`);
        leaveVoiceChannelRef.current({ notifyServer: false });
      }
    };

    const refreshOwnCapabilities = ({ serverId, member } = {}) => {
      const activeChannel = activeVoiceChannelRef.current;
      if (!activeChannel?.id || !sameId(serverId, activeChannel.serverId)) return;
      if (member?.id && !sameId(member.id, userRef.current?.id)) return;
      void requestVoiceCapabilities(activeChannel.id);
    };

    const handleRolesChanged = ({ serverId } = {}) => refreshOwnCapabilities({ serverId });

    const handleSocketConnect = () => {
      if (!isInVoiceRef.current) return;
      if (!peerIdRef.current) {
        setVoiceError('Ses altyapısı hazır olmadığı için kanaldan ayrıldın.');
        leaveVoiceChannelRef.current({ notifyServer: false });
        return;
      }
      void rejoinActiveVoice();
    };

    const handleSocketDisconnect = () => {
      if (isInVoiceRef.current) setVoiceError('Sunucu bağlantısı kesildi; ses bağlantısı yeniden kuruluyor…');
    };

    socket.on('voice:user-joined', handleUserJoined);
    socket.on('voice:existing-users', handleExistingUsers);
    socket.on('voice:user-left', handleUserLeft);
    socket.on('voice:stream-changed', handleStreamChanged);
    socket.on('voice:channel-members', handleChannelMembers);
    socket.on('voice:channels-snapshot', handleChannelsSnapshot);
    socket.on('voice:capabilities', handleCapabilities);
    socket.on('voice:moderation-state', handleModerationState);
    socket.on('voice:error', handleVoiceError);
    socket.on('voice:moderated', handleModerated);
    socket.on('server:member-updated', refreshOwnCapabilities);
    socket.on('roles:changed', handleRolesChanged);
    socket.on('connect', handleSocketConnect);
    socket.on('disconnect', handleSocketDisconnect);

    return () => {
      socket.off('voice:user-joined', handleUserJoined);
      socket.off('voice:existing-users', handleExistingUsers);
      socket.off('voice:user-left', handleUserLeft);
      socket.off('voice:stream-changed', handleStreamChanged);
      socket.off('voice:channel-members', handleChannelMembers);
      socket.off('voice:channels-snapshot', handleChannelsSnapshot);
      socket.off('voice:capabilities', handleCapabilities);
      socket.off('voice:moderation-state', handleModerationState);
      socket.off('voice:error', handleVoiceError);
      socket.off('voice:moderated', handleModerated);
      socket.off('server:member-updated', refreshOwnCapabilities);
      socket.off('roles:changed', handleRolesChanged);
      socket.off('connect', handleSocketConnect);
      socket.off('disconnect', handleSocketDisconnect);
    };
  }, [socket]);

  useEffect(() => {
    if (!isInVoice || !user?.id) {
      setSpeakingUserIds({});
      return undefined;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return undefined;

    const audioContext = new AudioContextClass();
    const sources = [
      ...(audioStreamRef.current ? [{ userId: String(user.id), stream: audioStreamRef.current }] : []),
      ...Object.entries(remoteStreams).map(([userId, stream]) => ({ userId, stream })),
    ];
    const analyzers = [];
    const speakingUntil = new Map();
    let animationFrameId;

    sources.forEach(({ userId, stream }) => {
      if (!stream.getAudioTracks().length) return;
      try {
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        analyzers.push({ userId, analyser, data: new Uint8Array(analyser.frequencyBinCount) });
      } catch (error) {
        console.warn('Konuşma algılama başlatılamadı:', error);
      }
    });

    const updateSpeakingUsers = () => {
      const now = Date.now();
      const nextSpeakingUsers = {};
      analyzers.forEach(({ userId, analyser, data }) => {
        analyser.getByteFrequencyData(data);
        const averageVolume = data.reduce((total, value) => total + value, 0) / data.length;
        if (averageVolume > 12) speakingUntil.set(userId, now + 450);
        if ((speakingUntil.get(userId) || 0) > now) nextSpeakingUsers[userId] = true;
      });

      setSpeakingUserIds((previous) => {
        const previousIds = Object.keys(previous);
        const nextIds = Object.keys(nextSpeakingUsers);
        const isSame = previousIds.length === nextIds.length && nextIds.every((id) => previous[id]);
        return isSame ? previous : nextSpeakingUsers;
      });
      animationFrameId = requestAnimationFrame(updateSpeakingUsers);
    };

    audioContext.resume().catch(() => {});
    updateSpeakingUsers();
    return () => {
      cancelAnimationFrame(animationFrameId);
      audioContext.close().catch(() => {});
    };
  }, [isInVoice, myStream, remoteStreams, user?.id]);

  // Dinleyici ilkesi: CONNECT olan ama SPEAK olmayan üye kanala katılır; ses
  // kaynağı istenmez ve panelde konuşma/yayın tuşları pasif görünür.
  leaveVoiceChannelRef.current = leaveVoiceChannel;

  return (
    <VoiceContext.Provider
      value={{
        isInVoice,
        activeVoiceChannel,
        myStream,
        cameraStream,
        screenStream,
        remoteStreams,
        voiceChannelMembers,
        requestVoiceChannelMembers,
        voiceParticipants: Object.values(voiceParticipants),
        speakingUserIds,
        peers: remoteStreams,
        isMuted,
        isDeafened,
        isServerMuted,
        isServerDeafened,
        canSpeak: voiceCapabilities.canSpeak,
        canStream: voiceCapabilities.canStream,
        voiceCapabilities,
        isScreenSharing: Boolean(screenStream),
        isCameraOn: Boolean(cameraStream),
        voiceError,
        availableDevices,
        inputDeviceId,
        outputDeviceId,
        cameraDeviceId,
        voiceMode,
        pushToTalkKey,
        isPushToTalkActive,
        noiseSuppression,
        screenSharePreset,
        joinVoiceChannel,
        leaveVoiceChannel,
        toggleMute,
        toggleDeafen,
        toggleScreenShare,
        toggleCamera,
        changeInputDevice,
        setOutputDeviceId,
        changeCameraDevice,
        setVoiceMode,
        setPushToTalkKey,
        setNoiseSuppression,
        setScreenSharePreset,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
};
