const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data.json');

class InMemoryStorage {
  constructor() {
    this.servers = [];
    this.channels = [];
    this.users = [];
    this.friendRequests = [];
    this.friendships = [];
    
    this.channelMessages = new Map(); 
    this.userStatuses = new Map();    
    this.serverMembers = new Map();   

    this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const rawData = fs.readFileSync(DATA_FILE, 'utf8');
        const data = JSON.parse(rawData);
        
        this.servers = data.servers || [];
        this.channels = data.channels || [];
        this.users = data.users || [];
        this.friendRequests = data.friendRequests || [];
        this.friendships = data.friendships || [];
        
        this.channelMessages = new Map(JSON.parse(data.channelMessages || '[]'));
        this.userStatuses = new Map(JSON.parse(data.userStatuses || '[]'));
        this.serverMembers = new Map(JSON.parse(data.serverMembers || '[]'));
        
        console.log('📦 Veriler data.json dosyasından yüklendi.');
      } else {
        console.log('✨ Kayıt dosyası yok. Varsayılanlar oluşturuluyor.');
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
        friendRequests: this.friendRequests,
        friendships: this.friendships,
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
    const defaultServer = {
      id: 'default-server',
      name: 'General Server',
      creatorId: 'system',
      inviteCode: 'PUBLIC',
      createdAt: Date.now(),
      isDM: false
    };
    this.servers.push(defaultServer);

    const defaultChannels = [
      { id: uuidv4(), name: 'general', serverId: defaultServer.id, type: 'text', createdAt: Date.now() },
      { id: uuidv4(), name: 'voice-chat', serverId: defaultServer.id, type: 'voice', createdAt: Date.now() },
    ];

    this.channels.push(...defaultChannels);
    this.serverMembers.set(defaultServer.id, []); 
    this.saveData();
  }

  // --- SERVERS ---
  getAllServers() { return [...this.servers]; }
  getServerById(id) { return this.servers.find(s => s.id === id); }
  getServerByInviteCode(code) { return this.servers.find(s => s.inviteCode === code); }

  createServer(name, creatorId) {
    const server = {
      id: uuidv4(),
      name,
      creatorId,
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      createdAt: Date.now(),
      isDM: false
    };
    this.servers.push(server);
    this.createChannel(server.id, 'general', 'text');
    this.addServerMember(server.id, creatorId);
    this.saveData();
    return server;
  }

