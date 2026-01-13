const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Verilerin kaydedileceği dosya
const DATA_FILE = path.join(__dirname, '../../data.json');

class InMemoryStorage {
  constructor() {
    // --- Array Yapıları (Listeler) ---
    this.servers = [];
    this.channels = [];
    this.users = [];
    this.dmConversations = [];
    this.friendRequests = [];
    this.friendships = [];
    
    // --- Map Yapıları (Anahtar-Değer) ---
    // Bunların özel olarak kaydedilip yüklenmesi gerekir
    this.dmMessages = new Map();      // conversationId -> [mesajlar]
    this.channelMessages = new Map(); // channelId -> [mesajlar] (YENİ)
    this.userStatuses = new Map();    // userId -> durumu
    this.serverMembers = new Map();   // serverId -> [üye id'leri]

    // Başlangıçta verileri yükle
    this.loadData();
  }

  // ==================== DOSYA SİSTEMİ (KALICILIK) ====================
  loadData() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const rawData = fs.readFileSync(DATA_FILE, 'utf8');
        const data = JSON.parse(rawData);
        
        // Listeleri yükle
        this.servers = data.servers || [];
        this.channels = data.channels || [];
        this.users = data.users || [];
        this.dmConversations = data.dmConversations || [];
        this.friendRequests = data.friendRequests || [];
        this.friendships = data.friendships || [];
        
        // Map'leri geri yükle (JSON'dan Map'e çevir)
        this.dmMessages = new Map(JSON.parse(data.dmMessages || '[]'));
        this.channelMessages = new Map(JSON.parse(data.channelMessages || '[]'));
        this.userStatuses = new Map(JSON.parse(data.userStatuses || '[]'));
        this.serverMembers = new Map(JSON.parse(data.serverMembers || '[]'));
        
