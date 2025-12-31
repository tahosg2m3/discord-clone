// frontend/src/components/layout/ServerList.jsx
import { useState, useEffect } from 'react';
import { Plus, Hash } from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { fetchServers, createServer } from '../../services/api';
import ServerIcon from '../server/ServerIcon';
import CreateServerModal from '../server/CreateServerModal';

export default function ServerList() {
  const { servers, setServers, currentServer, setCurrentServer } = useServer();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const data = await fetchServers();
      setServers(data);
      // Auto-select first server
      if (data.length > 0 && !currentServer) {
        setCurrentServer(data[0]);
      }
    } catch (error) {
      console.error('Failed to load servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateServer = async (name) => {
    try {
      const newServer = await createServer(name);
      setServers([...servers, newServer]);
      setCurrentServer(newServer);
      setShowModal(false);
    } catch (error) {
      console.error('Failed to create server:', error);
    }
  };

  if (loading) {
    return (
      <div className="w-18 bg-gray-950 flex flex-col items-center py-3 space-y-2">
        <div className="w-12 h-12 bg-gray-800 rounded-full animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <div className="w-18 bg-gray-950 flex flex-col items-center py-3 space-y-2">
        {/* Home Server (always present) */}
        <ServerIcon
          server={{ id: 'home', name: 'Home', icon: <Hash className="w-5 h-5" /> }}
          active={currentServer?.id === 'home'}
          onClick={() => setCurrentServer({ id: 'home', name: 'Home' })}
        />

        {/* Divider */}
        <div className="w-8 h-0.5 bg-gray-800 rounded-full" />

        {/* User's Servers */}
        {servers.map((server) => (
          <ServerIcon
            key={server.id}
            server={server}
            active={currentServer?.id === server.id}
            onClick={() => setCurrentServer(server)}
          />
        ))}

        {/* Add Server Button */}
        <button
          onClick={() => setShowModal(true)}
          className="w-12 h-12 bg-gray-800 hover:bg-green-600 hover:rounded-2xl 
                     rounded-full transition-all duration-200 flex items-center 
                     justify-center group"
        >
          <Plus className="w-6 h-6 text-green-500 group-hover:text-white" />
        </button>
      </div>

      {showModal && (
        <CreateServerModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreateServer}
        />
      )}
    </>
  );
}