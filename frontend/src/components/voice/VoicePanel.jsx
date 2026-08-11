import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, MonitorUp, Music, PhoneOff, Settings, Video, VideoOff, Volume2, VolumeX, X } from 'lucide-react';
import { useVoice } from '../../context/VoiceContext';
import { useSocket } from '../../context/SocketContext';
import VideoGrid from './VideoGrid';

function RemoteAudio({ stream, muted, outputDeviceId }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.srcObject = stream;
    audioRef.current.play().catch(() => {});
  }, [stream]);

  useEffect(() => {
    if (!audioRef.current || !outputDeviceId || typeof audioRef.current.setSinkId !== 'function') return;
    audioRef.current.setSinkId(outputDeviceId).catch(() => {});
  }, [outputDeviceId]);

  return <audio ref={audioRef} autoPlay playsInline muted={muted} />;
}

function playSynthSound(soundId) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const audioContext = new AudioContextClass();
  const patterns = {
    tada: [[523, 0], [659, 0.12], [784, 0.24], [1046, 0.38]],
    alert: [[880, 0], [440, 0.16], [880, 0.32]],
    levelup: [[392, 0], [523, 0.1], [659, 0.2], [784, 0.3]],
    boop: [[740, 0], [520, 0.12]],
  };
  const notes = patterns[soundId] || patterns.boop;
  notes.forEach(([frequency, offset], index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = soundId === 'alert' ? 'square' : 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + offset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + offset + 0.16);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(audioContext.currentTime + offset);
    oscillator.stop(audioContext.currentTime + offset + 0.18);
    if (index === notes.length - 1) oscillator.onended = () => audioContext.close().catch(() => {});
  });
}

