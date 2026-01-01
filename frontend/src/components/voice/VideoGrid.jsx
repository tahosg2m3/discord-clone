import { useEffect, useRef } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { useVoice } from '../../context/VoiceContext';
import { useState } from 'react';

export default function VideoGrid({ onClose }) {
  const { localStream, remoteStreams, connectedUsers, isDeafened } = useVoice();
  const [fullscreenUserId, setFullscreenUserId] = useState(null);

  const VideoTile = ({ stream, userId, username, isLocal }) => {
    const videoRef = useRef(null);
    const isFullscreen = fullscreenUserId === userId;

    useEffect(() => {
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        if (!isLocal) {
          videoRef.current.muted = isDeafened;
        }
      }
    }, [stream, isDeafened]);

    return (
      <div
        className={`relative bg-gray-900 rounded-lg overflow-hidden group ${
          isFullscreen ? 'col-span-full row-span-full' : ''
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
        
        <div className="absolute bottom-2 left-2 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
          {username || 'You'}
        </div>

        <button
          onClick={() => setFullscreenUserId(isFullscreen ? null : userId)}
          className="absolute top-2 right-2 p-2 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 bg-gray-900">
        <h2 className="text-white text-lg font-semibold">Video Chat</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      <div className="flex-1 p-4 grid grid-cols-2 md:grid-cols-3 gap-4 overflow-auto">
        {localStream && (
          <VideoTile
            stream={localStream}
            userId="local"
            username="You"
            isLocal={true}
          />
        )}

        {Object.entries(remoteStreams).map(([userId, stream]) => {
          const user = connectedUsers.find(u => u.userId === userId);
          return (
            <VideoTile
              key={userId}
              stream={stream}
              userId={userId}
              username={user?.username}
              isLocal={false}
            />
          );
        })}
      </div>
    </div>
  );
}