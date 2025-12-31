// frontend/src/components/voice/VoicePanel.jsx
// DÜZELTME: 'HeadphonesOff' kaldırıldı, çünkü bu ikon pakette yok.
import { Mic, MicOff, Headphones, PhoneOff, Monitor, MonitorOff } from 'lucide-react';
import { useVoice } from '../../context/VoiceContext';
import { useAuth } from '../../context/AuthContext';

export default function VoicePanel() {
  const { user } = useAuth();
  const { 
    inVoiceChannel, 
    leaveVoiceChannel, 
    isMuted, 
    toggleMute, 
    isDeafened, 
    toggleDeafen,
    isSharingScreen,
    shareScreen,
    stopScreenShare
  } = useVoice();

  if (!inVoiceChannel) return null;

  return (
    <div className="bg-gray-900 border-t border-gray-800 p-4">
      {/* Bağlı Kullanıcılar */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
          Voice Channel
        </h3>
        {/* Kullanıcı Listesi */}
        <div className="space-y-1">
           {/* Kendi kullanıcımızı da gösterelim */}
           <div className="flex items-center space-x-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-white font-medium">{user?.username} (You)</span>
            </div>
            
            {/* Diğer kullanıcılar */}
            {/* Not: connectedUsers listesi VoiceContext'ten gelmeli */}
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
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' 
                : 'hover:bg-gray-700 text-gray-200'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Kulaklık (Deafen) */}
          <button
            onClick={toggleDeafen}
            className={`p-2 rounded-lg transition-colors ${
              isDeafened 
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' 
                : 'hover:bg-gray-700 text-gray-200'
            }`}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            {/* HeadphonesOff yerine PhoneOff veya üstü çizili Headphones kullanıyoruz */}
            {isDeafened ? <PhoneOff size={20} /> : <Headphones size={20} />}
          </button>

          {/* Ekran Paylaşımı */}
          <button
            onClick={isSharingScreen ? stopScreenShare : shareScreen}
            className={`p-2 rounded-lg transition-colors ${
              isSharingScreen 
                ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' 
                : 'hover:bg-gray-700 text-gray-200'
            }`}
            title={isSharingScreen ? 'Stop Sharing' : 'Share Screen'}
          >
            {isSharingScreen ? <MonitorOff size={20} /> : <Monitor size={20} />}
          </button>
        </div>

        {/* Ayrıl */}
        <button
          onClick={leaveVoiceChannel}
          className="p-2 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
          title="Disconnect"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}