import { useState } from 'react';
import { SocketProvider } from './context/SocketContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ServerProvider, useServer } from './context/ServerContext';
import { VoiceProvider } from './context/VoiceContext';
import { DMProvider } from './context/DMContext';
import { FriendsProvider } from './context/FriendsContext';
import { Toaster } from 'react-hot-toast';

import AuthScreen from './components/auth/AuthScreen';
import ServerList from './components/layout/ServerList';
import ChannelList from './components/layout/ChannelList';
import ChatArea from './components/layout/ChatArea';
import MemberList from './components/layout/MemberList';
import VoicePanel from './components/voice/VoicePanel';
import DMList from './components/dm/DMList';
import DMArea from './components/dm/DMArea';
import FriendsList from './components/friends/FriendsList';
import UserProfile from './components/profile/UserProfile'; // Profilimizi içe aktardık

function AppContent() {
  const { user } = useAuth();
  const { currentServer, currentChannel } = useServer();
  const [viewMode, setViewMode] = useState('dms'); 

  if (!user) return <AuthScreen />;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#1E1F22] text-[#DBDEE1] font-sans selection:bg-[#5865F2] selection:text-white">
      
      {/* 1. SÜTUN: EN SOL BAR (72px) - Sunucular */}
      <ServerList viewMode={viewMode} setViewMode={setViewMode} />

      {/* 2. SÜTUN: ORTA YAN BAR (240px) */}
      <div className="flex flex-col w-[240px] bg-[#2B2D31] flex-shrink-0 rounded-tl-lg overflow-hidden border-r border-[#1E1F22]/50 shadow-sm">
        
        {/* Üst Kısım: Kanallar veya DM/Arkadaş Listesi */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {viewMode === 'servers' ? (
            currentServer ? <ChannelList /> : null
          ) : (
            <DMList setViewMode={setViewMode} />
          )}
        </div>

        {/* ALT KISIM: İŞTE YENİ PROFİL BARIMIZ BURADA! */}
        <UserProfile />

      </div>

      {/* 3. SÜTUN: ANA İÇERİK (Esnek Genişlik) - Sohbet Ekranı */}
      <div className="flex flex-col flex-1 min-w-0 bg-[#313338] relative">
        {viewMode === 'servers' ? (
          currentChannel ? (
            <>
              <ChatArea />
              <VoicePanel />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#949BA4] select-none">
              <div className="w-20 h-20 mb-6 bg-[#2B2D31] rounded-full flex items-center justify-center shadow-inner">
                <span className="text-4xl font-bold text-[#404249]">#</span>
              </div>
              <h3 className="text-xl font-bold text-[#F2F3F5] mb-2">Kanal Seçilmedi</h3>
              <p className="text-[15px]">Sohbete başlamak için sol taraftan bir metin veya ses kanalı seçin.</p>
            </div>
          )
        ) : viewMode === 'friends' ? (
          <FriendsList />
        ) : (
          <DMArea />
        )}
      </div>

      {/* 4. SÜTUN: SAĞ BAR (240px) - Üye Listesi */}
      {viewMode === 'servers' && currentChannel && (
        <div className="flex flex-col w-[240px] bg-[#2B2D31] flex-shrink-0 border-l border-[#1E1F22]/50">
          <MemberList />
        </div>
      )}

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
                <Toaster position="bottom-right" toastOptions={{ style: { background: '#111214', color: '#DBDEE1', borderRadius: '8px', fontSize: '14px', fontWeight: '500' } }} />
              </VoiceProvider>
            </ServerProvider>
          </DMProvider>
        </FriendsProvider>
      </AuthProvider>
    </SocketProvider>
  );
}

export default App;