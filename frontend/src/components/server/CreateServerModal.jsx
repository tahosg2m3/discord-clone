import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { createServer } from '../../services/api'; // API import edildi
import { useAuth } from '../../context/AuthContext';
import { useServer } from '../../context/ServerContext'; // Context import edildi
import toast from 'react-hot-toast';

export default function CreateServerModal({ onClose }) {
  const [serverName, setServerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { setServers, setCurrentServer } = useServer(); // Context'ten setter'ları al

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!serverName.trim()) return;

    setIsLoading(true);
    try {
      // 1. API isteğini direkt burada yapıyoruz
      const newServer = await createServer(serverName.trim(), user.id);
      
      // 2. Sunucu listesini güncelle
      setServers(prev => [...prev, newServer]);
      
      // 3. Yeni sunucuya geçiş yap
      setCurrentServer(newServer);
      
      toast.success(`Server "${newServer.name}" created!`);
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Failed to create server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-gray-800 rounded-lg w-full max-w-md overflow-hidden shadow-2xl relative">
        
        {/* Kapatma Butonu */}
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-200"
        >
            <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="p-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Customize Your Server</h2>
          <p className="text-gray-400 text-sm">
            Give your new server a personality with a name and an icon. You can always change it later.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6">
          {/* Icon Upload Placeholder */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 border-2 border-dashed border-gray-600 rounded-full flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:bg-gray-700/50 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 mb-1" />
              <span className="text-xs font-bold uppercase">Upload</span>
            </div>
          </div>

          {/* Server Name Input */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
              Server Name
            </label>
            <input
              type="text"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder={`${user?.username}'s server`}
              className="w-full bg-gray-900 text-white p-3 rounded border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-2">
              By creating a server, you agree to Discord's Community Guidelines.
            </p>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-between items-center bg-gray-700/30 -mx-6 -mb-6 p-4 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="text-gray-300 hover:underline text-sm px-4"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isLoading || !serverName}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg shadow-blue-900/20"
            >
              {isLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}