        console.log('📦 Veriler data.json dosyasından başarıyla yüklendi.');
      } else {
        console.log('✨ Kayıt dosyası yok. Varsayılan veriler oluşturuluyor.');
        this.seedData();
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      this.seedData();
    }
  }

  saveData() {
    try {
      const data = {
        servers: this.servers,
        channels: this.channels,
        users: this.users,
        dmConversations: this.dmConversations,
        friendRequests: this.friendRequests,
        friendships: this.friendships,
        // Map'leri array formatına çevirip kaydet
        dmMessages: JSON.stringify(Array.from(this.dmMessages.entries())),
        channelMessages: JSON.stringify(Array.from(this.channelMessages.entries())),
        userStatuses: JSON.stringify(Array.from(this.userStatuses.entries())),
        serverMembers: JSON.stringify(Array.from(this.serverMembers.entries())),
      };
      
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Veri kaydetme hatası:', error);
    }
  }

  seedData() {
    // Varsayılan Sunucu
    const defaultServer = {
      id: 'default-server',
      name: 'General Server',
      creatorId: 'system',
      inviteCode: 'PUBLIC',
      createdAt: Date.now(),
    };
    this.servers.push(defaultServer);

    // Varsayılan Kanallar
    const defaultChannels = [
      { id: uuidv4(), name: 'general', serverId: defaultServer.id, type: 'text', createdAt: Date.now() },
      { id: uuidv4(), name: 'voice-chat', serverId: defaultServer.id, type: 'voice', createdAt: Date.now() },
    ];

    this.channels.push(...defaultChannels);
    this.serverMembers.set(defaultServer.id, []); 
    
    this.saveData();
  }

  // ==================== SERVERS & MEMBERSHIP ====================
  getAllServers() {
    return [...this.servers];
  }

  getServerById(id) {
    return this.servers.find(s => s.id === id);
  }
  
  getServerByInviteCode(inviteCode) {
    return this.servers.find(s => s.inviteCode === inviteCode);
  }

  createServer(name, creatorId) {
    const server = {
      id: uuidv4(),
      name,
      creatorId,
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      createdAt: Date.now(),
    };
    this.servers.push(server);
    
    this.createChannel(server.id, 'general', 'text');
    this.addServerMember(server.id, creatorId); // Kurucuyu ekle ve kaydet
    
    this.saveData();
    return server;
  }

  deleteServer(id) {
    const index = this.servers.findIndex(s => s.id === id);
    if (index !== -1) {
      this.servers.splice(index, 1);
      this.channels = this.channels.filter(c => c.serverId !== id);
      this.serverMembers.delete(id);
      this.saveData();
      return true;
    }
    return false;
  }

  // Üye Ekleme (Bu kısım sunucuların listede kalmasını sağlar)
  addServerMember(serverId, userId) {
    if (!this.serverMembers.has(serverId)) {
      this.serverMembers.set(serverId, []);
    }
    const members = this.serverMembers.get(serverId);
    
    // Eğer üye zaten yoksa ekle ve KAYDET
    if (!members.includes(userId)) {
      members.push(userId);
      this.saveData();
    }
  }

  removeServerMember(serverId, userId) {
    if (this.serverMembers.has(serverId)) {
      const members = this.serverMembers.get(serverId);
      const index = members.indexOf(userId);
      if (index !== -1) {
        members.splice(index, 1);
        this.saveData();
      }
    }
  }

  getServerMembers(serverId) {
    const memberIds = this.serverMembers.get(serverId) || [];
    return memberIds.map(id => this.getUserById(id)).filter(Boolean);
  }

  // ==================== CHANNELS & MESSAGES ====================
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
    this.saveData();
    return channel;
  }

  deleteChannel(id) {
    const index = this.channels.findIndex(c => c.id === id);
    if (index !== -1) {
      this.channels.splice(index, 1);
      this.saveData();
      return true;
    }
    return false;
  }

  // Kanal Mesajlarını Kaydet
  addChannelMessage(channelId, message) {
    if (!this.channelMessages.has(channelId)) {
      this.channelMessages.set(channelId, []);
    }
    this.channelMessages.get(channelId).push(message);
    
    // Son 500 mesajı tut
    const msgs = this.channelMessages.get(channelId);
    if (msgs.length > 500) {
       this.channelMessages.set(channelId, msgs.slice(-500));
    }
    
    this.saveData(); // Mesajı diske yaz
  }

  getChannelMessages(channelId) {
    return this.channelMessages.get(channelId) || [];
  }

  updateChannelMessage(channelId, messageId, newContent) {
    const messages = this.getChannelMessages(channelId);
    const msg = messages.find(m => m.id === messageId);
    if (msg) {
        msg.content = newContent;
        msg.isEdited = true;
        this.saveData();
        return msg;
    }
    return null;
  }

  deleteChannelMessage(channelId, messageId) {
    const messages = this.getChannelMessages(channelId);
    const index = messages.findIndex(m => m.id === messageId);
    if (index !== -1) {
        messages.splice(index, 1);
        this.saveData();
        return true;
    }
    return false;
  }

  // ==================== USERS & AUTH ====================
  createUser(username) {
    const user = {
      id: uuidv4(),
      username,
      createdAt: Date.now(),
    };
    this.users.push(user);
    this.saveData();
    return user;
  }

  createUserWithAuth({ username, email, password }) {
    if (this.getUserByUsername(username)) {
      throw new Error('Username already taken');
    }
    if (this.getUserByEmail(email)) {
      throw new Error('Email already registered');
    }

    const user = {
      id: uuidv4(),
      username,
      email,
      password,
      avatar: `https://ui-avatars.com/api/?name=${username}&background=random`,
      status: 'online',
      createdAt: Date.now(),
    };
    this.users.push(user);
    this.userStatuses.set(user.id, 'online');

    // Otomatik olarak varsayılan sunucuya ekle
    this.addServerMember('default-server', user.id);

    this.saveData();
    return user;
  }

  getUserByUsername(username) {
    if (!username) return null;
    return this.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  getUserByEmail(email) {
    if (!email) return null;
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
      this.saveData();
      return user;
    }
    return null;
  }

  updateUserStatus(userId, status) {
    this.userStatuses.set(userId, status);
    // Status anlık olduğu için kaydetmeye gerek yok
  }

  getUserStatus(userId) {
    return this.userStatuses.get(userId) || 'offline';
  }

  // ==================== DM CONVERSATIONS ====================
  getOrCreateDMConversation(userId1, userId2) {
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
      this.saveData();
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
    this.saveData();
  }

  // ==================== FRIENDS ====================
  createFriendRequest(fromUserId, toUserId) {
    const areFriends = this.friendships.some(
      f => (f.user1Id === fromUserId && f.user2Id === toUserId) ||
           (f.user1Id === toUserId && f.user2Id === fromUserId)
    );
    if (areFriends) return null;

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
    this.saveData();
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

    const [id1, id2] = [request.fromUserId, request.toUserId].sort();
    this.friendships.push({
      id: uuidv4(),
      user1Id: id1,
      user2Id: id2,
      createdAt: Date.now(),
    });

    this.saveData();
    return true;
  }

  rejectFriendRequest(requestId) {
    const index = this.friendRequests.findIndex(r => r.id === requestId);
    if (index === -1) return false;
    
    this.friendRequests.splice(index, 1);
    this.saveData();
    return true;
  }

  getUserFriends(userId) {
    const friendships = this.friendships.filter(
      f => f.user1Id === userId || f.user2Id === userId
    );

    return friendships.map(f => {
      const friendId = f.user1Id === userId ? f.user2Id : f.user1Id;
      const friend = this.getUserById(friendId);
      if (!friend) return null;
      return {
        ...friend,
        status: this.getUserStatus(friendId),
      };
    }).filter(Boolean);
  }

  removeFriend(userId, friendId) {
    const [id1, id2] = [userId, friendId].sort();
    const index = this.friendships.findIndex(
      f => f.user1Id === id1 && f.user2Id === id2
    );
    
    if (index !== -1) {
      this.friendships.splice(index, 1);
      this.saveData();
    }
  }

  // ==================== ALIASES (HATA ÖNLEYİCİ) ====================
  findUserById(id) { return this.getUserById(id); }
  findUserByUsername(username) { return this.getUserByUsername(username); }
  findUserByEmail(email) { return this.getUserByEmail(email); }
  
  getPendingRequests(userId) { return this.getPendingFriendRequests(userId); }
  sendFriendRequest(fromId, toId) { return this.createFriendRequest(fromId, toId); }
  
  addMemberToServer(serverId, userId) { return this.addServerMember(serverId, userId); }
  createDMConversation(u1, u2) { return this.getOrCreateDMConversation(u1, u2); }
}

module.exports = new InMemoryStorage();