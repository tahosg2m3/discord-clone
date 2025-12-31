// backend/src/storage/inMemory.js
const { v4: uuidv4 } = require('uuid');

class InMemoryStorage {
  constructor() {
    this.servers = [];
    this.channels = [];
    this.users = [];

    // Initialize with default data
    this.seedData();
  }

  seedData() {
    // Create default server
    const defaultServer = {
      id: uuidv4(),
      name: 'My Server',
      createdAt: Date.now(),
    };
    this.servers.push(defaultServer);

    // Create default channels
    const defaultChannels = [
      { name: 'general', serverId: defaultServer.id },
      { name: 'random', serverId: defaultServer.id },
      { name: 'announcements', serverId: defaultServer.id },
    ];

    defaultChannels.forEach(channelData => {
      this.channels.push({
        id: uuidv4(),
        ...channelData,
        createdAt: Date.now(),
      });
    });
  }

  // Servers
  getAllServers() {
    return [...this.servers];
  }

  getServerById(id) {
    return this.servers.find(s => s.id === id);
  }

  createServer(name) {
    const server = {
      id: uuidv4(),
      name,
      createdAt: Date.now(),
    };
    this.servers.push(server);

    // Create default general channel
    this.createChannel(server.id, 'general');

    return server;
  }

  deleteServer(id) {
    const index = this.servers.findIndex(s => s.id === id);
    if (index !== -1) {
      this.servers.splice(index, 1);
      // Delete associated channels
      this.channels = this.channels.filter(c => c.serverId !== id);
      return true;
    }
    return false;
  }

  // Channels
  getChannelsByServerId(serverId) {
    return this.channels.filter(c => c.serverId === serverId);
  }

  getChannelById(id) {
    return this.channels.find(c => c.id === id);
  }

  createChannel(serverId, name) {
    const channel = {
      id: uuidv4(),
      serverId,
      name,
      createdAt: Date.now(),
    };
    this.channels.push(channel);
    return channel;
  }

  deleteChannel(id) {
    const index = this.channels.findIndex(c => c.id === id);
    if (index !== -1) {
      this.channels.splice(index, 1);
      return true;
    }
    return false;
  }

  // Users
  createUser(username) {
    const user = {
      id: uuidv4(),
      username,
      createdAt: Date.now(),
    };
    this.users.push(user);
    return user;
  }

  getUserByUsername(username) {
    return this.users.find(u => u.username === username);
  }

  getAllUsers() {
    return [...this.users];
  }

  // --- Yeni Eklenen Auth Metodları ---

  getUserByEmail(email) {
    return this.users.find(u => u.email === email);
  }

  getUserById(id) {
    return this.users.find(u => u.id === id);
  }

  createUserWithAuth({ username, email, password }) {
    const user = {
      id: uuidv4(),
      username,
      email,
      password, // hashed password olarak gelmeli
      createdAt: Date.now(),
    };
    this.users.push(user);
    return user;
  }
}

module.exports = new InMemoryStorage();