export default function VoicePanel() {
  const [showSettings, setShowSettings] = useState(false);
  const [stageRequested, setStageRequested] = useState(false);
  const [showSoundboard, setShowSoundboard] = useState(false);
  const { socket } = useSocket();
  const {
    isInVoice,
    activeVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleDeafen,
    toggleScreenShare,
    toggleCamera,
    isMuted,
    isDeafened,
    isScreenSharing,
    isCameraOn,
    remoteStreams,
    canSpeak,
    canStream,
    isServerMuted,
    isServerDeafened,
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
    changeInputDevice,
    setOutputDeviceId,
    changeCameraDevice,
    setVoiceMode,
    setPushToTalkKey,
    setNoiseSuppression,
    setScreenSharePreset,
  } = useVoice();

  useEffect(() => {
    if (!socket || !activeVoiceChannel?.id) return undefined;
    const play = payload => {
      if (!payload?.channelId || payload.channelId === activeVoiceChannel.id) playSynthSound(payload.soundId);
    };
    socket.on('voice:soundboard:play', play);
    return () => socket.off('voice:soundboard:play', play);
  }, [activeVoiceChannel?.id, socket]);

  if (!isInVoice || !activeVoiceChannel) return null;

  const isStage = activeVoiceChannel.type === 'stage';
  const requestToSpeak = () => {
    socket?.emit('voice:stage:request-to-speak', { channelId: activeVoiceChannel.id }, result => {
      if (result?.success) setStageRequested(true);
    });
  };

  const playSoundboard = soundId => {
    playSynthSound(soundId);
    socket?.emit('voice:soundboard:play', { channelId: activeVoiceChannel.id, soundId }, result => {
      if (result && !result.success) setShowSoundboard(false);
    });
  };

  const hasRemoteVideo = Object.values(remoteStreams).some(
    stream => stream.getVideoTracks().length > 0,
  );

  return (
    <section className="shrink-0 border-t border-white/[0.06] bg-[#151b27] p-4">
      {Object.entries(remoteStreams).map(([userId, stream]) => (
        <RemoteAudio key={userId} stream={stream} muted={isDeafened} outputDeviceId={outputDeviceId} />
      ))}

      {(isScreenSharing || isCameraOn || hasRemoteVideo) && <VideoGrid />}

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-[#34d399]">Ses bağlantısı kuruldu</div>
          <div className="truncate text-[12px] text-[#94a3b8]">{activeVoiceChannel.name}</div>
          {!canSpeak && <div className="mt-1 text-[11px] text-[#fbbf24]">Dinleyici modu — konuşma yetkin yok</div>}
          {canSpeak && voiceMode === 'push-to-talk' && <div className={`mt-1 text-[11px] ${isPushToTalkActive ? 'font-bold text-[#34d399]' : 'text-[#fbbf24]'}`}>{isPushToTalkActive ? 'Konuşuyorsun' : `${pushToTalkKey} tuşuna basılı tut`}</div>}
          {isStage && !canSpeak && <button type="button" disabled={stageRequested} onClick={requestToSpeak} className="mt-1 text-[11px] font-semibold text-[#60a5fa] hover:underline disabled:text-[#fbbf24] disabled:no-underline">{stageRequested ? 'Söz isteğin gönderildi' : 'Söz iste'}</button>}
          {voiceError && <div className="mt-1 text-[11px] text-[#fca5a5]">{voiceError}</div>}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSettings(show => !show)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${showSettings ? 'bg-[#2563eb] text-white' : 'bg-white/[0.07] text-[#cbd5e1] hover:bg-white/[0.12]'}`}
            title="Ses ayarları"
          >
            <Settings className="h-4 w-4" />
          </button>

          <div className="relative">
            <button type="button" onClick={() => setShowSoundboard(show => !show)} className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${showSoundboard ? 'bg-[#7c3aed] text-white' : 'bg-white/[0.07] text-[#cbd5e1] hover:bg-white/[0.12]'}`} title="Ses tahtası"><Music className="h-4 w-4" /></button>
            {showSoundboard && <div className="absolute bottom-12 right-0 z-50 grid w-48 grid-cols-2 gap-1 rounded-xl border border-white/[0.09] bg-[#0f172a] p-2 shadow-2xl">{[['tada', '🎉 Kutlama'], ['alert', '🚨 Uyarı'], ['levelup', '⭐ Seviye'], ['boop', '🔔 Boop']].map(([id, label]) => <button key={id} type="button" onClick={() => playSoundboard(id)} className="rounded-lg bg-white/[0.05] px-2 py-2 text-xs font-semibold text-[#cbd5e1] hover:bg-white/[0.1] hover:text-white">{label}</button>)}</div>}
          </div>

          <button
            type="button"
            onClick={toggleMute}
            disabled={!canSpeak || isServerMuted}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${isMuted ? 'bg-[#ef4444] text-white' : 'bg-white/[0.07] text-[#cbd5e1] hover:bg-white/[0.12]'}`}
            title={!canSpeak ? 'Konuşma yetkin yok' : isServerMuted ? 'Mikrofonun moderatör tarafından susturuldu' : isMuted ? 'Mikrofonu aç' : 'Mikrofonu kapat'}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={toggleDeafen}
            disabled={isServerDeafened}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${isDeafened ? 'bg-[#ef4444] text-white' : 'bg-white/[0.07] text-[#cbd5e1] hover:bg-white/[0.12]'}`}
            title={isServerDeafened ? 'Sağırlaştırma moderatör tarafından uygulandı' : isDeafened ? 'Sesi aç' : 'Kulaklığı sustur'}
          >
            {isDeafened ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={toggleScreenShare}
            disabled={!canStream && !isScreenSharing}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${isScreenSharing ? 'bg-[#2563eb] text-white' : 'bg-white/[0.07] text-[#cbd5e1] hover:bg-white/[0.12]'}`}
            title={!canStream && !isScreenSharing ? 'Yayın açma yetkin yok' : isScreenSharing ? 'Yayını durdur' : 'Ekranını paylaş'}
          >
            <MonitorUp className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggleCamera}
            disabled={!canStream && !isCameraOn}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${isCameraOn ? 'bg-[#2563eb] text-white' : 'bg-white/[0.07] text-[#cbd5e1] hover:bg-white/[0.12]'}`}
            title={!canStream && !isCameraOn ? 'Kamera açma yetkin yok' : isCameraOn ? 'Kamerayı kapat' : 'Kamerayı aç'}
          >
            {isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={leaveVoiceChannel}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ef4444] text-white transition-colors hover:bg-[#dc2626]"
            title="Ses kanalından ayrıl"
          >
            <PhoneOff className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="relative mt-4 rounded-xl border border-white/[0.08] bg-[#0f172a] p-4">
          <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-bold text-white">Ses ve görüntü</h3><p className="text-[10px] text-[#64748b]">Değişiklikler aktif aramaya uygulanır.</p></div><button type="button" onClick={() => setShowSettings(false)} className="rounded p-1 text-[#94a3b8] hover:bg-white/[0.07] hover:text-white"><X className="h-4 w-4" /></button></div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-[10px] font-bold uppercase text-[#64748b]">Giriş aygıtı<select value={inputDeviceId} onChange={event => changeInputDevice(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[#151d2c] px-2 py-2 text-xs text-[#cbd5e1] outline-none"><option value="">Sistem varsayılanı</option>{availableDevices.audioinput.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Mikrofon ${index + 1}`}</option>)}</select></label>
            <label className="text-[10px] font-bold uppercase text-[#64748b]">Çıkış aygıtı<select value={outputDeviceId} onChange={event => setOutputDeviceId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[#151d2c] px-2 py-2 text-xs text-[#cbd5e1] outline-none"><option value="">Sistem varsayılanı</option>{availableDevices.audiooutput.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Hoparlör ${index + 1}`}</option>)}</select></label>
            <label className="text-[10px] font-bold uppercase text-[#64748b]">Kamera<select value={cameraDeviceId} onChange={event => changeCameraDevice(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[#151d2c] px-2 py-2 text-xs text-[#cbd5e1] outline-none"><option value="">Sistem varsayılanı</option>{availableDevices.videoinput.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Kamera ${index + 1}`}</option>)}</select></label>
            <label className="text-[10px] font-bold uppercase text-[#64748b]">Giriş modu<select value={voiceMode} onChange={event => setVoiceMode(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[#151d2c] px-2 py-2 text-xs text-[#cbd5e1] outline-none"><option value="activity">Ses etkinliği</option><option value="push-to-talk">Bas konuş</option></select></label>
            {voiceMode === 'push-to-talk' && <label className="text-[10px] font-bold uppercase text-[#64748b]">Bas-konuş tuşu<input readOnly value={pushToTalkKey} onKeyDown={event => { event.preventDefault(); setPushToTalkKey(event.code); }} className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[#151d2c] px-2 py-2 text-center text-xs font-bold text-[#cbd5e1] outline-none focus:border-[#3b82f6]" title="Alanı seçip istediğin tuşa bas" /></label>}
            <label className="flex items-center justify-between rounded-lg bg-[#151d2c] px-3 py-2 text-xs text-[#cbd5e1]"><span>Gürültü azaltma</span><input type="checkbox" checked={noiseSuppression} onChange={event => setNoiseSuppression(event.target.checked)} /></label>
            <label className="text-[10px] font-bold uppercase text-[#64748b]">Yayın kalitesi<select value={screenSharePreset} onChange={event => setScreenSharePreset(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[#151d2c] px-2 py-2 text-xs text-[#cbd5e1] outline-none"><option value="720p30">720p / 30 FPS</option><option value="1080p30">1080p / 30 FPS</option><option value="1080p60">1080p / 60 FPS</option></select></label>
          </div>
        </div>
      )}
    </section>
  );
}
