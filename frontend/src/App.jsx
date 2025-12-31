// frontend/src/App.jsx
import { SocketProvider } from './context/SocketContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ServerProvider, useServer } from './context/ServerContext';
import { VoiceProvider } from './context/VoiceContext';
import AuthScreen from './components/auth/AuthScreen';
import ServerList from './components/layout/ServerList';
import ChannelList from './components/layout/ChannelList';
import ChatArea from './components/layout/ChatArea';
import MemberList from './components/layout/MemberList';
import VoicePanel from './components/voice/VoicePanel';
import VideoGrid from './components/voice/VideoGrid'; // EKLENDİ

function AppContent() {
  const { user } = useAuth();
  const { currentServer, currentChannel } = useServer();

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="h-screen flex bg-gray-900 text-gray-100">
      <ServerList />
      {currentServer && <ChannelList />}

      <div className="flex-1 flex flex-col min-w-0">
        {currentChannel ? (
          <>
            {/* Video Izgarası Sohbetin Üstünde Görünsün */}
            <VideoGrid /> 
            
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
    </div>
  );
}

function App() {
  return (
    <SocketProvider>
      <AuthProvider>
        <ServerProvider>
          <VoiceProvider>
            <AppContent />
          </VoiceProvider>
        </ServerProvider>
      </AuthProvider>
    </SocketProvider>
  );
}

export default App;