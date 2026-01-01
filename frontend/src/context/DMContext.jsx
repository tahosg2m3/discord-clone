// frontend/src/context/DMContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

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
  const [dmMessages, setDmMessages] = useState({});

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    socket.on('dm:receive', (message) => {
      setDmMessages(prev => ({
        ...prev,
        [message.conversationId]: [
          ...(prev[message.conversationId] || []),
          message,
        ],
      }));
    });

    return () => {
      socket.off('dm:receive');
    };
  }, [socket]);

  const loadConversations = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/dm/${user.id}`);
      const data = await response.json();
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const startConversation = async (otherUserId) => {
    try {
      const response = await fetch('http://localhost:3001/api/dm/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId1: user.id,
          userId2: otherUserId,
        }),
      });

      const conversation = await response.json();
      
      // Load messages for this conversation
      await loadConversationMessages(conversation.id);
      
      setCurrentConversation(conversation);
      
      // Add to conversations if not already there
      if (!conversations.find(c => c.id === conversation.id)) {
        setConversations([...conversations, conversation]);
      }

      return conversation;
    } catch (error) {
      console.error('Failed to start conversation:', error);
    }
  };

  const loadConversationMessages = async (conversationId) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/dm/messages/${conversationId}`
      );
      const messages = await response.json();
      setDmMessages(prev => ({
        ...prev,
        [conversationId]: messages,
      }));
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const sendDM = (content) => {
    if (!socket || !currentConversation) return;

    socket.emit('dm:send', {
      conversationId: currentConversation.id,
      content,
    });
  };

  const value = {
    conversations,
    currentConversation,
    setCurrentConversation,
    dmMessages,
    startConversation,
    sendDM,
  };

  return <DMContext.Provider value={value}>{children}</DMContext.Provider>;
};