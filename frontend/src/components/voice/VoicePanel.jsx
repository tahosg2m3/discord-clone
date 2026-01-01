// frontend/src/components/voice/VoicePanel.jsx
import { Mic, MicOff, Headphones, MonitorUp, MonitorOff, Video, VideoOff, PhoneOff, Maximize2 } from 'lucide-react';
import { useVoice } from '../../context/VoiceContext';
import { useState, useEffect, useRef } from 'react';
import VideoGrid from './VideoGrid';

// SESLERİN HER ZAMAN GELMESİ İÇİN GİZLİ BİLEŞEN
const HiddenAudioPlayer = ({ streams, isDeafened }) => {
  return (
    <div style={{ display: 'none' }}>
      {Object.entries(streams).map(([userId, stream]) => (
        <AudioStream key={userId} stream={stream} isDeafened={isDeafened} />
      ))}
    </div>
  );
};

// Tekil ses akışı bileşeni
const AudioStream = ({ stream, isDeafened }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isDeafened;
    }
  }, [isDeafened]);

  return <audio ref={audioRef} autoPlay />;
};

export default function VoicePanel() {
  const {
    inVoiceChannel,
    isMuted,
    isDeafened,
    isSharingScreen,
    isCameraOn,
    connectedUsers,
    remoteStreams, // Gelen yayınlar
    toggleMute,
    toggleDeafen,
    toggleCamera,
    shareScreen,
    stopScreenShare,
    leaveVoiceChannel,
  } = useVoice();

  const [showVideoGrid, setShowVideoGrid] = useState(false);

  // Eğer karşıdan görüntü gelirse veya biz açarsak gridi otomatik göster (isteğe bağlı)
  useEffect(() => {
    if (isCameraOn || isSharingScreen || Object.keys(remoteStreams).length > 0) {
      // Burayı true yaparsan otomatik açılır, şu an manuel bıraktım
      // setShowVideoGrid(true); 
    }
  }, [isCameraOn, isSharingScreen, remoteStreams]);

  if (!inVoiceChannel) return null;

  // Gelen yayın var mı? (Ses veya Video)
  const hasRemoteStreams = Object.keys(remoteStreams).length > 0;
  const canShowGrid = isCameraOn || isSharingScreen || hasRemoteStreams;

  return (
    <>
      {/* GİZLİ SES OYNATICI: Video kapalıyken bile sesi garanti eder */}
      <HiddenAudioPlayer streams={remoteStreams} isDeafened={isDeafened} />

      <div className="bg-gray-900 border-t border-gray-800 p-4">
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
            Voice Channel ({connectedUsers.length + 1})
          </h3>
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-gray-300">You</span>
            </div>
            {connectedUsers.map((user) => (
              <div key={user.userId} className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-gray-300">{user.username}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between space-x-2">
          <div className="flex space-x-2">
            {/* Mute */}
            <button
              onClick={toggleMute}
              className={`p-2 rounded-lg transition-colors ${
                isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Deafen */}
            <button
              onClick={toggleDeafen}
              className={`p-2 rounded-lg transition-colors ${
                isDeafened ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={isDeafened ? 'Undeafen' : 'Deafen'}
            >
              <Headphones className="w-5 h-5" />
            </button>

            {/* Camera */}
            <button
              onClick={toggleCamera}
              className={`p-2 rounded-lg transition-colors ${
                isCameraOn ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            {/* Screen Share */}
            <button
              onClick={isSharingScreen ? stopScreenShare : shareScreen}
              className={`p-2 rounded-lg transition-colors ${
                isSharingScreen ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={isSharingScreen ? 'Stop Sharing' : 'Share Screen'}
            >
              {isSharingScreen ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
            </button>

            {/* Video Grid Toggle - Artık yayın varsa aktif */}
            {canShowGrid && (
              <button
                onClick={() => setShowVideoGrid(!showVideoGrid)}
                className={`p-2 rounded-lg transition-colors ${
                    showVideoGrid ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
                title="Toggle Video Grid"
              >
                <Maximize2 className="w-5 h-5" />
              </button>
            )}
          </div>

          <button
            onClick={leaveVoiceChannel}
            className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            title="Leave Voice"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showVideoGrid && canShowGrid && (
        <VideoGrid onClose={() => setShowVideoGrid(false)} />
      )}
    </>
  );
}