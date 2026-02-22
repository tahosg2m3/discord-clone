import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { Mic, Headphones, Settings, LogOut, User } from 'lucide-react';
import { getColorForString } from '../../utils/colors';

export default function UserProfile() {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        (menuRef.current && menuRef.current.contains(event.target)) ||
        (buttonRef.current && buttonRef.current.contains(event.target))
      ) {
        return;
      }
      setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const avatarColor = getColorForString(user.username || 'U');
  const initial = user.username ? user.username[0].toUpperCase() : '?';

  return (
    <div className="h-[52px] bg-[#232428] flex items-center px-2 shrink-0 justify-between relative z-50">
      
      {/* SOL KISIM: Avatar, İsim ve Durum */}
      <div 
        ref={buttonRef}
        onClick={() => setShowMenu((prev) => !prev)}
        className="flex items-center space-x-2 p-1 hover:bg-[#313338] rounded-md cursor-pointer transition-colors max-w-[120px] select-none"
      >
        <div className="relative shrink-0">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[14px] font-semibold overflow-hidden"
            style={{ backgroundColor: avatarColor }}
          >
            {user.avatar && !user.avatar.includes('ui-avatars.com') ? (
              <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          {/* Çevrimiçi Durum Noktası */}
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#23A559] border-[3px] border-[#232428] rounded-full"></div>
        </div>
        
        <div className="flex flex-col min-w-0">
          <span className="text-[14px] font-semibold text-[#F2F3F5] truncate block leading-tight">{user.username}</span>
          <span className="text-[12px] text-[#949BA4] truncate block leading-tight hover:text-[#DBDEE1]">Çevrimiçi</span>
        </div>
      </div>

      {/* SAĞ KISIM: İkonlar (Mikrofon, Kulaklık, Ayarlar) */}
      <div className="flex items-center text-[#B5BAC1]">
        <button className="p-1.5 hover:bg-[#313338] hover:text-[#DBDEE1] rounded-md transition-colors" title="Sesi Kapat">
          <Mic className="w-[18px] h-[18px]" />
        </button>
        <button className="p-1.5 hover:bg-[#313338] hover:text-[#DBDEE1] rounded-md transition-colors" title="Sağırlaştır">
          <Headphones className="w-[18px] h-[18px]" />
        </button>
        <button className="p-1.5 hover:bg-[#313338] hover:text-[#DBDEE1] rounded-md transition-colors" title="Kullanıcı Ayarları">
          <Settings className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* PORTAL: Tıklanınca Ekranın Ortasına/Üstüne Çıkan Açılır Menü */}
      {showMenu && createPortal(
        <div 
          ref={menuRef}
          className="fixed bottom-[60px] left-[80px] w-[300px] bg-[#111214] rounded-lg shadow-2xl border border-[#1E1F22] overflow-hidden z-[9999] animate-in slide-in-from-bottom-2 duration-200 text-[#DBDEE1] font-sans"
        >
          {/* Menü Header: Büyük Profil Görünümü */}
          <div className="p-4 border-b border-[#1E1F22] bg-[#2B2D31]">
            <div className="flex items-center space-x-3 mb-2">
               <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: avatarColor }}>
                 {initial}
               </div>
               <div>
                 <div className="font-bold text-[#F2F3F5] text-[16px]">{user.username}</div>
                 <div className="text-[13px] text-[#949BA4]">{user.email || 'Discord Kullanıcısı'}</div>
               </div>
            </div>
          </div>
          
          {/* Menü Butonları */}
          <div className="p-2 space-y-0.5">
            <button className="w-full flex items-center px-2 py-2 text-[14px] text-[#B5BAC1] hover:bg-[#5865F2] hover:text-white rounded transition-colors group">
              <User className="w-[18px] h-[18px] mr-3" />
              Profilimi Görüntüle
            </button>
            <button className="w-full flex items-center px-2 py-2 text-[14px] text-[#B5BAC1] hover:bg-[#5865F2] hover:text-white rounded transition-colors group">
              <Settings className="w-[18px] h-[18px] mr-3" />
              Gelişmiş Ayarlar
            </button>
            
            <div className="h-[1px] bg-[#1E1F22] my-1" />
            
            {/* Çıkış Yap */}
            <button 
              onClick={() => {
                if (window.confirm('Çıkış yapmak istediğine emin misin?')) {
                  logout();
                }
              }}
              className="w-full flex items-center px-2 py-2 text-[14px] text-[#DA373C] hover:bg-[#DA373C] hover:text-white rounded transition-colors group"
            >
              <LogOut className="w-[18px] h-[18px] mr-3" />
              Hesaptan Çıkış Yap
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}