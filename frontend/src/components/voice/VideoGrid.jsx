// frontend/src/components/voice/VideoGrid.jsx
import { useEffect, useRef } from 'react';
import { useVoice } from '../../context/VoiceContext';

const VideoPlayer = ({ stream, userId, isDeafened }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // isDeafened true ise sesi kapat
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isDeafened;
    }
  }, [isDeafened]);

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video shadow-lg">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-xs">
        User: {userId}
      </div>
    </div>
  );
};

export default function VideoGrid() {
  const { remoteStreams, isDeafened } = useVoice();

  if (remoteStreams.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-800 border-b border-gray-700">
      {remoteStreams.map((data) => (
        <VideoPlayer
          key={data.userId}
          userId={data.userId}
          stream={data.stream}
          isDeafened={isDeafened}
        />
      ))}
    </div>
  );
}