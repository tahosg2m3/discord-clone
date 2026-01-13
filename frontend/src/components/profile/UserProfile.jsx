import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Camera, LogOut } from 'lucide-react'; // LogOut ikonunu ekledik

export default function UserProfile() {
  const { user, logout } = useAuth(); // logout fonksiyonunu çektik
  const [avatar, setAvatar] = useState(user?.avatar);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await fetch('http://localhost:3001/api/upload/avatar', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setAvatar(data.url);

      // Backend'i güncelle
      await fetch(`http://localhost:3001/api/users/${user.id}/avatar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: data.url }),
      });
    } catch (error) {
      console.error('Failed to upload avatar:', error);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      logout();
    }
  };

  if (!user) return null;

  return (
    <div className="p-6 bg-gray-800 rounded-lg w-full max-w-sm mx-auto shadow-xl">
      {/* Avatar Kısmı */}
      <div className="relative w-24 h-24 mx-auto mb-4 group">
        {avatar ? (
          <img src={avatar} alt="Avatar" className="w-full h-full rounded-full object-cover border-4 border-gray-700" />
        ) : (
          <div className="w-full h-full rounded-full bg-indigo-500 flex items-center justify-center text-white text-3xl font-bold border-4 border-gray-700">
            {user.username?.[0]?.toUpperCase()}
          </div>
        )}
        
        <label className="absolute bottom-0 right-0 p-2 bg-gray-900 rounded-full cursor-pointer hover:bg-gray-700 border border-gray-600 transition-colors shadow-lg">
          <Camera className="w-4 h-4 text-gray-200" />
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Kullanıcı Bilgileri */}
      <div className="text-center mb-6">
        <h3 className="text-white font-bold text-xl mb-1">{user.username}</h3>
        <p className="text-gray-400 text-sm font-mono bg-gray-900/50 py-1 px-3 rounded-full inline-block">
          {user.email}
        </p>
      </div>

      {/* Ayırıcı Çizgi */}
      <div className="h-px bg-gray-700 my-4" />

      {/* Çıkış Yap Butonu */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 
                   bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 
                   rounded-md transition-all duration-200 font-medium group"
      >
        <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Log Out</span>
      </button>
    </div>
  );
}