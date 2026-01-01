// backend/src/storage/inMemory.js - KOMPLE YENİ VERSİYON
const { v4: uuidv4 } = require('uuid');

class InMemoryStorage {
  constructor() {
    this.servers = [];
    this.channels = [];
    this.users = [];
    this.dmConversations = [];
    this.dmMessages = new Map();
    this.friendRequests = [];
    this.friendships = [];
    this.userStatuses = new Map(); // userId -> status (online/offline/dnd)
    this.serverMembers = new Map(); // serverId -> [userIds]
    this.seedData();
  }

  seedData() {
    const defaultServer = {
      id: uuidv4(),
      name: 'My Server',
      createdAt: Date.now(),
    };
    this.servers.push(defaultServer);

    const defaultChannels = [
      { name: 'general', serverId: defaultServer.id, type: 'text' },
      { name: 'random', serverId: defaultServer.id, type: 'text' },
      { name: 'Voice Channel', serverId: defaultServer.id, type: 'voice' },
    ];

    defaultChannels.forEach(channelData => {
      this.channels.push({
        id: uuidv4(),
        ...channelData,
        createdAt: Date.now(),
      });
    });
  }

  // ==================== SERVERS ====================
  getAllServers() {
    return [...this.servers];
  }

  getServerById(id) {
    return this.servers.find(s => s.id === id);
  }

  createServer(name, creatorId) {
    const server = {
      id: uuidv4(),
      name,
      creatorId,
      createdAt: Date.now(),
    };
    this.servers.push(server);
    this.createChannel(server.id, 'general', 'text');
    this.addServerMember(server.id, creatorId);
    return server;
  }

  deleteServer(id) {
    const index = this.servers.findIndex(s => s.id === id);
    if (index !== -1) {
      this.servers.splice(index, 1);
      this.channels = this.channels.filter(c => c.serverId !== id);
      this.serverMembers.delete(id);
      return true;
    }
    return false;
  }

  // ==================== CHANNELS ====================
  getChannelsByServerId(serverId) {
    return this.channels.filter(c => c.serverId === serverId);
  }

  getChannelById(id) {
    return this.channels.find(c => c.id === id);
  }

