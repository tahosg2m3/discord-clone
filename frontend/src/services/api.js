const API_URL = 'http://localhost:3001/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('chat_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
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
export const createServer = (name) => request('/servers', { method: 'POST', body: JSON.stringify({ name }) });
export const deleteServer = (id) => request(`/servers/${id}`, { method: 'DELETE' });

// Channels & Messages (UPDATED)
export const fetchChannels = (serverId) => request(`/channels?serverId=${serverId}`);
export const fetchChannelMessages = (channelId, before = null) => {
  const query = before ? `?before=${before}&limit=50` : '?limit=50';
  return request(`/channels/${channelId}/messages${query}`);
};
export const createChannel = (serverId, name, type) => request('/channels', { method: 'POST', body: JSON.stringify({ serverId, name, type }) });
export const deleteChannel = (id) => request(`/channels/${id}`, { method: 'DELETE' });

// Users & Friends
export const fetchUsers = () => request('/users');
export const fetchFriends = (userId) => request(`/friends/${userId}`);
export const fetchPendingRequests = (userId) => request(`/friends/${userId}/pending`);
export const sendFriendRequest = (fromUserId, targetUsername) => request('/friends/request', { method: 'POST', body: JSON.stringify({ fromUserId, targetUsername }) });
export const acceptFriendRequest = (requestId) => request('/friends/accept', { method: 'POST', body: JSON.stringify({ requestId }) });
export const rejectFriendRequest = (requestId) => request('/friends/reject', { method: 'POST', body: JSON.stringify({ requestId }) });

// DM
export const fetchDMConversations = (userId) => request(`/dm/${userId}`);
export const fetchDMMessages = (conversationId) => request(`/dm/messages/${conversationId}`);
export const createDMConversation = (userId1, userId2) => request('/dm/create', { method: 'POST', body: JSON.stringify({ userId1, userId2 }) });