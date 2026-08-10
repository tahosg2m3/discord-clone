import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isPresenceReady, setIsPresenceReady] = useState(false);

  useEffect(() => {
    // Kullanıcı giriş yapmadıysa boşuna bağlanmaya çalışma
    if (!user) {
       setSocket(null);
       setIsPresenceReady(false);
       return;
    }

    const token = localStorage.getItem('chat_token');
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });

    newSocket.on('connect', () => {
      console.log('🟢 Soket Hesabına Bağlandı:', newSocket.id);
      newSocket.emit('authenticate', { userId: user.id, username: user.username });
    });

    newSocket.on('presence:ready', () => setIsPresenceReady(true));
    newSocket.on('disconnect', () => setIsPresenceReady(false));

    newSocket.on('connect_error', (err) => {
      console.error('🔴 Soket Hatası:', err.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, isPresenceReady }}>
      {children}
    </SocketContext.Provider>
  );
};
