import { useState, useEffect, useRef } from 'react';
import { Hash, Users } from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { fetchChannelMessages } from '../../services/api';
import Message from '../chat/Message'; 
import MessageInput from '../chat/MessageInput';

export default function ChatArea() {
  const { currentServer, currentChannel } = useServer();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (currentChannel) {
      fetchChannelMessages(currentChannel.id).then(setMessages).catch(console.error);
    } else {
      setMessages([]);
    }
  }, [currentChannel]);

  useEffect(() => {
    if (!socket || !currentChannel || !user) return;
    
    // Garanti: Kanal değiştiğinde odaya katıldığımızdan emin oluyoruz
    socket.emit('user:join', { channelId: currentChannel.id, username: user.username });

    const handleReceive = (message) => {
      if (message.channelId === currentChannel.id) {
        setMessages(prev => {
          // GARANTİ KALKANI: Bu mesaj zaten ekranda varsa (çift geliyorsa) bir daha ekleme!
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }
    };
    
    const handleUpdate = (updatedMessage) => {
      setMessages(prev => prev.map(m => m.id === updatedMessage.id ? updatedMessage : m));
    };
    
    const handleDelete = ({ messageId }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    };

    socket.on('message:receive', handleReceive);
    socket.on('message:update', handleUpdate);
    socket.on('message:delete', handleDelete);

    return () => {
      socket.emit('user:leave', { channelId: currentChannel.id });
      socket.off('message:receive', handleReceive);
      socket.off('message:update', handleUpdate);
      socket.off('message:delete', handleDelete);
    };
  }, [socket, currentChannel, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (content) => {
    if (!content.trim() || !currentChannel || !socket || !user) return;
    
    socket.emit('message:send', { 
      channelId: currentChannel.id, 
      content,
      userId: user.id,
      username: user.username
    });
  };

  if (!currentChannel) return null;

  return (
    <div className="flex-1 flex flex-col bg-[#313338] min-w-0 h-full relative z-10">
      
      <div className="h-12 px-4 flex items-center shadow-sm border-b border-[#1E1F22] shrink-0 bg-[#313338] z-20">
        <div className="flex items-center text-[#949BA4] mr-2">
          <Hash className="w-6 h-6" />
        </div>
        <div className="font-bold text-[#F2F3F5]">{currentChannel.name}</div>
        
        <div className="ml-auto flex items-center space-x-4 text-[#B5BAC1]">
          <Users className="w-5 h-5 cursor-pointer hover:text-[#DBDEE1]" title="Üye Listesi" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        
        <div className="mt-8 mb-6 pb-4 border-b border-[#2B2D31]">
          <div className="w-16 h-16 bg-[#404249] rounded-full flex items-center justify-center text-white mb-4">
            <Hash className="w-10 h-10 text-[#DBDEE1]" />
          </div>
          <h1 className="text-3xl font-bold text-[#F2F3F5] mb-2">{currentChannel.name} kanalına hoş geldin!</h1>
          <p className="text-[#949BA4] text-[15px]">Bu, <strong>#{currentChannel.name}</strong> kanalının başlangıcıdır.</p>
        </div>

        {messages.map((msg, index) => {
          const isOwn = msg.userId === user.id;
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const grouped = prevMsg && prevMsg.userId === msg.userId && (msg.timestamp - prevMsg.timestamp < 300000);
          
          return (
            <Message key={msg.id} message={msg} isOwn={isOwn} grouped={grouped} userId={user.id} />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 shrink-0">
        <MessageInput onSendMessage={handleSendMessage} placeholder={`#${currentChannel.name} kanalına mesaj gönder`} />
      </div>

    </div>
  );
}