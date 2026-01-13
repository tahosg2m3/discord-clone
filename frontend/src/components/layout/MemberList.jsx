import { useEffect, useState } from 'react';
import { useServer } from '../../context/ServerContext';
import { useSocket } from '../../context/SocketContext';
import { fetchServerMembers } from '../../services/api';
import { getColorForString } from '../../utils/colors';

export default function MemberList() {
  const { currentServer } = useServer();
  const { socket } = useSocket();
  const [members, setMembers] = useState([]);

  // 1. Sunucu değişince tüm üyeleri API'den çek
  useEffect(() => {
    if (currentServer?.id) {
      fetchServerMembers(currentServer.id)
        .then(data => {
          // Online olanları en üste alacak şekilde sırala
          const sorted = data.sort((a, b) => (a.status === 'online' ? -1 : 1));
          setMembers(sorted);
        })
        .catch(console.error);
    }
  }, [currentServer]);

  // 2. Canlı durum güncellemelerini dinle (Global Presence)
  useEffect(() => {
    if (!socket) return;

    const handlePresenceUpdate = ({ userId, status }) => {
      setMembers(prev => {
        const updated = prev.map(m => 
          m.id === userId ? { ...m, status } : m
        );
        // Durum değişince tekrar sırala
        return updated.sort((a, b) => {
            if (a.status === 'online' && b.status !== 'online') return -1;
            if (a.status !== 'online' && b.status === 'online') return 1;
            return 0;
        });
      });
    };

    // Yeni biri sunucuya katıldığında (Örn: Join linki ile)
    // Bunu backend'de 'server:user-joined' gibi bir event ile tetikleyebilirsin
    // Şimdilik manuel refresh gerekebilir veya socket event eklenebilir.
    
    socket.on('presence:update', handlePresenceUpdate);

    return () => {
      socket.off('presence:update', handlePresenceUpdate);
    };
  }, [socket]);

  if (!currentServer) return null;

  // Online ve Offline sayılarını hesapla
  const onlineCount = members.filter(m => m.status === 'online').length;
  const offlineCount = members.length - onlineCount;

  return (
    <div className="w-60 bg-gray-800 flex flex-col min-h-0 border-l border-gray-900 overflow-y-auto custom-scrollbar">
      
      {/* ONLINE MEMBERS */}
      <div className="p-3 pb-0">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Online — {onlineCount}
        </h3>
        <div className="space-y-0.5">
          {members.filter(m => m.status === 'online').map(member => (
            <MemberItem key={member.id} member={member} />
          ))}
        </div>
      </div>

      {/* OFFLINE MEMBERS */}
      <div className="p-3 pt-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Offline — {offlineCount}
        </h3>
        <div className="space-y-0.5">
          {members.filter(m => m.status !== 'online').map(member => (
            <MemberItem key={member.id} member={member} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MemberItem({ member }) {
  return (
    <div className="flex items-center space-x-2 p-2 hover:bg-gray-700/50 rounded cursor-pointer group transition-colors opacity-90 hover:opacity-100">
      <div className="relative">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
          style={{ backgroundColor: getColorForString(member.username) }}
        >
          {member.username[0].toUpperCase()}
        </div>
        {/* Durum Göstergesi */}
        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-gray-800 ${
            member.status === 'online' ? 'bg-green-500' : 'bg-gray-500'
        }`}></div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate ${
            member.status === 'online' ? 'text-gray-200' : 'text-gray-500'
        }`}>
          {member.username}
        </div>
      </div>
    </div>
  );
}