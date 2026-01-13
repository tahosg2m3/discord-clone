import { useEffect, useState } from 'react';
import { useServer } from '../../context/ServerContext';
import { useSocket } from '../../context/SocketContext';
import { getColorForString } from '../../utils/colors';

export default function MemberList() {
  const { currentChannel, currentServer } = useServer();
  const { socket } = useSocket();
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!socket || !currentChannel) return;

    // 1. Kanal değişince üyeleri iste
    socket.emit('members:request', { channelId: currentChannel.id });

    // 2. Güncel üye listesi geldiğinde state'i güncelle
    const handleMembersUpdate = ({ members }) => {
      setMembers(members);
    };

    // 3. Birisi girip çıktığında anlık güncelleme için
    const handleUserJoined = (user) => {
        // Eğer kullanıcı zaten listede yoksa ekle
        setMembers(prev => {
            if (prev.find(m => m.username === user.username)) return prev;
            return [...prev, user];
        });
    };

    const handleUserLeft = ({ username }) => {
        setMembers(prev => prev.filter(m => m.username !== username));
    };

    socket.on('members:update', handleMembersUpdate);
    socket.on('user:joined', handleUserJoined); // Kanal genel giriş
    socket.on('user:left', handleUserLeft);

    return () => {
      socket.off('members:update', handleMembersUpdate);
      socket.off('user:joined', handleUserJoined);
      socket.off('user:left', handleUserLeft);
    };
  }, [socket, currentChannel]);

  if (!currentServer) return null;

  return (
    <div className="w-60 bg-gray-800 flex flex-col min-h-0 border-l border-gray-900">
      <div className="p-3 shadow-sm">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Members — {members.length}
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 pt-0 space-y-2">
        {members.map((member) => (
          <div key={member.id || member.username} className="flex items-center space-x-2 p-2 hover:bg-gray-700/50 rounded cursor-pointer group transition-colors">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm relative"
              style={{ backgroundColor: getColorForString(member.username) }}
            >
              {member.username[0].toUpperCase()}
              {/* Online Durum Göstergesi (Opsiyonel) */}
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full"></div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-300 group-hover:text-white truncate">
                {member.username}
              </div>
              <div className="text-xs text-gray-500 group-hover:text-gray-400">
                Online
              </div>
            </div>
          </div>
        ))}

        {members.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-4">
            No members found
          </div>
        )}
      </div>
    </div>
  );
}