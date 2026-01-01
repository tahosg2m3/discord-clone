// frontend/src/services/api.js
const API_URL = 'http://localhost:3001/api';

// Generic fetch wrapper
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Auth
export const loginUser = (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) });
export const registerUser = (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) });
export const verifyToken = () => request('/auth/verify');

// Servers
export const fetchServers = () => request('/servers');
export const fetchServerById = (id) => request(`/servers/${id}`);
export const createServer = (name, creatorId) => request('/servers', { method: 'POST', body: JSON.stringify({ name, creatorId }) });
export const deleteServer = (id) => request(`/servers/${id}`, { method: 'DELETE' });

// Channels
export const fetchChannels = (serverId) => request(`/channels?serverId=${serverId}`);
export const fetchChannelById = (id) => request(`/channels/${id}`);
export const createChannel = (serverId, name, type = 'text') => request('/channels', { method: 'POST', body: JSON.stringify({ serverId, name, type }) });
export const deleteChannel = (id) => request(`/channels/${id}`, { method: 'DELETE' });

// Users
export const fetchUsers = () => request('/users');

// Friends (YENİ EKLENENLER)
export const fetchFriends = (userId) => request(`/friends/${userId}`);
export const fetchPendingRequests = (userId) => request(`/friends/${userId}/pending`);

// GÜNCELLEME: targetUsername gönderiyoruz
export const sendFriendRequest = (fromUserId, targetUsername) => 
  request('/friends/request', { 
    method: 'POST', 
    body: JSON.stringify({ fromUserId, targetUsername }) 
  });

export const acceptFriendRequest = (requestId) => 
  request('/friends/accept', { 
    method: 'POST', 
    body: JSON.stringify({ requestId }) 
  });

export const rejectFriendRequest = (requestId) => 
  request('/friends/reject', { 
    method: 'POST', 
    body: JSON.stringify({ requestId }) 
  });

// DM
export const fetchDMConversations = (userId) => request(`/dm/${userId}`);
export const fetchDMMessages = (conversationId) => request(`/dm/messages/${conversationId}`);
export const createDMConversation = (userId1, userId2) => 
  request('/dm/create', { 
    method: 'POST', 
    body: JSON.stringify({ userId1, userId2 }) 
  });