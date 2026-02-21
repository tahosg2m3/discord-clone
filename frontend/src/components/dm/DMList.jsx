import { useEffect, useState } from 'react';
import { useDM } from '../../context/DMContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { fetchDMConversations } from '../../services/api';
import { getColorForString } from '../../utils/colors';

export default function DMList({ setViewMode }) {
  const { user } = useAuth();
  const { activeDM, setActiveDM } = useDM();
  const { socket } = useSocket();
  const [dms, setDms] = useState([]);

  useEffect(() => {
    if (user?.id) {
      fetchDMConversations(user.id).then(setDms).catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    if (!socket || !user) return;
    
    // Yeni mesaj bildirimi gelirse listeyi güncelle
    const handleNotification = () => {
      fetchDMConversations(user.id).then(setDms).catch(console.error);
    };
    
    socket.on('dm:notification', handleNotification);
    
    return () => {
      socket.off('dm:notification', handleNotification);
    };
  }, [socket, user]);

  const handleSelectDM = (dm) => {
    // Eski DM odasından çık
    if (activeDM?.channelId && socket) {
      socket.emit('user:leave', { channelId: activeDM.channelId });
    }
    
    setActiveDM(dm);
    if (setViewMode) setViewMode('dms');
    
    // Normal bir sunucu kanalıymış gibi odaya katıl
    if (socket) {
      socket.emit('user:join', { 
        username: user.username,
        serverId: dm.id,
        channelId: dm.channelId 
      });
    }
  };

  return (
    <div className="w-[240px] bg-[#2B2D31] flex flex-col h-full overflow-y-auto custom-scrollbar border-r border-[#1E1F22]/50">
      <div className="h-12 px-4 flex items-center shadow-sm border-b border-[#1E1F22] shrink-0 sticky top-0 bg-[#2B2D31] z-10">
        <button className="w-full bg-[#1E1F22] text-[#949BA4] text-[13px] font-medium text-left px-2 py-1.5 rounded-md hover:bg-[#111214] transition-colors">
          Bir sohbet bul veya başlat
        </button>
      </div>

      <div className="p-2">
        <h3 className="text-[12px] font-bold text-[#949BA4] uppercase mb-2 px-2 hover:text-[#DBDEE1] cursor-pointer tracking-wide flex justify-between items-center group">
          <span>Direkt Mesajlar</span>
        </h3>
        
        <div className="space-y-0.5">
          {dms.map(dm => {
            const isActive = activeDM?.id === dm.id;
            const avatarColor = getColorForString(dm.otherUser.username);
            const initial = dm.otherUser.username[0].toUpperCase();

            return (
              <div 
                key={dm.id} 
                onClick={() => handleSelectDM(dm)}
                className={`flex items-center space-x-3 p-2 rounded-[4px] cursor-pointer group transition-colors ${isActive ? 'bg-[#404249] text-white' : 'hover:bg-[#313338] text-[#949BA4] hover:text-[#DBDEE1]'}`}
              >
                <div className="relative shrink-0">
                  {dm.otherUser.avatar && !dm.otherUser.avatar.includes('ui-avatars.com') ? (
                    <img src={dm.otherUser.avatar} className="w-8 h-8 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[14px] font-semibold" style={{ backgroundColor: avatarColor }}>
                      {initial}
                    </div>
                  )}
                  {dm.otherUser.status && (
                    <div className={`absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] rounded-full border-[3px] border-[#2B2D31] transition-colors ${isActive ? 'border-[#404249]' : 'group-hover:border-[#313338]'} ${dm.otherUser.status === 'online' ? 'bg-[#23A559]' : 'bg-[#80848E]'}`}></div>
                  )}
                </div>
                <div className="flex-1 truncate text-[15px] font-medium">{dm.otherUser.username}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}