const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data.json');

class Storage {
  constructor() {
    this.users = [];
    this.servers = [];
    this.channels = [];
    this.messages = new Map();
    this.friends = new Map();
    this.friendRequests = [];
    this.dmConversations = [];
    this.userStatuses = new Map();

    // Başlangıçta verileri yükle
    this.loadData();
  }

  // --- DOSYA İŞLEMLERİ (Kalıcılık İçin) ---
  loadData() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        
        this.users = data.users || [];
        this.servers = data.servers || [];
        this.channels = data.channels || [];
        this.friendRequests = data.friendRequests || [];
        this.dmConversations = data.dmConversations || [];
        
        // Map nesnelerini geri dönüştür
        this.messages = new Map(JSON.parse(data.messages || '[]'));
        this.friends = new Map(JSON.parse(data.friends || '[]'));
        
        console.log('📦 Data loaded from JSON file.');
      } else {
        console.log('✨ No data file found. Initializing defaults.');
        this.initDefaults();
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      this.initDefaults();
    }
  }

  saveData() {
    try {
      const data = {
        users: this.users,
        servers: this.servers,
        channels: this.channels,
        friendRequests: this.friendRequests,
        dmConversations: this.dmConversations,
        // Map'leri array'e çevirerek kaydet
        messages: JSON.stringify(Array.from(this.messages.entries())),
        friends: JSON.stringify(Array.from(this.friends.entries()))
      };
      
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  }

  initDefaults() {
    // Varsayılan Sunucu
    this.servers = [{
      id: 'default-server',
      name: 'General Server',
      icon: null,
      creatorId: 'system',
      inviteCode: 'PUBLIC',
      members: [],
      channels: ['general', 'voice-general']
    }];

    // Varsayılan Kanallar
    this.channels = [
      { id: 'general', serverId: 'default-server', name: 'general', type: 'text' },
      { id: 'voice-general', serverId: 'default-server', name: 'Lounge', type: 'voice' }
    ];
    
    this.saveData();
  }

  // --- USERS ---
  createUser(username, email, password) {
    const user = {
      id: uuidv4(),
      username,
      email,
      password, // Gerçek uygulamada şifre hashlenmeli!
      avatar: `https://ui-avatars.com/api/?name=${username}&background=random`
    };
    this.users.push(user);

    // Kullanıcıyı varsayılan sunucuya otomatik ekle
    const defaultServer = this.getServerById('default-server');
    if (defaultServer) {
        if (!defaultServer.members) defaultServer.members = [];
        if (!defaultServer.members.includes(user.id)) {
            defaultServer.members.push(user.id);
        }
    }

    this.saveData(); // KAYDET
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
    // Status geçicidir, kaydetmeye gerek yok
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

  createServer(name, creatorId, icon = null) {
    const server = {
      id: uuidv4(),
      name,
      icon,
      creatorId,
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      members: [creatorId],
      channels: []
    };
    this.servers.push(server);
    
    // Varsayılan kanalları oluştur
    this.createChannel(server.id, 'general', 'text', false); // false = kaydetme (createChannel içinde kaydedecek)
    this.createChannel(server.id, 'Lounge', 'voice', false);

    this.saveData(); // KAYDET
    return server;
  }

  deleteServer(id) {
    const index = this.servers.findIndex(s => s.id === id);
    if (index !== -1) {
      this.servers.splice(index, 1);
      this.channels = this.channels.filter(c => c.serverId !== id);
      this.saveData(); // KAYDET
      return true;
    }
    return false;
  }

  getServerByInviteCode(inviteCode) {
    return this.servers.find(s => s.inviteCode === inviteCode);
  }

  addMemberToServer(serverId, userId) {
    const server = this.getServerById(serverId);
    if (server) {
      if (!server.members) server.members = [];
      if (!server.members.includes(userId)) {
        server.members.push(userId);
        this.saveData(); // KAYDET
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

  createChannel(serverId, name, type = 'text', shouldSave = true) {
    const channel = {
      id: uuidv4(),
      serverId,
      name,
      type
    };
    this.channels.push(channel);
    
    const server = this.getServerById(serverId);
    if (server) {
        if (!server.channels) server.channels = [];
        server.channels.push(channel.id);
    }
    
    if (shouldSave) this.saveData(); // KAYDET
    return channel;
  }

  deleteChannel(id) {
    const index = this.channels.findIndex(c => c.id === id);
    if (index !== -1) {
      this.channels.splice(index, 1);
      this.saveData(); // KAYDET
      return true;
    }
    return false;
  }

  // --- FRIENDS ---
  sendFriendRequest(fromUserId, toUserId) {
    const existing = this.friendRequests.find(r => 
      (r.fromUserId === fromUserId && r.toUserId === toUserId) ||
      (r.fromUserId === toUserId && r.toUserId === fromUserId)
    );
    if (existing) return null;

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
    this.saveData(); // KAYDET
    return request;
  }

  getPendingRequests(userId) {
    return this.friendRequests.filter(r => r.toUserId === userId && r.status === 'pending');
  }

  acceptFriendRequest(requestId) {
    const request = this.friendRequests.find(r => r.id === requestId);
    if (!request || request.status !== 'pending') return false;

    request.status = 'accepted';
    this._addFriend(request.fromUserId, request.toUserId);
    this._addFriend(request.toUserId, request.fromUserId);

    this.saveData(); // KAYDET
    return true;
  }

  rejectFriendRequest(requestId) {
    const request = this.friendRequests.find(r => r.id === requestId);
    if (!request || request.status !== 'pending') return false;
    
    request.status = 'rejected';
    this.saveData(); // KAYDET
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
      this.saveData(); // KAYDET
    }
    return conv;
  }

  getUserDMConversations(userId) {
    return this.dmConversations.filter(c => c.participants.includes(userId)).map(c => {
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