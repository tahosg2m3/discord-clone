import { useState, useEffect } from 'react';
import { SocketProvider } from './context/SocketContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ServerProvider, useServer } from './context/ServerContext';
import LoginForm from './components/auth/LoginForm';
import ServerList from './components/layout/ServerList';
import ChannelList from './components/layout/ChannelList';
import ChatArea from './components/layout/ChatArea';
import MemberList from './components/layout/MemberList';

function AppContent() {
  const { user } = useAuth();
  const { currentServer, currentChannel } = useServer();

  if (!user) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <LoginForm />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-900 text-gray-100">
      {/* Left Sidebar - Server Icons */}
      <ServerList />

      {/* Second Sidebar - Channels */}
      {currentServer && <ChannelList />}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentChannel ? (
          <ChatArea />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <p>Select a channel to start chatting</p>
          </div>
        )}
      </div>

      {/* Right Sidebar - Members */}
      {currentChannel && <MemberList />}
    </div>
  );
}

function App() {
  return (
    <SocketProvider>
      <AuthProvider>
        <ServerProvider>
          <AppContent />
        </ServerProvider>
      </AuthProvider>
    </SocketProvider>
  );
}

export default App;