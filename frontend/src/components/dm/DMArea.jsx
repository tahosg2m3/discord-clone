import { useState, useEffect, useRef } from 'react';
import { useDM } from '../../context/DMContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { fetchDMMessages } from '../../services/api';
import Message from '../chat/Message'; 
import MessageInput from '../chat/MessageInput';
import { getColorForString } from '../../utils/colors';

export default function DMArea() {
  const { activeDM } = useDM();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (activeDM) {
      fetchDMMessages(activeDM.id).then(setMessages).catch(console.error);
    } else {
      setMessages([]);
    }
  }, [activeDM]);

  useEffect(() => {
    if (!socket || !activeDM || !user) return;
    
    // Garanti: DM değiştiğinde gizli odaya katıldığımızdan emin oluyoruz
    socket.emit('user:join', { channelId: activeDM.channelId, username: user.username });

    const handleReceive = (message) => {
      if (message.channelId === activeDM.channelId) {
        setMessages(prev => {
          // GARANTİ KALKANI: Çift mesajı engelle
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
      socket.emit('user:leave', { channelId: activeDM.channelId });
      socket.off('message:receive', handleReceive);
      socket.off('message:update', handleUpdate);
      socket.off('message:delete', handleDelete);
    };
  }, [socket, activeDM, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (content) => {
    if (!content.trim() || !activeDM || !socket || !user) return;
    
    socket.emit('message:send', { 
      channelId: activeDM.channelId, 
      content,
      userId: user.id,
      username: user.username
    });
  };

  if (!activeDM) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#313338] text-[#949BA4] select-none">
        <div className="w-20 h-20 bg-[#2B2D31] rounded-full flex items-center justify-center mb-6 shadow-inner">
          <span className="text-4xl text-[#404249]">@</span>
        </div>
        <h3 className="text-xl font-bold text-[#F2F3F5] mb-2">Arkadaşlarınla Mesajlaş</h3>
        <p className="text-[15px]">Bir sohbet başlatmak için sol taraftan birini seç.</p>
      </div>
    );
  }

  const avatarColor = getColorForString(activeDM.otherUser.username);
  const initial = activeDM.otherUser.username[0].toUpperCase();

  return (
    <div className="flex-1 flex flex-col bg-[#313338] min-w-0 h-full">
      
      <div className="h-12 px-4 flex items-center shadow-sm border-b border-[#1E1F22] shrink-0 bg-[#313338] z-10">
        <div className="flex items-center space-x-3">
          <span className="text-[#949BA4] text-xl font-medium select-none">@</span>
          <span className="font-bold text-[#F2F3F5]">{activeDM.otherUser.username}</span>
          {activeDM.otherUser.status === 'online' && (
            <div className="w-2.5 h-2.5 bg-[#23A559] rounded-full"></div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        
        <div className="mt-8 mb-6 pb-4 border-b border-[#2B2D31]">
          {activeDM.otherUser.avatar && !activeDM.otherUser.avatar.includes('ui-avatars.com') ? (
            <img src={activeDM.otherUser.avatar} className="w-20 h-20 rounded-full object-cover mb-4" alt="" />
          ) : (
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold mb-4" style={{ backgroundColor: avatarColor }}>
              {initial}
            </div>
          )}
          <h1 className="text-3xl font-bold text-[#F2F3F5] mb-2">{activeDM.otherUser.username}</h1>
          <p className="text-[#949BA4] text-[15px]">Bu, <strong>{activeDM.otherUser.username}</strong> ile olan mesaj geçmişinin başlangıcıdır.</p>
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
        <MessageInput onSendMessage={handleSendMessage} placeholder={`@${activeDM.otherUser.username} kişisine mesaj gönder`} />
      </div>

    </div>
  );
}