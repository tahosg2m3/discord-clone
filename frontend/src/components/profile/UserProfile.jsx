import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Camera } from 'lucide-react';

export default function UserProfile() {
  const { user } = useAuth();
  const [avatar, setAvatar] = useState(user.avatar);

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

      // Update user avatar in backend
      await fetch(`http://localhost:3001/api/users/${user.id}/avatar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: data.url }),
      });
    } catch (error) {
      console.error('Failed to upload avatar:', error);
    }
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <div className="relative w-24 h-24 mx-auto mb-4">
        {avatar ? (
          <img src={avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
        ) : (
          <div className="w-full h-full rounded-full bg-blue-500 flex items-center justify-center text-white text-3xl font-bold">
            {user.username[0].toUpperCase()}
          </div>
        )}
        
        <label className="absolute bottom-0 right-0 p-2 bg-blue-600 rounded-full cursor-pointer hover:bg-blue-700">
          <Camera className="w-4 h-4" />
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </label>
      </div>

      <div className="text-center">
        <h3 className="text-white font-semibold text-lg">{user.username}</h3>
        <p className="text-gray-400 text-sm">{user.email}</p>
      </div>
    </div>
  );
}