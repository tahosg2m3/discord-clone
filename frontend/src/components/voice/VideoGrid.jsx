// frontend/src/components/voice/VideoGrid.jsx
import { useEffect, useRef, useState } from 'react';
import { useVoice } from '../../context/VoiceContext';
import { Maximize2, Minimize2, X } from 'lucide-react';

const VideoPlayer = ({ stream, userId, isDeafened, onClick, isMaximized, isLocal }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // isDeafened true ise ve yayın yerel değilse sesi kapat
  useEffect(() => {
    if (videoRef.current) {
      // Kendi sesimizi duymak istemeyiz, o yüzden local ise muted=true
      if (isLocal) {
        videoRef.current.muted = true;
      } else {
        videoRef.current.muted = isDeafened;
      }
    }
  }, [isDeafened, isLocal]);

  return (
    <div 
      onClick={onClick}
      className={`relative bg-black rounded-lg overflow-hidden shadow-lg group cursor-pointer transition-all
        ${isMaximized ? 'fixed inset-4 z-50 border-2 border-blue-500' : 'aspect-video hover:ring-2 hover:ring-blue-500'}
      `}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full ${isMaximized ? 'object-contain' : 'object-cover'}`}
      />
      
      {/* Kullanıcı Adı */}
      <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-white text-xs backdrop-blur-sm">
        {userId} {isLocal ? '(You)' : ''}
      </div>

      {/* Büyütme İkonu */}
      {!isMaximized && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 p-1 rounded text-white">
            <Maximize2 className="w-4 h-4" />
        </div>
      )}
      
      {/* Küçültme İkonu */}
      {isMaximized && (
        <div className="absolute top-2 right-2 bg-black/50 p-2 rounded-full text-white hover:bg-black/70">
            <Minimize2 className="w-6 h-6" />
        </div>
      )}
    </div>
  );
};

export default function VideoGrid({ onClose }) {
  const { remoteStreams, localStream, isDeafened, isCameraOn, isSharingScreen } = useVoice();
  const [maximizedUser, setMaximizedUser] = useState(null);

  // Gösterilecek bir şey var mı? (Kamera açık mı, Ekran paylaşımı var mı veya karşıdan yayın var mı?)
  const shouldShowLocal = localStream && (isCameraOn || isSharingScreen);
  const hasRemote = Object.keys(remoteStreams).length > 0;

  if (!shouldShowLocal && !hasRemote) return null;

  const toggleMaximize = (id) => {
    setMaximizedUser(maximizedUser === id ? null : id);
  };

  return (
    <div className="relative bg-gray-800 p-4 border-b border-gray-700 min-h-[200px] flex flex-col">
        {onClose && (
            <button 
                onClick={onClose}
                className="absolute top-2 right-2 z-10 p-1 bg-black/50 text-white rounded hover:bg-black/70"
            >
                <X className="w-5 h-5" />
            </button>
        )}
        
        <h3 className="text-gray-400 text-xs uppercase font-bold mb-3">Video / Screenshare</h3>

        <div className={`grid gap-4 ${maximizedUser ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
            
            {/* Kendi Yayınımız */}
            {shouldShowLocal && (
                 <VideoPlayer
                    key="local"
                    userId="You"
                    stream={localStream}
                    isDeafened={isDeafened}
                    isLocal={true}
                    onClick={() => toggleMaximize('local')}
                    isMaximized={maximizedUser === 'local'}
                 />
            )}

            {/* Diğer Yayınlar */}
            {Object.entries(remoteStreams).map(([userId, stream]) => {
                if (maximizedUser && maximizedUser !== userId) return null;

                return (
                    <VideoPlayer
                        key={userId}
                        userId={userId}
                        stream={stream}
                        isDeafened={isDeafened}
                        isLocal={false}
                        onClick={() => toggleMaximize(userId)}
                        isMaximized={maximizedUser === userId}
                    />
                );
            })}
        </div>
    </div>
  );
}