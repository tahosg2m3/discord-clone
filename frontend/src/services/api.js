const API_URL = 'http://localhost:3001/api';

// Generic fetch wrapper
async function request(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Servers
export const fetchServers = () => request('/servers');

export const fetchServerById = (id) => request(`/servers/${id}`);

export const createServer = (name) =>
  request('/servers', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

export const deleteServer = (id) =>
  request(`/servers/${id}`, { method: 'DELETE' });

// Channels
export const fetchChannels = (serverId) =>
  request(`/channels?serverId=${serverId}`);

export const fetchChannelById = (id) => request(`/channels/${id}`);

export const createChannel = (serverId, name) =>
  request('/channels', {
    method: 'POST',
    body: JSON.stringify({ serverId, name }),
  });

export const deleteChannel = (id) =>
  request(`/channels/${id}`, { method: 'DELETE' });

// Users
export const loginUser = (username) =>
  request('/users/login', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });

export const fetchUsers = () => request('/users');
