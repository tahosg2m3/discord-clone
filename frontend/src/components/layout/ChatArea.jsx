import { useState, useEffect, useCallback } from 'react';
import { Hash } from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { fetchChannelMessages } from '../../services/api';
import MessageList from '../chat/MessageList';
import MessageInput from '../chat/MessageInput';
import TypingIndicator from '../chat/TypingIndicator';
import toast from 'react-hot-toast';

export default function ChatArea() {
  const { currentChannel } = useServer();
  const { socket } = useSocket();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [hasMore, setHasMore] = useState(true);

  // Kanal değişince sıfırla ve ilk mesajları çek
  useEffect(() => {
    setMessages([]);
    setTypingUsers([]);
    setHasMore(true);

    if (currentChannel?.id) {
      fetchChannelMessages(currentChannel.id)
        .then((data) => {
          setMessages(data);
          if (data.length < 50) setHasMore(false);
        })
        .catch(() => toast.error('Failed to load messages'));
    }
  }, [currentChannel]);

  // Sonsuz kaydırma: Eski mesajları yükle
  const loadMoreMessages = useCallback(async () => {
    if (!currentChannel?.id || messages.length === 0) return;

    const oldestMessage = messages[0];
    try {
      const moreMessages = await fetchChannelMessages(currentChannel.id, oldestMessage.timestamp);
      
      if (moreMessages.length === 0) {
        setHasMore(false);
      } else {
        // Eski mesajları başa ekle (Spread operator kullanarak birleştir)
        setMessages(prev => [...moreMessages, ...prev]);
      }
    } catch (error) {
      console.error('Failed to load more messages', error);
    }
  }, [currentChannel, messages]);

  // Socket Listener
  useEffect(() => {
    if (!socket) return;

    const handleReceive = (message) => {
      if (currentChannel && message.channelId === currentChannel.id) {
        setMessages(prev => [...prev, message]);
      }
    };

    const handleUpdate = (updatedMessage) => {
      setMessages(prev => prev.map(m => m.id === updatedMessage.id ? updatedMessage : m));
    };

    const handleDelete = ({ messageId }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast('Message deleted', { icon: '🗑️' });
    };

    const handleTypingActive = (data) => {
      if (data.channelId === currentChannel?.id && data.username !== user.username) {
        setTypingUsers(prev => [...new Set([...prev, data.username])]);
      }
    };

    const handleTypingInactive = (data) => {
        setTypingUsers(prev => prev.filter(u => u !== data.username));
    };

    socket.on('message:receive', handleReceive);
    socket.on('message:update', handleUpdate);
    socket.on('message:delete', handleDelete);
    socket.on('typing:active', handleTypingActive);
    socket.on('typing:inactive', handleTypingInactive);

    return () => {
      socket.off('message:receive', handleReceive);
      socket.off('message:update', handleUpdate);
      socket.off('message:delete', handleDelete);
      socket.off('typing:active', handleTypingActive);
      socket.off('typing:inactive', handleTypingInactive);
    };
  }, [socket, currentChannel, user]);

  const handleSendMessage = (content) => {
    if (!socket || !content.trim()) return;
    socket.emit('message:send', { content: content.trim(), channelId: currentChannel.id });
  };

  const handleTyping = (isTyping) => {
    if (!socket) return;
    socket.emit(isTyping ? 'typing:start' : 'typing:stop', { channelId: currentChannel.id });
  };

  if (!currentChannel) return null;

  return (
    <div className="flex-1 flex flex-col bg-gray-700 min-h-0">
      <div className="h-12 px-4 flex items-center shadow-md border-b border-gray-800 shrink-0">
        <Hash className="w-6 h-6 text-gray-400 mr-2" />
        <h2 className="font-semibold text-white">{currentChannel.name}</h2>
      </div>

      <MessageList 
        messages={messages} 
        currentUser={user}
        onLoadMore={loadMoreMessages}
        hasMore={hasMore}
      />

      <div className="shrink-0">
        {typingUsers.length > 0 && (
          <div className="px-4 pb-2">
            <TypingIndicator users={typingUsers} />
          </div>
        )}
        <MessageInput
          channelName={currentChannel.name}
          onSend={handleSendMessage}
          onTyping={handleTyping}
        />
      </div>
    </div>
  );
}