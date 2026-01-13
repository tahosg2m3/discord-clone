import { createContext, useContext, useState, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { fetchDMConversations, createDMConversation } from '../services/api';

const DMContext = createContext(null);

export const useDM = () => {
  const context = useContext(DMContext);
  if (!context) throw new Error('useDM must be used within DMProvider');
  return context;
};

export const DMProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);

  // Kullanıcı değişince konuşmaları yükle
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  // Yeni konuşma veya güncelleme gelince listeyi yenile
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (updatedConversation) => {
      setConversations(prev => {
        // Listede varsa güncelle, yoksa başa ekle
        const exists = prev.find(c => c.id === updatedConversation.id);
        if (exists) {
          return prev.map(c => c.id === updatedConversation.id ? { ...c, ...updatedConversation } : c);
        }
        return [updatedConversation, ...prev];
      });
    };

    socket.on('dm:conversation-update', handleUpdate);

    return () => {
      socket.off('dm:conversation-update', handleUpdate);
    };
  }, [socket]);

  const loadConversations = async () => {
    try {
      const data = await fetchDMConversations(user.id);
      setConversations(data);
    } catch (error) {
      console.error('Conversations load failed:', error);
    }
  };

  const startConversation = async (otherUserId) => {
    try {
      // Zaten varsa onu aç
      const existing = conversations.find(c => 
        (c.user1Id === otherUserId || c.user2Id === otherUserId)
      );
      
      if (existing) {
        setCurrentConversation(existing);
        return existing;
      }

      // Yoksa API ile oluştur
      const conversation = await createDMConversation(user.id, otherUserId);
      
      setCurrentConversation(conversation);
      setConversations(prev => {
         if(!prev.find(c => c.id === conversation.id)) {
            return [conversation, ...prev];
         }
         return prev;
      });

      return conversation;
    } catch (error) {
      console.error('Failed to start conversation:', error);
    }
  };

  const value = {
    conversations,
    currentConversation,
    setCurrentConversation,
    startConversation
  };

  return <DMContext.Provider value={value}>{children}</DMContext.Provider>;
};