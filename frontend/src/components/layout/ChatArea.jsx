import { useState, useEffect, useRef } from 'react';
import { Hash } from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import MessageList from '../chat/MessageList';
import MessageInput from '../chat/MessageInput';
import TypingIndicator from '../chat/TypingIndicator';
import { fetchChannelMessages } from '../../services/api'; // Yeni import

export default function ChatArea() {
  const { currentChannel } = useServer();
  const { socket } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  // Kanal değiştiğinde mesaj geçmişini çek
  useEffect(() => {
    // Önceki mesajları temizle
    setMessages([]);
    setTypingUsers([]);

    if (currentChannel?.id) {
      // API'den mesajları getir
      fetchChannelMessages(currentChannel.id)
        .then((data) => {
          setMessages(data);
        })
        .catch((error) => {
          console.error("Mesajlar yüklenemedi:", error);
        });
    }
  }, [currentChannel]);

  // Socket olaylarını dinle
  useEffect(() => {
    if (!socket) return;

    // Yeni mesaj geldiğinde
    socket.on('message:receive', (message) => {
      // Sadece şu anki kanalın mesajıysa ekle (Güvenlik/UX önlemi)
      if (currentChannel && message.channelId === currentChannel.id) {
        setMessages((prev) => [...prev, message]);
      }
    });

    // Kullanıcı katıldı
    socket.on('user:joined', (data) => {
      // Sadece aktif kanaldaysa gösterilebilir (opsiyonel kontrol eklenebilir)
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

    // Kullanıcı ayrıldı
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

    // Yazıyor göstergesi
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

    // Temizlik
    return () => {
      socket.off('message:receive');
      socket.off('user:joined');
      socket.off('user:left');
      socket.off('typing:active');
      socket.off('typing:inactive');
    };
  }, [socket, currentChannel]); // currentChannel değiştiğinde listener güncellensin

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

  // Kanal seçili değilse
  if (!currentChannel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-700 text-gray-400">
        <p>Select a channel to start chatting</p>
      </div>
    );
  }

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