import { useState, useEffect, useRef } from 'react';
import { Hash } from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import MessageList from '../chat/MessageList';
import MessageInput from '../chat/MessageInput';
import TypingIndicator from '../chat/TypingIndicator';

export default function ChatArea() {
  const { currentChannel } = useServer();
  const { socket } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  useEffect(() => {
    if (!socket) return;

    // Listen for new messages
    socket.on('message:receive', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Listen for user joined
    socket.on('user:joined', (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: 'system',
          content: `${data.username} joined the channel`,
          timestamp: data.timestamp,
        },
      ]);
    });

    // Listen for user left
    socket.on('user:left', (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: 'system',
          content: `${data.username} left the channel`,
          timestamp: data.timestamp,
        },
      ]);
    });

    // Listen for typing indicators
    socket.on('typing:active', (data) => {
      setTypingUsers((prev) => {
        if (!prev.includes(data.username)) {
          return [...prev, data.username];
        }
        return prev;
      });
    });

    socket.on('typing:inactive', (data) => {
      setTypingUsers((prev) => prev.filter((u) => u !== data.username));
    });

    // Cleanup
    return () => {
      socket.off('message:receive');
      socket.off('user:joined');
      socket.off('user:left');
      socket.off('typing:active');
      socket.off('typing:inactive');
    };
  }, [socket]);

  // Clear messages when changing channels
  useEffect(() => {
    setMessages([]);
    setTypingUsers([]);
  }, [currentChannel]);

  const handleSendMessage = (content) => {
    if (!socket || !content.trim()) return;

    socket.emit('message:send', {
      content: content.trim(),
      channelId: currentChannel.id,
    });
  };

  const handleTyping = (isTyping) => {
    if (!socket) return;

    if (isTyping) {
      socket.emit('typing:start', {
        channelId: currentChannel.id,
      });
    } else {
      socket.emit('typing:stop', {
        channelId: currentChannel.id,
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-700">
      {/* Channel Header */}
      <div className="h-12 px-4 flex items-center shadow-md border-b border-gray-800">
        <Hash className="w-6 h-6 text-gray-400 mr-2" />
        <h2 className="font-semibold text-white">{currentChannel.name}</h2>
      </div>

      {/* Messages */}
      <MessageList messages={messages} currentUser={user.username} />

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 pb-2">
          <TypingIndicator users={typingUsers} />
        </div>
      )}

      {/* Message Input */}
      <MessageInput
        channelName={currentChannel.name}
        onSend={handleSendMessage}
        onTyping={handleTyping}
      />
    </div>
  );
}