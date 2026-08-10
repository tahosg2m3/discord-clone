// frontend/src/context/FriendsContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import {
  acceptFriendRequest as acceptFriendRequestApi,
  fetchFriends,
  fetchPendingRequests,
  rejectFriendRequest as rejectFriendRequestApi,
  removeFriend as removeFriendApi,
  sendFriendRequest as sendFriendRequestApi,
} from '../services/api';

const FriendsContext = createContext(null);

export const useFriends = () => {
  const context = useContext(FriendsContext);
  if (!context) throw new Error('useFriends must be used within FriendsProvider');
  return context;
};

export const FriendsProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);

  useEffect(() => {
    if (user) {
      loadFriends();
      loadPendingRequests();
    }
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    // Listen for status updates
    socket.on('status:update', ({ userId, status }) => {
      setFriends(prev =>
        prev.map(friend =>
          friend.id === userId ? { ...friend, status } : friend
        )
      );
    });

    return () => {
      socket.off('status:update');
    };
  }, [socket]);

  const loadFriends = async () => {
    try {
      const data = await fetchFriends(user.id);
      setFriends(data);
    } catch (error) {
      console.error('Failed to load friends:', error);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const data = await fetchPendingRequests(user.id);
      setPendingRequests(data);
    } catch (error) {
      console.error('Failed to load pending requests:', error);
    }
  };

  const sendFriendRequest = async (targetUsername) => {
    try {
      await sendFriendRequestApi(user.id, targetUsername);
      return true;
    } catch (error) {
      console.error('Failed to send friend request:', error);
      throw error;
    }
  };

  const acceptFriendRequest = async (requestId) => {
    try {
      await acceptFriendRequestApi(requestId);

      await loadFriends();
      await loadPendingRequests();
    } catch (error) {
      console.error('Failed to accept friend request:', error);
    }
  };

  const rejectFriendRequest = async (requestId) => {
    try {
      await rejectFriendRequestApi(requestId);

      await loadPendingRequests();
    } catch (error) {
      console.error('Failed to reject friend request:', error);
    }
  };

  const removeFriend = async (friendId) => {
    try {
      await removeFriendApi(user.id, friendId);
      setFriends((previous) => previous.filter((friend) => friend.id !== friendId));
      return true;
    } catch (error) {
      console.error('Failed to remove friend:', error);
      throw error;
    }
  };

  const value = {
    friends,
    pendingRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
  };

  return (
    <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>
  );
};
