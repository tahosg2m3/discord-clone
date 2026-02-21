import { useState } from 'react';
import { X, MessageSquare, UserPlus, Copy, Check } from 'lucide-react';
import { getColorForString } from '../../utils/colors';
import { sendFriendRequest, createDMConversation } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function UserPopover({ targetUser, onClose }) {
  const { user: currentUser } = useAuth();
  const [copied, setCopied] = useState(false);

  // Banner rengini ID'den veya isimden rastgele ama sabit alıyoruz
  const bannerColor = getColorForString((targetUser.id || targetUser.username) + "banner");
  const avatarColor = getColorForString(targetUser.username);
  const initial = targetUser.username?.[0]?.toUpperCase() || '?';

  // ID Kopyalama
  const handleCopyId = () => {
    if (targetUser.id) {
      navigator.clipboard.writeText(targetUser.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Kullanıcı ID kopyalandı!');
    }
  };

  // Arkadaş Ekleme
  const handleAddFriend = async () => {
    try {
      await sendFriendRequest(currentUser.id, targetUser.username);
      toast.success(`${targetUser.username} kişisine arkadaşlık isteği gönderildi!`);
      onClose();
    } catch (error) {
      toast.error(error.message || 'İstek gönderilemedi.');
    }
  };

  // Mesaj Gönderme (DM Başlatma)
  const handleSendMessage = async () => {
    try {
      await createDMConversation(currentUser.id, targetUser.id);
      toast.success('DM oluşturuldu! Sol üstten DM sekmesine geçebilirsiniz.');
      onClose();
    } catch (error) {
      toast.error('Mesaj başlatılamadı.');
    }
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
        <div className="h-[100px] w-full" style={{ backgroundColor: bannerColor }} />

        <div className="px-4 pb-4 relative">
          {/* Avatar (Banner'ın üstüne taşar) */}
          <div className="absolute -top-[42px] left-4 rounded-full border-[6px] border-[#111214] bg-[#111214]">
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-inner"
              style={{ backgroundColor: avatarColor }}
            >
              {initial}
            </div>
            {/* Status (Eğer online durumu varsa buraya nokta eklenebilir) */}
            {targetUser.status && (
              <div className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-[4px] border-[#111214] ${targetUser.status === 'online' ? 'bg-[#23A559]' : 'bg-[#80848E]'}`} />
            )}
          </div>

          {/* Kullanıcı Bilgileri Kartı */}
          <div className="mt-12 bg-[#2B2D31] rounded-lg p-4 shadow-sm border border-[#1E1F22]">
            <h2 className="text-xl font-bold text-[#F2F3F5]">{targetUser.username}</h2>
            
            <div className="mt-1 flex items-center justify-between group">
              <span className="font-mono text-[11px] bg-[#1E1F22] px-2 py-1 rounded-md text-[#DBDEE1]">
                {targetUser.id}
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
            {currentUser?.id !== targetUser.id ? (
              <div className="flex flex-col gap-2">
                <button 
                  onClick={handleSendMessage} 
                  className="w-full flex items-center justify-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white py-2 rounded text-[14px] font-medium transition-colors"
                >
                  <MessageSquare className="w-[18px] h-[18px]" /> Mesaj Gönder
                </button>
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