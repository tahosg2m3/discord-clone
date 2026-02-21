import { useEffect, useState } from 'react';
import { useServer } from '../../context/ServerContext';
import { useSocket } from '../../context/SocketContext';
import { fetchServerMembers } from '../../services/api';
import { getColorForString } from '../../utils/colors';
import UserPopover from '../profile/UserPopover'; // YENİ EKLENDİ

export default function MemberList() {
  const { currentServer } = useServer();
  const { socket } = useSocket();
  const [members, setMembers] = useState([]);
  
  // Seçili kullanıcı profilini göstermek için state
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    if (currentServer?.id) {
      fetchServerMembers(currentServer.id).then(data => {
        setMembers(data.sort((a, b) => (a.status === 'online' ? -1 : 1)));
      }).catch(console.error);
    }
  }, [currentServer]);

  useEffect(() => {
    if (!socket) return;
    const handlePresence = ({ userId, status }) => {
      setMembers(prev => prev.map(m => m.id === userId ? { ...m, status } : m)
        .sort((a, b) => (a.status === 'online' && b.status !== 'online' ? -1 : 1)));
    };
    socket.on('presence:update', handlePresence);
    return () => socket.off('presence:update', handlePresence);
  }, [socket]);

  if (!currentServer) return null;

  return (
    <>
      {/* Kullanıcı Profili Modalı */}
      {selectedUser && (
        <UserPopover targetUser={selectedUser} onClose={() => setSelectedUser(null)} />
      )}

      <div className="w-[240px] bg-[#2B2D31] flex flex-col h-full overflow-y-auto custom-scrollbar">
        <div className="p-4">
          <h3 className="text-[12px] font-bold text-[#949BA4] uppercase mb-1 tracking-wide">
            Üyeler — {members.length}
          </h3>
          
          <div className="space-y-0.5 mt-2">
            {members.map(m => (
              <div 
                key={m.id} 
                onClick={() => setSelectedUser(m)} // Tıklanınca profili aç
                className="flex items-center space-x-3 p-1.5 hover:bg-[#313338] rounded-[4px] cursor-pointer opacity-90 hover:opacity-100 transition-colors group"
              >
                <div className="relative">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[14px] font-semibold" 
                    style={{ backgroundColor: getColorForString(m.username) }}
                  >
                    {m.username[0].toUpperCase()}
                  </div>
                  
                  {/* Status Göstergesi */}
                  <div className={`absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] rounded-full border-[3px] border-[#2B2D31] group-hover:border-[#313338] transition-colors ${m.status === 'online' ? 'bg-[#23A559]' : 'bg-[#80848E]'}`}></div>
                </div>
                
                <div className={`text-[15px] font-medium truncate ${m.status === 'online' ? 'text-[#DBDEE1]' : 'text-[#949BA4]'}`}>
                  {m.username}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}