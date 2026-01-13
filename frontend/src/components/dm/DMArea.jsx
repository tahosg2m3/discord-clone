import { useState, useEffect } from 'react';
import { useDM } from '../../context/DMContext';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { fetchDMMessages } from '../../services/api';
import MessageList from '../chat/MessageList';
import MessageInput from '../chat/MessageInput';
import toast from 'react-hot-toast';

export default function DMArea() {
  const { currentConversation } = useDM();
  const { socket } = useSocket();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1. Konuşma değiştiğinde API'den eski mesajları çek
  useEffect(() => {
    if (!currentConversation) return;

    const loadMessages = async () => {
      setLoading(true);
      try {
        const data = await fetchDMMessages(currentConversation.id);
        setMessages(data);
      } catch (error) {
        console.error('Mesajlar yüklenemedi:', error);
        toast.error('Mesaj geçmişi alınamadı');
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [currentConversation]);

  // 2. Canlı Mesajları Dinle
  useEffect(() => {
    if (!socket || !currentConversation) return;

    const handleReceive = (data) => {
      // DİKKAT: Backend { conversationId, message } gönderiyor.
      // Sadece açık olan pencerenin mesajıysa ekliyoruz.
      if (data.conversationId === currentConversation.id) {
        setMessages(prev => [...prev, data.message]);
      }
    };

    socket.on('dm:receive', handleReceive);

    return () => {
      socket.off('dm:receive', handleReceive);
    };
  }, [socket, currentConversation]);

  // 3. Mesaj Gönderme
  const handleSendMessage = (content) => {
    if (!socket || !content.trim() || !currentConversation) return;

    // Alıcı ID'sini hesapla
    const receiverId = currentConversation.otherUser?.id || 
      (currentConversation.user1Id === user.id ? currentConversation.user2Id : currentConversation.user1Id);

    if (!receiverId) {
      toast.error('Alıcı bulunamadı!');
      return;
    }

    socket.emit('dm:send', {
      receiverId, // Backend bunu bekliyor
      content: content.trim()
    });
  };

  if (!currentConversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 bg-gray-700">
        <p>Sohbet etmek için soldan bir kişi seçin.</p>
      </div>
    );
  }

  const otherUser = currentConversation.otherUser || { username: 'Kullanıcı' };

  return (
    <div className="flex-1 flex flex-col bg-gray-700 min-h-0">
      {/* Başlık */}
      <div className="h-12 px-4 flex items-center shadow-md border-b border-gray-800 shrink-0 bg-gray-750">
        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center mr-3">
            <span className="text-white font-semibold">@</span>
        </div>
        <h2 className="font-semibold text-white">
          {otherUser.username}
        </h2>
      </div>

      {/* Mesaj Listesi */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
            <span className="text-gray-400">Yükleniyor...</span>
        </div>
      ) : (
        <MessageList 
          messages={messages} 
          currentUser={user} // 'user' objesini tam gönderiyoruz
        />
      )}

      {/* Input */}
      <div className="shrink-0 p-4">
        <MessageInput
          channelName={otherUser.username}
          onSend={handleSendMessage}
          onTyping={() => {}}
        />
      </div>
    </div>
  );
}