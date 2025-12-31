import { createContext, useContext, useState, useEffect } from 'react';
import { useSocket } from './SocketContext';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const { connect, disconnect } = useSocket();

  // Load user from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('chat_user');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      connect();
    }
  }, [connect]);

  const login = async (username) => {
    try {
      const response = await fetch('http://localhost:3001/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) throw new Error('Login failed');

      const userData = await response.json();
      setUser(userData);
      localStorage.setItem('chat_user', JSON.stringify(userData));
      connect();
      
      return userData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('chat_user');
    disconnect();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};