const { v4: uuidv4 } = require('uuid');

class Storage {
  constructor() {
    this.users = [];
    this.servers = [
      {
        id: 'default-server',
        name: 'General Server',
        icon: null,
        creatorId: 'system',
        inviteCode: 'PUBLIC', // Varsayılan sunucu için kod
        members: [], // Dinamik olarak doldurulur
        channels: []
      }
    ];
    this.channels = [
      { id: 'general', serverId: 'default-server', name: 'general', type: 'text' },
      { id: 'voice-general', serverId: 'default-server', name: 'General Voice', type: 'voice' }
    ];
    this.messages = [];
    this.friends = new Map(); // userId -> Set(friendId)
    this.friendRequests = []; // { id, fromUserId, toUserId, status: 'pending'|'accepted'|'rejected' }
    this.dmConversations = []; // { id, participants: [userId1, userId2], lastMessageAt }
    
    // User status
    this.userStatuses = new Map(); // userId -> 'online' | 'offline'
  }

  // --- USERS ---
  createUser(username, email, password) {
    const user = {
      id: uuidv4(),
      username,
      email,
      password, // In real app, hash this!
      avatar: `https://ui-avatars.com/api/?name=${username}&background=random`
    };
    this.users.push(user);
    return user;
  }

  findUserByEmail(email) {
    return this.users.find(u => u.email === email);
  }

  findUserById(id) {
    return this.users.find(u => u.id === id);
  }

  findUserByUsername(username) {
    return this.users.find(u => u.username === username);
  }

  getAllUsers() {
    return this.users.map(u => ({ id: u.id, username: u.username, avatar: u.avatar }));
  }

  updateUserStatus(userId, status) {
    this.userStatuses.set(userId, status);
  }

  getUserStatus(userId) {
    return this.userStatuses.get(userId) || 'offline';
  }

  // --- SERVERS ---
  getAllServers() {
    return this.servers;
  }

  getServerById(id) {
    return this.servers.find(s => s.id === id);
  }

  // GÜNCELLENDİ: Invite Code eklendi
  createServer(name, creatorId, icon = null) {
    const server = {
      id: uuidv4(),
      name,
      icon,
      creatorId,
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(), // Rastgele kod: X7Z9A2
      members: [creatorId], // Kurucuyu ekle
      channels: []
    };
    this.servers.push(server);
    
    // Varsayılan kanalları oluştur
    this.createChannel(server.id, 'general', 'text');
    this.createChannel(server.id, 'Lounge', 'voice');

    return server;
  }

  deleteServer(id) {
    const index = this.servers.findIndex(s => s.id === id);
    if (index !== -1) {
      this.servers.splice(index, 1);
      // Clean up channels
      this.channels = this.channels.filter(c => c.serverId !== id);
      return true;
    }
    return false;
  }

  // YENİ: Davet koduyla sunucu bul
  getServerByInviteCode(inviteCode) {
    return this.servers.find(s => s.inviteCode === inviteCode);
  }

  // YENİ: Sunucuya üye ekle
  addMemberToServer(serverId, userId) {
    const server = this.getServerById(serverId);
    if (server) {
      if (!server.members) server.members = [];
      if (!server.members.includes(userId)) {
        server.members.push(userId);
        return true;
      }
    }
    return false;
  }

  // --- CHANNELS ---
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
      type
    };
    this.channels.push(channel);
    
    // Add to server's channel list (optional ref)
    const server = this.getServerById(serverId);
    if (server) {
      server.channels.push(channel.id);
    }
    
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

  // --- FRIENDS ---
  sendFriendRequest(fromUserId, toUserId) {
    // Check existing
    const existing = this.friendRequests.find(r => 
      (r.fromUserId === fromUserId && r.toUserId === toUserId) ||
      (r.fromUserId === toUserId && r.toUserId === fromUserId)
    );
    if (existing) return null;

    // Check if already friends
    const friends = this.friends.get(fromUserId);
    if (friends && friends.has(toUserId)) return null;

    const request = {
      id: uuidv4(),
      fromUserId,
      toUserId,
      status: 'pending',
      createdAt: Date.now()
    };
    this.friendRequests.push(request);
    return request;
  }

  getPendingRequests(userId) {
    return this.friendRequests.filter(r => r.toUserId === userId && r.status === 'pending');
  }

  acceptFriendRequest(requestId) {
    const request = this.friendRequests.find(r => r.id === requestId);
    if (!request || request.status !== 'pending') return false;

    request.status = 'accepted';

    // Add to friends map (bi-directional)
    this._addFriend(request.fromUserId, request.toUserId);
    this._addFriend(request.toUserId, request.fromUserId);

    return true;
  }

  rejectFriendRequest(requestId) {
    const request = this.friendRequests.find(r => r.id === requestId);
    if (!request || request.status !== 'pending') return false;
    
    request.status = 'rejected';
    // Remove from array or keep as history (here keeping)
    return true;
  }

  getUserFriends(userId) {
    const friendIds = this.friends.get(userId);
    if (!friendIds) return [];
    
    return Array.from(friendIds).map(id => {
      const u = this.findUserById(id);
      return u ? { id: u.id, username: u.username, avatar: u.avatar, status: this.getUserStatus(id) } : null;
    }).filter(Boolean);
  }

  _addFriend(userId, friendId) {
    if (!this.friends.has(userId)) {
      this.friends.set(userId, new Set());
    }
    this.friends.get(userId).add(friendId);
  }

  // --- DM ---
  createDMConversation(userId1, userId2) {
    // Check existing
    let conv = this.dmConversations.find(c => 
      c.participants.includes(userId1) && c.participants.includes(userId2)
    );

    if (!conv) {
      conv = {
        id: uuidv4(),
        participants: [userId1, userId2],
        lastMessageAt: Date.now()
      };
      this.dmConversations.push(conv);
    }
    return conv;
  }

  getUserDMConversations(userId) {
    return this.dmConversations.filter(c => c.participants.includes(userId)).map(c => {
      // Find other participant
      const otherId = c.participants.find(p => p !== userId);
      const otherUser = this.findUserById(otherId);
      return {
        id: c.id,
        otherUser: otherUser ? { id: otherUser.id, username: otherUser.username, avatar: otherUser.avatar, status: this.getUserStatus(otherId) } : null,
        lastMessageAt: c.lastMessageAt
      };
    });
  }
}

module.exports = new Storage();