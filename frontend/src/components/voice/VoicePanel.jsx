// frontend/src/components/voice/VoicePanel.jsx
import { Mic, MicOff, Headphones, MonitorUp, MonitorOff, Video, VideoOff, PhoneOff, Maximize2 } from 'lucide-react';
import { useVoice } from '../../context/VoiceContext';
import { useState } from 'react';
import VideoGrid from './VideoGrid';

export default function VoicePanel() {
  const {
    inVoiceChannel,
    isMuted,
    isDeafened,
    isSharingScreen,
    isCameraOn,
    connectedUsers,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    shareScreen,
    stopScreenShare,
    leaveVoiceChannel,
  } = useVoice();

  const [showVideoGrid, setShowVideoGrid] = useState(false);

  if (!inVoiceChannel) return null;

  return (
    <>
      <div className="bg-gray-900 border-t border-gray-800 p-4">
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
            Voice Channel ({connectedUsers.length + 1})
          </h3>
          <div className="space-y-1">
            {/* Kendimizi de listeye ekleyebiliriz veya sadece diğerlerini gösterebiliriz */}
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
            {/* Mute Button */}
            <button
              onClick={toggleMute}
              className={`p-2 rounded-lg transition-colors ${
                isMuted 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Deafen Button - DÜZELTME BURADA YAPILDI */}
            <button
              onClick={toggleDeafen}
              className={`p-2 rounded-lg transition-colors ${
                isDeafened 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={isDeafened ? 'Undeafen' : 'Deafen'}
            >
              {/* HeadphonesOff olmadığı için Headphones kullanıyoruz, buton rengi durumu belli ediyor */}
              <Headphones className="w-5 h-5" />
            </button>

            {/* Camera Button */}
            <button
              onClick={toggleCamera}
              className={`p-2 rounded-lg transition-colors ${
                isCameraOn 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            {/* Screen Share Button */}
            <button
              onClick={isSharingScreen ? stopScreenShare : shareScreen}
              className={`p-2 rounded-lg transition-colors ${
                isSharingScreen 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={isSharingScreen ? 'Stop Sharing' : 'Share Screen'}
            >
              {isSharingScreen ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
            </button>

            {/* Video Grid Toggle */}
            {(isCameraOn || isSharingScreen) && (
              <button
                onClick={() => setShowVideoGrid(!showVideoGrid)}
                className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                title="Toggle Video Grid"
              >
                <Maximize2 className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Disconnect Button */}
          <button
            onClick={leaveVoiceChannel}
            className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            title="Leave Voice"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showVideoGrid && (isCameraOn || isSharingScreen) && (
        <VideoGrid onClose={() => setShowVideoGrid(false)} />
      )}
    </>
  );
}