import { useState, useEffect } from 'react';
import { Plus, Compass } from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { fetchServers } from '../../services/api';
import ServerIcon from '../server/ServerIcon';
import CreateServerModal from '../server/CreateServerModal';
import JoinServerModal from '../server/JoinServerModal'; // YENİ
import UserProfile from '../profile/UserProfile';

export default function ServerList() {
  const { servers, setServers, currentServer, setCurrentServer } = useServer();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false); // YENİ STATE

  useEffect(() => {
    fetchServers().then(setServers).catch(console.error);
  }, [setServers]);

  return (
    <div className="w-18 bg-gray-900 flex flex-col items-center py-3 space-y-2 h-full overflow-y-auto no-scrollbar relative">
      
      {/* Sunucu Listesi */}
      {servers.map((server) => (
        <ServerIcon
          key={server.id}
          server={server}
          isActive={currentServer?.id === server.id}
          onClick={() => setCurrentServer(server)}
        />
      ))}

      {/* Ayırıcı */}
      <div className="w-8 h-0.5 bg-gray-800 rounded-full my-2 flex-shrink-0" />

      {/* Create Server Button (+ Green) */}
      <div className="relative group flex justify-center">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r my-auto h-2 opacity-0 group-hover:h-5 group-hover:opacity-100 transition-all duration-200" />
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-12 h-12 bg-gray-800 hover:bg-green-600 rounded-[24px] hover:rounded-[16px] transition-all duration-200 flex items-center justify-center group text-green-600 hover:text-white"
        >
          <Plus className="w-6 h-6 transition-colors" />
        </button>
        {/* Tooltip */}
        <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-black text-white text-sm rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
          Create a Server
        </div>
      </div>

      {/* Join Server Button (Compass) - YENİ */}
      <div className="relative group flex justify-center">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r my-auto h-2 opacity-0 group-hover:h-5 group-hover:opacity-100 transition-all duration-200" />
        <button
          onClick={() => setShowJoinModal(true)}
          className="w-12 h-12 bg-gray-800 hover:bg-green-600 rounded-[24px] hover:rounded-[16px] transition-all duration-200 flex items-center justify-center group text-green-600 hover:text-white"
        >
          <Compass className="w-6 h-6 transition-colors" />
        </button>
        {/* Tooltip */}
        <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-black text-white text-sm rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
          Join a Server
        </div>
      </div>

      {/* User Profile (Bottom) */}
      <div className="mt-auto pb-2 flex-shrink-0">
          <UserProfile />
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateServerModal onClose={() => setShowCreateModal(false)} />
      )}
      
      {showJoinModal && (
        <JoinServerModal onClose={() => setShowJoinModal(false)} />
      )}
    </div>
  );
}