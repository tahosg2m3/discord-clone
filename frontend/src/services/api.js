const API_URL = 'http://localhost:3001/api';

const RUNTIME_API_URL = import.meta.env.VITE_API_URL || API_URL;

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('chat_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${RUNTIME_API_URL}${endpoint}`, { ...options, headers });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }
  return response.json();
}

// Auth
export const loginUser = (data) =>
  request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const verifyTwoFactorCode = (data) =>
  request('/auth/verify-2fa', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const resendTwoFactorCode = (data) =>
  request('/auth/resend-2fa', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const registerUser = (data) =>
  request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const verifyToken = () => request('/auth/verify');

export const requestPasswordReset = (email) => request('/auth/request-password-reset', {
  method: 'POST',
  body: JSON.stringify({ email }),
});

export const resendPasswordReset = (resetTicket) => request('/auth/resend-password-reset', {
  method: 'POST',
  body: JSON.stringify({ resetTicket }),
});

export const resetPassword = (data) => request('/auth/reset-password', {
  method: 'POST',
  body: JSON.stringify(data),
});

export const requestEmailChange = (data) => request('/auth/request-email-change', {
  method: 'POST',
  body: JSON.stringify(data),
});

export const resendEmailChange = (emailChangeTicket) => request('/auth/resend-email-change', {
  method: 'POST',
  body: JSON.stringify({ emailChangeTicket }),
});

export const confirmEmailChange = (data) => request('/auth/confirm-email-change', {
  method: 'POST',
  body: JSON.stringify(data),
});

// Servers
export const fetchServers = (userId) => request(`/servers?userId=${userId}`);
export const fetchServerById = (id) => request(`/servers/${id}`);
export const createServer = (name, creatorId) => request('/servers', { method: 'POST', body: JSON.stringify({ name, creatorId }) });
export const deleteServer = (id) => request(`/servers/${id}`, { method: 'DELETE' });
export const joinServer = (inviteCode, userId) => request('/servers/join', { method: 'POST', body: JSON.stringify({ inviteCode, userId }) });

// YENİLER:
export const leaveServer = (serverId, userId) => request(`/servers/${serverId}/leave`, { method: 'POST', body: JSON.stringify({ userId }) });
export const fetchServerMembers = (serverId) => request(`/servers/${serverId}/members`);

// Channels & Messages
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
export const removeFriend = (userId, friendId) => request(`/friends/${userId}/${friendId}`, { method: 'DELETE' });

// DM
export const fetchDMConversations = (userId) => request(`/dm/${userId}`);
export const fetchDMMessages = (conversationId) => request(`/dm/messages/${conversationId}`);
export const createDMConversation = (userId1, userId2) => request('/dm/create', { method: 'POST', body: JSON.stringify({ userId1, userId2 }) });
export const createGroupDM = ({ name, icon = null, memberIds }) => request('/dm/groups', {
  method: 'POST',
  body: JSON.stringify({ name, icon, memberIds }),
});
export const fetchGroupDM = (conversationId) => request(`/dm/groups/${conversationId}`);
export const updateGroupDM = (conversationId, updates) => request(`/dm/groups/${conversationId}`, {
  method: 'PATCH',
  body: JSON.stringify(updates),
});
export const addGroupDMMember = (conversationId, userId) => request(`/dm/groups/${conversationId}/members`, {
  method: 'POST',
  body: JSON.stringify({ userId }),
});
export const removeGroupDMMember = (conversationId, userId) => request(`/dm/groups/${conversationId}/members/${userId}`, {
  method: 'DELETE',
});
export const leaveGroupDM = (conversationId) => request(`/dm/groups/${conversationId}/leave`, { method: 'POST' });
