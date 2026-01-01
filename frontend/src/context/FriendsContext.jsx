// frontend/src/context/FriendsContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

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
      const response = await fetch(`http://localhost:3001/api/friends/${user.id}`);
      const data = await response.json();
      setFriends(data);
    } catch (error) {
      console.error('Failed to load friends:', error);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/friends/${user.id}/pending`
      );
      const data = await response.json();
      setPendingRequests(data);
    } catch (error) {
      console.error('Failed to load pending requests:', error);
    }
  };

  const sendFriendRequest = async (toUserId) => {
    try {
      const response = await fetch('http://localhost:3001/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: user.id,
          toUserId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      return true;
    } catch (error) {
      console.error('Failed to send friend request:', error);
      throw error;
    }
  };

  const acceptFriendRequest = async (requestId) => {
    try {
      await fetch('http://localhost:3001/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });

      await loadFriends();
      await loadPendingRequests();
    } catch (error) {
      console.error('Failed to accept friend request:', error);
    }
  };

  const rejectFriendRequest = async (requestId) => {
    try {
      await fetch('http://localhost:3001/api/friends/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });

      await loadPendingRequests();
    } catch (error) {
      console.error('Failed to reject friend request:', error);
    }
  };

  const removeFriend = async (friendId) => {
    try {
      await fetch(`http://localhost:3001/api/friends/${user.id}/${friendId}`, {
        method: 'DELETE',
      });

      await loadFriends();
    } catch (error) {
      console.error('Failed to remove friend:', error);
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