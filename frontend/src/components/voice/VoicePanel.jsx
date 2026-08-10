import { useEffect, useRef } from 'react';
import { Mic, MicOff, MonitorUp, PhoneOff, Video, VideoOff, Volume2, VolumeX } from 'lucide-react';
import { useVoice } from '../../context/VoiceContext';
import VideoGrid from './VideoGrid';

function RemoteAudio({ stream, muted }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.srcObject = stream;
    audioRef.current.play().catch(() => {});
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline muted={muted} />;
}

export default function VoicePanel() {
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
  } = useVoice();

  if (!isInVoice || !activeVoiceChannel) return null;

  const hasRemoteVideo = Object.values(remoteStreams).some(
    stream => stream.getVideoTracks().length > 0,
  );

  return (
    <section className="shrink-0 border-t border-white/[0.06] bg-[#151b27] p-4">
      {Object.entries(remoteStreams).map(([userId, stream]) => (
        <RemoteAudio key={userId} stream={stream} muted={isDeafened} />
      ))}

      {(isScreenSharing || isCameraOn || hasRemoteVideo) && <VideoGrid />}

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-[#34d399]">Ses bağlantısı kuruldu</div>
          <div className="truncate text-[12px] text-[#94a3b8]">{activeVoiceChannel.name}</div>
          {!canSpeak && <div className="mt-1 text-[11px] text-[#fbbf24]">Dinleyici modu — konuşma yetkin yok</div>}
          {voiceError && <div className="mt-1 text-[11px] text-[#fca5a5]">{voiceError}</div>}
        </div>

        <div className="flex items-center gap-2">
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
    </section>
  );
}
