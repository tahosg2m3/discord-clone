// frontend/src/components/layout/ChannelList.jsx
import { useState, useEffect } from 'react';
import { Hash, Volume2, Plus, ChevronDown } from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useVoice } from '../../context/VoiceContext';
import { fetchChannels, createChannel } from '../../services/api';

export default function ChannelList() {
  const { currentServer, currentChannel, setCurrentChannel } = useServer();
  const { socket } = useSocket();
  const { user } = useAuth();
  const { joinVoiceChannel } = useVoice(); // Ses bağlantısı için
  
  const [channels, setChannels] = useState([]);
  const [createType, setCreateType] = useState(null); // 'text' veya 'voice'
  const [newChannelName, setNewChannelName] = useState('');

  useEffect(() => {
    if (currentServer) {
      loadChannels();
    }
  }, [currentServer]);

  // Kanal değiştiğinde socket room işlemleri (Text chat için)
  useEffect(() => {
    if (socket && currentChannel && user) {
      // Eski kanaldan ayrıl
      if (currentChannel.previous) {
        socket.emit('user:leave', {
          channelId: currentChannel.previous,
        });
      }

      // Yeni kanala katıl
      socket.emit('user:join', {
        username: user.username,
        serverId: currentServer.id,
        channelId: currentChannel.id,
      });
    }
  }, [currentChannel, socket, user]);

  const loadChannels = async () => {
    try {
      const data = await fetchChannels(currentServer.id);
      setChannels(data);
      // Eğer hiç kanal seçili değilse ilkini seç
      if (data.length > 0 && !currentChannel) {
        setCurrentChannel(data[0]);
      }
    } catch (error) {
      console.error('Failed to load channels:', error);
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim() || !createType) return;

    try {
      // createType: 'text' veya 'voice'
      const channel = await createChannel(currentServer.id, newChannelName, createType);
      setChannels([...channels, channel]);
      setNewChannelName('');
      setCreateType(null);
    } catch (error) {
      console.error('Failed to create channel:', error);
    }
  };

  const handleChannelClick = (channel) => {
    // 1. Kanalı aktif yap (Text sohbeti değişsin)
    setCurrentChannel({
      ...channel,
      previous: currentChannel?.id,
    });

    // 2. Eğer sesli kanalsa, sesli görüşmeye katıl
    if (channel.type === 'voice') {
      joinVoiceChannel(channel.id);
    }
  };

  // Kanalları Grupla
  const textChannels = channels.filter(c => !c.type || c.type === 'text');
  const voiceChannels = channels.filter(c => c.type === 'voice');

  const renderCreateForm = (type) => {
    if (createType !== type) return null;
    return (
      <form onSubmit={handleCreateChannel} className="px-2 mb-2">
        <input
          type="text"
          value={newChannelName}
          onChange={(e) => setNewChannelName(e.target.value)}
          placeholder={`new-${type}-channel`}
          className="w-full bg-gray-900 text-white px-2 py-1 rounded text-sm 
                    focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
          onBlur={() => !newChannelName && setCreateType(null)}
        />
      </form>
    );
  };

  return (
    <div className="w-60 bg-gray-800 flex flex-col h-full">
      {/* Server Header */}
      <div className="h-12 px-4 flex items-center shadow-md border-b border-gray-900 shrink-0">
        <button className="flex items-center justify-between w-full hover:bg-gray-750 
                          px-2 py-1 rounded transition-colors">
          <span className="font-semibold text-white truncate">{currentServer?.name}</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        
        {/* --- TEXT CHANNELS --- */}
        <div className="pt-4 pb-2 px-2">
          <div className="flex items-center justify-between px-2 mb-1 group">
            <div className="flex items-center text-xs font-bold text-gray-400 
                          uppercase tracking-wide hover:text-gray-300 cursor-pointer">
              <ChevronDown className="w-3 h-3 mr-0.5" />
              Text Channels
            </div>
            <button
              onClick={() => setCreateType(createType === 'text' ? null : 'text')}
              className="text-gray-400 hover:text-gray-200"
              title="Create Text Channel"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {renderCreateForm('text')}

          {textChannels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => handleChannelClick(channel)}
              className={`
                w-full flex items-center px-2 py-1.5 mb-0.5 rounded group
                transition-colors
                ${currentChannel?.id === channel.id
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:bg-gray-750 hover:text-gray-200'
                }
              `}
            >
              <Hash className="w-5 h-5 mr-1.5 text-gray-500 group-hover:text-gray-400" />
              <span className="text-sm font-medium truncate">{channel.name}</span>
            </button>
          ))}
        </div>

        {/* --- VOICE CHANNELS --- */}
        <div className="pt-4 pb-2 px-2">
          <div className="flex items-center justify-between px-2 mb-1 group">
            <div className="flex items-center text-xs font-bold text-gray-400 
                          uppercase tracking-wide hover:text-gray-300 cursor-pointer">
              <ChevronDown className="w-3 h-3 mr-0.5" />
              Voice Channels
            </div>
            <button
              onClick={() => setCreateType(createType === 'voice' ? null : 'voice')}
              className="text-gray-400 hover:text-gray-200"
              title="Create Voice Channel"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {renderCreateForm('voice')}

          {voiceChannels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => handleChannelClick(channel)}
              className={`
                w-full flex items-center px-2 py-1.5 mb-0.5 rounded group
                transition-colors
                ${currentChannel?.id === channel.id
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:bg-gray-750 hover:text-gray-200'
                }
              `}
            >
              <Volume2 className="w-5 h-5 mr-1.5 text-gray-500 group-hover:text-gray-400" />
              <span className="text-sm font-medium truncate">{channel.name}</span>
            </button>
          ))}
        </div>

      </div>

      {/* User Profile Bar (En altta sabit) */}
      <div className="h-14 bg-gray-900 px-2 flex items-center shrink-0">
        <div className="flex items-center space-x-2 pl-1">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center 
                        justify-center text-white text-sm font-semibold">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate w-24">
              {user?.username}
            </div>
            <div className="text-xs text-gray-400">Online</div>
          </div>
        </div>
      </div>
    </div>
  );
}