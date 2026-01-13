import { useState } from 'react';
import { SocketProvider } from './context/SocketContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ServerProvider, useServer } from './context/ServerContext';
import { VoiceProvider } from './context/VoiceContext';
import { DMProvider, useDM } from './context/DMContext';
import { FriendsProvider } from './context/FriendsContext';
import { Toaster } from 'react-hot-toast'; // YENİ

import AuthScreen from './components/auth/AuthScreen';
import ServerList from './components/layout/ServerList';
import ChannelList from './components/layout/ChannelList';
import ChatArea from './components/layout/ChatArea';
import MemberList from './components/layout/MemberList';
import VoicePanel from './components/voice/VoicePanel';
import DMList from './components/dm/DMList';
import DMArea from './components/dm/DMArea';
import FriendsList from './components/friends/FriendsList';

import { Users, MessageSquare, Hash } from 'lucide-react';

function AppContent() {
  const { user } = useAuth();
  const { currentServer, currentChannel } = useServer();
  const [viewMode, setViewMode] = useState('servers');

  if (!user) return <AuthScreen />;

  return (
    <div className="h-screen flex bg-gray-900 text-gray-100">
      <div className="w-18 bg-gray-950 flex flex-col items-center py-3 space-y-2">
        <button onClick={() => setViewMode('dms')} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${viewMode === 'dms' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-blue-600'}`}>
          <MessageSquare className="w-6 h-6" />
        </button>
        <button onClick={() => setViewMode('friends')} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${viewMode === 'friends' ? 'bg-green-600' : 'bg-gray-800 hover:bg-green-600'}`}>
          <Users className="w-6 h-6" />
        </button>
        <div className="w-8 h-0.5 bg-gray-800 rounded-full my-2" />
        <button onClick={() => setViewMode('servers')} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${viewMode === 'servers' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-blue-600'}`}>
          <Hash className="w-6 h-6" />
        </button>
      </div>

      {viewMode === 'servers' && (
        <>
          <ServerList />
          {currentServer && <ChannelList />}
          <div className="flex-1 flex flex-col min-w-0">
            {currentChannel ? (
              <>
                <ChatArea />
                <VoicePanel />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <p>Select a channel to start chatting</p>
              </div>
            )}
          </div>
          {currentChannel && <MemberList />}
        </>
      )}

      {viewMode === 'dms' && (
        <>
          <DMList />
          <DMArea />
        </>
      )}

      {viewMode === 'friends' && <FriendsList />}
    </div>
  );
}

function App() {
  return (
    <SocketProvider>
      <AuthProvider>
        <FriendsProvider>
          <DMProvider>
            <ServerProvider>
              <VoiceProvider>
                <AppContent />
                {/* Tost Bildirimleri Buraya Eklendi */}
                <Toaster 
                  position="bottom-right"
                  toastOptions={{
                    style: { background: '#36393f', color: '#fff' }
                  }}
                />
              </VoiceProvider>
            </ServerProvider>
          </DMProvider>
        </FriendsProvider>
      </AuthProvider>
    </SocketProvider>
  );
}

export default App;