  createChannel(serverId, name, type = 'text') {
    const channel = {
      id: uuidv4(),
      serverId,
      name,
      type,
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

  // ==================== USERS ====================
  createUser(username) {
    const user = {
      id: uuidv4(),
      username,
      createdAt: Date.now(),
    };
    this.users.push(user);
    return user;
  }

  createUserWithAuth({ username, email, password }) {
    // Check if username already exists
    if (this.getUserByUsername(username)) {
      throw new Error('Username already taken');
    }

    // Check if email already exists
    if (this.getUserByEmail(email)) {
      throw new Error('Email already registered');
    }

    const user = {
      id: uuidv4(),
      username,
      email,
      password,
      avatar: null,
      status: 'online',
      createdAt: Date.now(),
    };
    this.users.push(user);
    this.userStatuses.set(user.id, 'online');
    return user;
  }

  getUserByUsername(username) {
    return this.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  getUserByEmail(email) {
    return this.users.find(u => u.email === email);
  }

  getUserById(id) {
    return this.users.find(u => u.id === id);
  }

  getAllUsers() {
    return [...this.users];
  }

  updateUserAvatar(userId, avatarUrl) {
    const user = this.getUserById(userId);
    if (user) {
      user.avatar = avatarUrl;
      return user;
    }
    return null;
  }

  updateUserStatus(userId, status) {
    this.userStatuses.set(userId, status);
    const user = this.getUserById(userId);
    if (user) {
      user.status = status;
    }
  }

  getUserStatus(userId) {
    return this.userStatuses.get(userId) || 'offline';
  }

  // ==================== SERVER MEMBERS ====================
  addServerMember(serverId, userId) {
    if (!this.serverMembers.has(serverId)) {
      this.serverMembers.set(serverId, []);
    }
    const members = this.serverMembers.get(serverId);
    if (!members.includes(userId)) {
      members.push(userId);
    }
  }

  removeServerMember(serverId, userId) {
    if (this.serverMembers.has(serverId)) {
      const members = this.serverMembers.get(serverId);
      const index = members.indexOf(userId);
      if (index !== -1) {
        members.splice(index, 1);
      }
    }
  }

  getServerMembers(serverId) {
    const memberIds = this.serverMembers.get(serverId) || [];
    return memberIds.map(id => this.getUserById(id)).filter(Boolean);
  }

  // ==================== DM CONVERSATIONS ====================
  getOrCreateDMConversation(userId1, userId2) {
    // Sort IDs to ensure consistent lookup
    const [id1, id2] = [userId1, userId2].sort();
    
    let conversation = this.dmConversations.find(
      c => (c.user1Id === id1 && c.user2Id === id2)
    );

    if (!conversation) {
      conversation = {
        id: uuidv4(),
        user1Id: id1,
        user2Id: id2,
        createdAt: Date.now(),
      };
      this.dmConversations.push(conversation);
      this.dmMessages.set(conversation.id, []);
    }

    return conversation;
  }

  getUserDMConversations(userId) {
    return this.dmConversations
      .filter(c => c.user1Id === userId || c.user2Id === userId)
      .map(c => {
        const otherUserId = c.user1Id === userId ? c.user2Id : c.user1Id;
        const otherUser = this.getUserById(otherUserId);
        return {
          ...c,
          otherUser,
        };
      });
  }

  getDMMessages(conversationId) {
    return this.dmMessages.get(conversationId) || [];
  }

  addDMMessage(conversationId, message) {
    if (!this.dmMessages.has(conversationId)) {
      this.dmMessages.set(conversationId, []);
    }
    this.dmMessages.get(conversationId).push(message);
  }

  // ==================== FRIENDS ====================
  createFriendRequest(fromUserId, toUserId) {
    // Check if already friends
    const areFriends = this.friendships.some(
      f => (f.user1Id === fromUserId && f.user2Id === toUserId) ||
           (f.user1Id === toUserId && f.user2Id === fromUserId)
    );
    
    if (areFriends) return null;

    // Check if request already exists
    const existingRequest = this.friendRequests.find(
      r => (r.fromUserId === fromUserId && r.toUserId === toUserId) ||
           (r.fromUserId === toUserId && r.toUserId === fromUserId)
    );
    
    if (existingRequest) return null;

    const request = {
      id: uuidv4(),
      fromUserId,
      toUserId,
      status: 'pending',
      createdAt: Date.now(),
    };
    
    this.friendRequests.push(request);
    return request;
  }

  getPendingFriendRequests(userId) {
    return this.friendRequests
      .filter(r => r.toUserId === userId && r.status === 'pending')
      .map(r => ({
        ...r,
        fromUser: this.getUserById(r.fromUserId),
      }));
  }

  acceptFriendRequest(requestId) {
    const request = this.friendRequests.find(r => r.id === requestId);
    if (!request) return false;

    request.status = 'accepted';

    // Create friendship
    const [id1, id2] = [request.fromUserId, request.toUserId].sort();
    this.friendships.push({
      id: uuidv4(),
      user1Id: id1,
      user2Id: id2,
      createdAt: Date.now(),
    });

    return true;
  }

  rejectFriendRequest(requestId) {
    const index = this.friendRequests.findIndex(r => r.id === requestId);
    if (index === -1) return false;
    
    this.friendRequests.splice(index, 1);
    return true;
  }

  getUserFriends(userId) {
    const friendships = this.friendships.filter(
      f => f.user1Id === userId || f.user2Id === userId
    );

    return friendships.map(f => {
      const friendId = f.user1Id === userId ? f.user2Id : f.user1Id;
      const friend = this.getUserById(friendId);
      return {
        ...friend,
        status: this.getUserStatus(friendId),
      };
    });
  }

  removeFriend(userId, friendId) {
    const [id1, id2] = [userId, friendId].sort();
    const index = this.friendships.findIndex(
      f => f.user1Id === id1 && f.user2Id === id2
    );
    
    if (index !== -1) {
      this.friendships.splice(index, 1);
    }
  }
}

module.exports = new InMemoryStorage();