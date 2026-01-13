import { useState, useEffect, useRef } from 'react';
import { Hash, Volume2, Plus, ChevronDown, X, Copy, UserPlus, Settings } from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useVoice } from '../../context/VoiceContext';
import { fetchChannels, createChannel } from '../../services/api';
import toast from 'react-hot-toast';

export default function ChannelList() {
  const { currentServer, currentChannel, setCurrentChannel } = useServer();
  const { socket } = useSocket();
  const { user } = useAuth();
  const { joinVoiceChannel } = useVoice();
  
  const [channels, setChannels] = useState([]);
  const [createType, setCreateType] = useState(null); // 'text' veya 'voice'
  const [newChannelName, setNewChannelName] = useState('');
  
  // Sunucu menüsü state'i
  const [showServerMenu, setShowServerMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (currentServer) {
      loadChannels();
    }
  }, [currentServer]);

  // Dışarı tıklayınca menüyü kapat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowServerMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Kanal değişimi (Socket room)
  useEffect(() => {
    if (socket && currentChannel && user) {
      if (currentChannel.previous) {
        socket.emit('user:leave', { channelId: currentChannel.previous });
      }
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
      const channel = await createChannel(currentServer.id, newChannelName, createType);
      setChannels([...channels, channel]);
      setNewChannelName('');
      setCreateType(null);
      toast.success('Channel created');
    } catch (error) {
      console.error('Failed to create channel:', error);
      toast.error('Failed to create channel');
    }
  };

  const handleChannelClick = (channel) => {
    setCurrentChannel({ ...channel, previous: currentChannel?.id });
    if (channel.type === 'voice') {
      joinVoiceChannel(channel.id);
    }
  };

  const copyInviteCode = () => {
    if (currentServer?.inviteCode) {
      navigator.clipboard.writeText(currentServer.inviteCode);
      toast.success('Invite Code Copied!');
      setShowServerMenu(false);
    }
  };

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
          className="w-full bg-gray-900 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
          onBlur={() => !newChannelName && setCreateType(null)}
        />
      </form>
    );
  };

  return (
    <div className="w-60 bg-gray-800 flex flex-col h-full relative">
      {/* Server Header & Dropdown */}
      <div className="h-12 px-4 flex items-center shadow-md border-b border-gray-900 shrink-0 z-20">
        <button 
          onClick={() => setShowServerMenu(!showServerMenu)}
          className={`flex items-center justify-between w-full hover:bg-gray-700/50 
                    px-2 py-1 rounded transition-colors ${showServerMenu ? 'bg-gray-700/50 text-white' : 'text-gray-100'}`}
        >
          <span className="font-semibold truncate">{currentServer?.name}</span>
          {showServerMenu ? <X className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* --- SUNUCU MENÜSÜ --- */}
        {showServerMenu && (
          <div ref={menuRef} className="absolute top-14 left-2 right-2 bg-gray-950 rounded-md shadow-xl border border-gray-800 overflow-hidden animate-in zoom-in-95 duration-100 origin-top p-1.5 z-50">
            
            {/* Invite Code Section */}
            <div className="bg-blue-600/10 border border-blue-600/20 rounded p-2 mb-2">
              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">
                Server Invite Code
              </div>
              <div className="flex items-center justify-between">
                <code className="text-white font-mono font-bold text-sm select-all">
                  {currentServer?.inviteCode || 'ERROR'}
                </code>
                <button 
                  onClick={copyInviteCode}
                  className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
                  title="Copy Code"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="h-px bg-gray-800 my-1 mx-1" />
            
            <button className="w-full text-left px-2 py-2 rounded text-sm text-gray-300 hover:bg-blue-600 hover:text-white flex items-center transition-colors group">
              <UserPlus className="w-4 h-4 mr-2 text-blue-400 group-hover:text-white" />
              Invite People
            </button>
            <button className="w-full text-left px-2 py-2 rounded text-sm text-gray-300 hover:bg-gray-800 flex items-center transition-colors">
              <Settings className="w-4 h-4 mr-2 text-gray-400" />
              Server Settings
            </button>
          </div>
        )}
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar" onClick={() => setShowServerMenu(false)}>
        
        {/* TEXT CHANNELS */}
        <div className="pt-4 pb-2 px-2">
          <div className="flex items-center justify-between px-2 mb-1 group hover:text-gray-100">
            <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-300">
              <ChevronDown className="w-3 h-3 mr-0.5" />
              Text Channels
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setCreateType(createType === 'text' ? null : 'text'); }}
              className="text-gray-400 hover:text-gray-200"
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
                w-full flex items-center px-2 py-1.5 mb-0.5 rounded group transition-colors
                ${currentChannel?.id === channel.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}
              `}
            >
              <Hash className="w-5 h-5 mr-1.5 text-gray-500 group-hover:text-gray-400" />
              <span className="text-sm font-medium truncate">{channel.name}</span>
            </button>
          ))}
        </div>

        {/* VOICE CHANNELS */}
        <div className="pt-4 pb-2 px-2">
          <div className="flex items-center justify-between px-2 mb-1 group hover:text-gray-100">
            <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-300">
              <ChevronDown className="w-3 h-3 mr-0.5" />
              Voice Channels
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setCreateType(createType === 'voice' ? null : 'voice'); }}
              className="text-gray-400 hover:text-gray-200"
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
                w-full flex items-center px-2 py-1.5 mb-0.5 rounded group transition-colors
                ${currentChannel?.id === channel.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}
              `}
            >
              <Volume2 className="w-5 h-5 mr-1.5 text-gray-500 group-hover:text-gray-400" />
              <span className="text-sm font-medium truncate">{channel.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* User Profile Bar */}
      <div className="h-14 bg-gray-900/80 px-2 flex items-center shrink-0 border-t border-gray-900">
        <div className="flex items-center space-x-2 pl-1 hover:bg-gray-800 p-1 rounded cursor-pointer w-full transition-colors">
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-semibold">
            {user?.username?.[0]?.toUpperCase()}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-gray-900 rounded-full"></span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate">
              {user?.username}
            </div>
            <div className="text-xs text-gray-400 truncate">
              #{user?.id?.slice(0, 4)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}