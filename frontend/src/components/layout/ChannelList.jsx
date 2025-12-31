import { useState, useEffect } from 'react';
import { Hash, Volume2, Plus, ChevronDown } from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { fetchChannels, createChannel } from '../../services/api';

export default function ChannelList() {
  const { currentServer, currentChannel, setCurrentChannel } = useServer();
  const { socket } = useSocket();
  const { user } = useAuth();
  const [channels, setChannels] = useState([]);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  useEffect(() => {
    if (currentServer) {
      loadChannels();
    }
  }, [currentServer]);

  // Leave old channel and join new channel
  useEffect(() => {
    if (socket && currentChannel && user) {
      // Leave previous channel
      if (currentChannel.previous) {
        socket.emit('user:leave', {
          channelId: currentChannel.previous,
        });
      }

      // Join new channel
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
      // Auto-select first channel
      if (data.length > 0 && !currentChannel) {
        setCurrentChannel(data[0]);
      }
    } catch (error) {
      console.error('Failed to load channels:', error);
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    try {
      const channel = await createChannel(currentServer.id, newChannelName);
      setChannels([...channels, channel]);
      setNewChannelName('');
      setShowNewChannel(false);
    } catch (error) {
      console.error('Failed to create channel:', error);
    }
  };

  const handleChannelClick = (channel) => {
    setCurrentChannel({
      ...channel,
      previous: currentChannel?.id, // Track previous for leave event
    });
  };

  return (
    <div className="w-60 bg-gray-800 flex flex-col">
      {/* Server Header */}
      <div className="h-12 px-4 flex items-center shadow-md border-b border-gray-900">
        <button className="flex items-center justify-between w-full hover:bg-gray-750 
                          px-2 py-1 rounded transition-colors">
          <span className="font-semibold text-white">{currentServer.name}</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto">
        {/* Text Channels Section */}
        <div className="pt-4 pb-2 px-2">
          <div className="flex items-center justify-between px-2 mb-1">
            <div className="flex items-center text-xs font-semibold text-gray-400 
                          uppercase tracking-wide">
              <ChevronDown className="w-3 h-3 mr-1" />
              Text Channels
            </div>
            <button
              onClick={() => setShowNewChannel(!showNewChannel)}
              className="text-gray-400 hover:text-gray-200"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* New Channel Input */}
          {showNewChannel && (
            <form onSubmit={handleCreateChannel} className="px-2 mb-2">
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="new-channel"
                className="w-full bg-gray-900 text-white px-2 py-1 rounded text-sm 
                          focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </form>
          )}

          {/* Channel List */}
          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => handleChannelClick(channel)}
              className={`
                w-full flex items-center px-2 py-1.5 mb-0.5 rounded
                transition-colors group
                ${currentChannel?.id === channel.id
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:bg-gray-750 hover:text-gray-200'
                }
              `}
            >
              <Hash className="w-5 h-5 mr-1.5 text-gray-400" />
              <span className="text-sm font-medium">{channel.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* User Profile Bar */}
      <div className="h-14 bg-gray-900 px-2 flex items-center">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center 
                        justify-center text-white text-sm font-semibold">
            {user.username[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">{user.username}</div>
            <div className="text-xs text-gray-400">Online</div>
          </div>
        </div>
      </div>
    </div>
  );
}