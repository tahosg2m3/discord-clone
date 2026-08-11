import { useState } from 'react';
import { X, MessageSquare, UserPlus, Copy, Check, Flag, ShieldOff } from 'lucide-react';
import { getColorForString } from '../../utils/colors';
import { sendFriendRequest, createDMConversation } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useDM } from '../../context/DMContext';
import { useServer } from '../../context/ServerContext';
import toast from 'react-hot-toast';
import { blockUser, createReport } from '../../services/platformApi';

export default function UserPopover({ targetUser, onClose }) {
  const { user: currentUser } = useAuth();
  const { setActiveDM } = useDM();
  const { currentServer, setCurrentServer } = useServer();
  const [copied, setCopied] = useState(false);

  // Banner rengini ID'den veya isimden rastgele ama sabit alıyoruz
  const targetId = targetUser.id || targetUser.userId || targetUser.user?.id;
  const username = targetUser.nickname || targetUser.username || targetUser.user?.username || 'Kullanıcı';
  const bannerColor = getColorForString((targetId || username) + "banner");
  const avatarColor = getColorForString(username);
  const initial = username?.[0]?.toUpperCase() || '?';
  const avatar = targetUser.serverAvatar || targetUser.avatar || targetUser.user?.avatar;
  const banner = targetUser.banner || targetUser.user?.banner;
  const presence = targetUser.status || targetUser.presenceStatus || 'offline';

  // ID Kopyalama
  const handleCopyId = () => {
    if (targetId) {
      navigator.clipboard.writeText(targetId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Kullanıcı ID kopyalandı!');
    }
  };

  // Arkadaş Ekleme
  const handleAddFriend = async () => {
    try {
      await sendFriendRequest(currentUser.id, username);
      toast.success(`${username} kişisine arkadaşlık isteği gönderildi!`);
      onClose();
    } catch (error) {
      toast.error(error.message || 'İstek gönderilemedi.');
    }
  };

  // Mesaj Gönderme (DM Başlatma)
  const handleSendMessage = async () => {
    try {
      const conversation = await createDMConversation(currentUser.id, targetId);
      const completeConversation = { ...conversation, otherUser: targetUser };
      setActiveDM(completeConversation);
      setCurrentServer(null);
      window.dispatchEvent(new CustomEvent('discord:navigate-to-dm', { detail: { conversation: completeConversation } }));
      toast.success('DM oluşturuldu! Sol üstten DM sekmesine geçebilirsiniz.');
      onClose();
    } catch (error) {
      toast.error('Mesaj başlatılamadı.');
    }
  };

  const handleBlock = async () => {
    if (!window.confirm(`${username} kullanıcısını engellemek istiyor musun?`)) return;
    try { await blockUser(targetId); toast.success('Kullanıcı engellendi.'); onClose(); }
    catch (error) { toast.error(error.message); }
  };

  const handleReport = async () => {
    if (!currentServer?.id) return;
    const reason = window.prompt(`${username} kullanıcısını neden şikâyet ediyorsun?`);
    if (!reason?.trim()) return;
    try {
      await createReport(currentServer.id, { type: 'user', targetUserId: targetId, reason: reason.trim() });
      toast.success('Şikâyet moderatörlere gönderildi.');
      onClose();
    } catch (error) { toast.error(error.message); }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-[340px] bg-[#111214] rounded-lg shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Kapat Butonu */}
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 z-10 p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Renkli Banner */}
        <div className="h-[100px] w-full bg-cover bg-center" style={banner ? { backgroundImage: `url(${banner})`, backgroundColor: bannerColor } : { backgroundColor: bannerColor }} />

        <div className="px-4 pb-4 relative">
          {/* Avatar (Banner'ın üstüne taşar) */}
          <div className="absolute -top-[42px] left-4 rounded-full border-[6px] border-[#111214] bg-[#111214]">
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-inner"
              style={{ backgroundColor: avatarColor }}
            >
              {avatar ? <img src={avatar} alt="" className="h-full w-full rounded-full object-cover" /> : initial}
            </div>
            {/* Status (Eğer online durumu varsa buraya nokta eklenebilir) */}
            {presence && (
              <div className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-[4px] border-[#111214] ${presence === 'online' ? 'bg-[#23A559]' : presence === 'idle' ? 'bg-[#f59e0b]' : presence === 'dnd' ? 'bg-[#ef4444]' : 'bg-[#80848E]'}`} />
            )}
          </div>

          {/* Kullanıcı Bilgileri Kartı */}
          <div className="mt-12 bg-[#2B2D31] rounded-lg p-4 shadow-sm border border-[#1E1F22]">
            <h2 className="text-xl font-bold text-[#F2F3F5]">{username}</h2>
            {targetUser.customStatus && <p className="mt-1 text-xs text-[#B5BAC1]">{targetUser.customStatus}</p>}
            {(targetUser.bio || targetUser.user?.bio) && <p className="mt-3 whitespace-pre-wrap text-sm leading-5 text-[#DBDEE1]">{targetUser.bio || targetUser.user?.bio}</p>}
            {(targetUser.roles || []).filter(role => !role.isDefault).length > 0 && <div className="mt-3 flex flex-wrap gap-1">{targetUser.roles.filter(role => !role.isDefault).map(role => <span key={role.id} className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `${role.color || '#64748b'}22`, color: role.color || '#cbd5e1' }}>{role.icon && <img src={role.icon} alt="" className="mr-1 inline h-3 w-3 rounded-full" />}{role.name}</span>)}</div>}
            
            <div className="mt-1 flex items-center justify-between group">
              <span className="font-mono text-[11px] bg-[#1E1F22] px-2 py-1 rounded-md text-[#DBDEE1]">
                {targetId}
              </span>
              <button 
                onClick={handleCopyId} 
                className="text-[#949BA4] hover:text-[#DBDEE1] p-1 rounded hover:bg-[#1E1F22] transition-colors"
                title="ID Kopyala"
              >
                {copied ? <Check className="w-4 h-4 text-[#23A559]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="w-full h-[1px] bg-[#1E1F22] my-4" />
            
            {/* Kendi profilimiz değilse Butonları Göster */}
            {currentUser?.id !== targetId ? (
              <div className="flex flex-col gap-2">
                <button 
                  onClick={handleSendMessage} 
                  className="w-full flex items-center justify-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white py-2 rounded text-[14px] font-medium transition-colors"
                >
                  <MessageSquare className="w-[18px] h-[18px]" /> Mesaj Gönder
                </button>
                <button onClick={handleBlock} className="w-full flex items-center justify-center gap-2 bg-[#1E1F22] hover:bg-[#DA373C]/20 text-[#F23F42] py-2 rounded text-[14px] font-medium transition-colors"><ShieldOff className="w-[18px] h-[18px]" /> Kullanıcıyı Engelle</button>
                {currentServer?.id && <button onClick={handleReport} className="w-full flex items-center justify-center gap-2 bg-[#1E1F22] hover:bg-[#DA373C]/20 text-[#F23F42] py-2 rounded text-[14px] font-medium transition-colors"><Flag className="w-[18px] h-[18px]" /> Kullanıcıyı Şikâyet Et</button>}
                <button 
                  onClick={handleAddFriend} 
                  className="w-full flex items-center justify-center gap-2 bg-[#23A559] hover:bg-[#1D8046] text-white py-2 rounded text-[14px] font-medium transition-colors"
                >
                  <UserPlus className="w-[18px] h-[18px]" /> Arkadaş Ekle
                </button>
              </div>
            ) : (
              <div className="text-center text-[13px] text-[#949BA4] py-1">
                Bu senin profilin. Çok güzel görünüyorsun! ✨
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
