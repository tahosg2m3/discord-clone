import { useState } from 'react';
import { X, Trash2, Save, AlertTriangle } from 'lucide-react';
import { updateServer, deleteServer } from '../../services/api';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function ServerSettingsModal({ onClose }) {
  const { currentServer, setServers, setCurrentServer } = useServer();
  const { user } = useAuth();
  
  const [serverName, setServerName] = useState(currentServer.name);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'delete'

  const isOwner = currentServer.creatorId === user.id;

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!serverName.trim()) return;

    setIsLoading(true);
    try {
      const updated = await updateServer(currentServer.id, { 
        name: serverName,
        userId: user.id 
      });

      // Context'i güncelle
      setServers(prev => prev.map(s => s.id === currentServer.id ? updated : s));
      setCurrentServer(updated);
      
      toast.success('Server updated');
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to update');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${currentServer.name}? This cannot be undone.`)) return;

    setIsLoading(true);
    try {
      await deleteServer(currentServer.id);
      
      setServers(prev => prev.filter(s => s.id !== currentServer.id));
      setCurrentServer(null);
      
      toast.success('Server deleted');
      onClose();
    } catch (error) {
      toast.error('Failed to delete server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-lg w-full max-w-2xl h-[500px] flex overflow-hidden shadow-2xl relative">
        
        {/* SOL MENÜ */}
        <div className="w-1/3 bg-gray-100 p-4 flex flex-col">
          <h2 className="text-xs font-bold text-gray-500 uppercase mb-3 px-2">
            {currentServer.name}
          </h2>
          <button 
            onClick={() => setActiveTab('overview')}
            className={`text-left px-2 py-1.5 rounded text-sm font-medium mb-1 ${activeTab === 'overview' ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-200/50'}`}
          >
            Overview
          </button>
          
          {isOwner && (
            <>
              <div className="h-px bg-gray-300 my-2" />
              <button 
                onClick={() => setActiveTab('delete')}
                className={`text-left px-2 py-1.5 rounded text-sm font-medium text-red-600 hover:bg-red-50 flex items-center justify-between ${activeTab === 'delete' ? 'bg-red-50' : ''}`}
              >
                Delete Server
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* SAĞ İÇERİK */}
        <div className="flex-1 bg-white p-10 flex flex-col relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 flex flex-col items-center"
          >
            <div className="border-2 border-gray-400 rounded-full p-1 mb-1">
               <X className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold uppercase">Esc</span>
          </button>

          {activeTab === 'overview' && (
            <div className="animate-in slide-in-from-right-4 duration-300">
              <h1 className="text-xl font-bold text-gray-900 mb-6">Server Overview</h1>
              
              <div className="flex gap-8">
                 {/* Icon Placeholder */}
                 <div className="flex flex-col items-center gap-2">
                    <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center text-2xl font-bold text-gray-500">
                        {currentServer.name[0].toUpperCase()}
                    </div>
                    <span className="text-xs text-gray-500">Min 128x128</span>
                 </div>

                 {/* Form */}
                 <form onSubmit={handleUpdate} className="flex-1">
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                            Server Name
                        </label>
                        <input
                            type="text"
                            value={serverName}
                            onChange={(e) => setServerName(e.target.value)}
                            disabled={!isOwner}
                            className="w-full bg-gray-100 border border-gray-300 rounded p-2 text-gray-900 focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    
                    {isOwner && (
                        <div className="bg-gray-50 p-4 rounded-lg mt-10 flex items-center justify-between">
                            <span className="text-sm text-gray-600">Careful, you have unsaved changes!</span>
                            <button 
                                type="submit"
                                disabled={isLoading || serverName === currentServer.name}
                                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isLoading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    )}
                 </form>
              </div>
            </div>
          )}

          {activeTab === 'delete' && isOwner && (
             <div className="animate-in slide-in-from-right-4 duration-300">
                <h1 className="text-xl font-bold text-gray-900 mb-4">Delete Server</h1>
                <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
                    <h3 className="text-red-800 font-bold flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5" />
                        Warning
                    </h3>
                    <p className="text-red-700 text-sm">
                        Deleting <strong>{currentServer.name}</strong> cannot be undone. All channels, messages, and roles will be lost forever.
                    </p>
                </div>
                
                <button
                    onClick={handleDelete}
                    disabled={isLoading}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium disabled:opacity-50 transition-colors w-full sm:w-auto"
                >
                    {isLoading ? 'Deleting...' : 'Delete Server'}
                </button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}