  updateServer(id, updates) {
    const server = this.getServerById(id);
    if (server) {
      if (updates.name) server.name = updates.name;
      if (updates.icon !== undefined) server.icon = updates.icon;
      this.saveData();
      return server;
    }
    return null;
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

  addServerMember(serverId, userId) {
    if (!this.serverMembers.has(serverId)) this.serverMembers.set(serverId, []);
    const members = this.serverMembers.get(serverId);
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

  // --- CHANNELS ---
  getChannelsByServerId(serverId) { return this.channels.filter(c => c.serverId === serverId); }
  getChannelById(id) { return this.channels.find(c => c.id === id); }

  createChannel(serverId, name, type = 'text') {
    const channel = { id: uuidv4(), serverId, name, type, createdAt: Date.now() };
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

  addChannelMessage(channelId, message) {
    if (!this.channelMessages.has(channelId)) this.channelMessages.set(channelId, []);
    const msgs = this.channelMessages.get(channelId);
    msgs.push(message);
    if (msgs.length > 500) this.channelMessages.set(channelId, msgs.slice(-500));
    this.saveData();
  }

  getChannelMessages(channelId) { return this.channelMessages.get(channelId) || []; }

  updateChannelMessage(channelId, messageId, newContent) {
    const msgs = this.getChannelMessages(channelId);
    const msg = msgs.find(m => m.id === messageId);
    if (msg) {
      msg.content = newContent;
      msg.isEdited = true;
      this.saveData();
      return msg;
    }
    return null;
  }

  deleteChannelMessage(channelId, messageId) {
    const msgs = this.getChannelMessages(channelId);
    const index = msgs.findIndex(m => m.id === messageId);
    if (index !== -1) {
      msgs.splice(index, 1);
      this.saveData();
      return true;
    }
    return false;
  }

  // --- USERS ---
  createUser(username) {
    const user = { id: uuidv4(), username, createdAt: Date.now() };
    this.users.push(user);
    this.saveData();
    return user;
  }

  createUserWithAuth({ username, email, password }) {
    if (this.getUserByUsername(username)) throw new Error('Username taken');
    if (this.getUserByEmail(email)) throw new Error('Email taken');
    const user = { 
      id: uuidv4(), 
      username, 
      email, 
      password, 
      avatar: `https://ui-avatars.com/api/?name=${username}&background=random`, 
      status: 'online', 
      createdAt: Date.now() 
    };
    this.users.push(user);
    this.userStatuses.set(user.id, 'online');
    this.addServerMember('default-server', user.id);
    this.saveData();
    return user;
  }

  getUserById(id) { return this.users.find(u => u.id === id); }
  getUserByUsername(username) { return this.users.find(u => u.username?.toLowerCase() === username?.toLowerCase()); }
  getUserByEmail(email) { return this.users.find(u => u.email === email); }
  getAllUsers() { return [...this.users]; }

  updateUserAvatar(userId, url) {
    const u = this.getUserById(userId);
    if (u) { u.avatar = url; this.saveData(); return u; }
    return null;
  }

  updateUserStatus(id, status) { this.userStatuses.set(id, status); }
  getUserStatus(id) { return this.userStatuses.get(id) || 'offline'; }

  // --- DM AS A SERVER (YENİ ALTYAPI) ---
  getOrCreateDMConversation(u1, u2) {
    const [id1, id2] = [u1, u2].sort();
    
    // Zaten 2 kişi arasında DM sunucusu var mı?
    let dmServer = this.servers.find(s => s.isDM && s.dmUserIds && s.dmUserIds.includes(id1) && s.dmUserIds.includes(id2));
    
    if (!dmServer) {
      const serverId = uuidv4();
      dmServer = { 
        id: serverId, 
        name: `DM-${id1}-${id2}`, 
        isDM: true, 
        dmUserIds: [id1, id2], 
        createdAt: Date.now() 
      };
      this.servers.push(dmServer);
      this.serverMembers.set(serverId, [id1, id2]);
      
      const channel = { id: uuidv4(), serverId: serverId, name: 'dm-chat', type: 'text', createdAt: Date.now() };
      this.channels.push(channel);
      this.saveData();
    }

    const channel = this.channels.find(c => c.serverId === dmServer.id);
    return { id: dmServer.id, channelId: channel.id, user1Id: id1, user2Id: id2 };
  }

  getUserDMConversations(uid) {
    const dmServers = this.servers.filter(s => s.isDM && s.dmUserIds && s.dmUserIds.includes(uid));
    
    return dmServers.map(server => {
      const otherUserId = server.dmUserIds.find(id => id !== uid);
      const channel = this.channels.find(c => c.serverId === server.id);
      return { 
        id: server.id, 
        channelId: channel?.id, 
        user1Id: uid, 
        user2Id: otherUserId, 
        otherUser: this.getUserById(otherUserId) 
      };
    }).filter(c => c.otherUser);
  }

  // --- FRIENDS ---
  createFriendRequest(from, to) {
    if (this.friendships.some(f => (f.user1Id===from && f.user2Id===to) || (f.user1Id===to && f.user2Id===from))) return null;
    if (this.friendRequests.find(r => (r.fromUserId===from && r.toUserId===to) || (r.fromUserId===to && r.toUserId===from))) return null;
    const req = { id: uuidv4(), fromUserId: from, toUserId: to, status: 'pending', createdAt: Date.now() };
    this.friendRequests.push(req); 
    this.saveData(); 
    return req;
  }

  getPendingFriendRequests(uid) {
    return this.friendRequests.filter(r => r.toUserId === uid && r.status === 'pending')
      .map(r => ({ ...r, fromUser: this.getUserById(r.fromUserId) }));
  }

  acceptFriendRequest(rid) {
    const req = this.friendRequests.find(r => r.id === rid);
    if (!req) return false;
    req.status = 'accepted';
    const [id1, id2] = [req.fromUserId, req.toUserId].sort();
    this.friendships.push({ id: uuidv4(), user1Id: id1, user2Id: id2, createdAt: Date.now() });
    this.saveData(); 
    return true;
  }

  rejectFriendRequest(rid) {
    const idx = this.friendRequests.findIndex(r => r.id === rid);
    if (idx !== -1) { 
      this.friendRequests.splice(idx, 1); 
      this.saveData(); 
      return true; 
    }
    return false;
  }

  getUserFriends(uid) {
    return this.friendships.filter(f => f.user1Id === uid || f.user2Id === uid).map(f => {
      const fid = f.user1Id === uid ? f.user2Id : f.user1Id;
      const u = this.getUserById(fid);
      return u ? { ...u, status: this.getUserStatus(fid) } : null;
    }).filter(Boolean);
  }

  removeFriend(u1, u2) {
    const [id1, id2] = [u1, u2].sort();
    const idx = this.friendships.findIndex(f => f.user1Id === id1 && f.user2Id === id2);
    if (idx !== -1) { 
      this.friendships.splice(idx, 1); 
      this.saveData(); 
    }
  }

  findUserById(id) { return this.getUserById(id); }
  findUserByUsername(u) { return this.getUserByUsername(u); }
  findUserByEmail(e) { return this.getUserByEmail(e); }
  getPendingRequests(uid) { return this.getPendingFriendRequests(uid); }
  sendFriendRequest(f, t) { return this.createFriendRequest(f, t); }
  addMemberToServer(sid, uid) { return this.addServerMember(sid, uid); }
}

module.exports = new InMemoryStorage();