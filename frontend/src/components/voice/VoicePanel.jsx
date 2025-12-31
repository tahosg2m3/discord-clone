import { Mic, MicOff, Headphones, HeadphonesOff, MonitorUp, MonitorOff, PhoneOff } from 'lucide-react';
import { useVoice } from '../../context/VoiceContext';

export default function VoicePanel() {
  const {
    inVoiceChannel,
    isMuted,
    isDeafened,
    isSharingScreen,
    connectedUsers,
    toggleMute,
    toggleDeafen,
    shareScreen,
    stopScreenShare,
    leaveVoiceChannel,
  } = useVoice();

  if (!inVoiceChannel) return null;

  return (
    <div className="bg-gray-900 border-t border-gray-800 p-4">
      {/* Bağlı Kullanıcılar */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
          Voice Channel ({connectedUsers.length})
        </h3>
        <div className="space-y-1">
          {connectedUsers.map((user) => (
            <div key={user.userId} className="flex items-center space-x-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-gray-300">{user.username}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Kontroller */}
      <div className="flex items-center justify-between space-x-2">
        <div className="flex space-x-2">
          {/* Mikrofon */}
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

          {/* Kulaklık */}
          <button
            onClick={toggleDeafen}
            className={`p-2 rounded-lg transition-colors ${
              isDeafened 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            {isDeafened ? <HeadphonesOff className="w-5 h-5" /> : <Headphones className="w-5 h-5" />}
          </button>

          {/* Ekran Paylaşımı */}
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
        </div>

        {/* Ayrıl */}
        <button
          onClick={leaveVoiceChannel}
          className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          title="Leave Voice"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
