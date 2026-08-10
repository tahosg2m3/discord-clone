const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { SQLiteStateStore } = require('./sqliteStateStore');

// Electron paketinde uygulama kaynak klasörüne yazılamaz. APP_DATA_DIR verildiğinde
// kalıcı veriyi kullanıcının uygulama verisi klasöründe tutarız.
const DATA_DIRECTORY = process.env.APP_DATA_DIR
  ? path.resolve(process.env.APP_DATA_DIR)
  : path.join(__dirname, '../..');
const DATA_FILE = path.join(DATA_DIRECTORY, 'data.json');
const DATABASE_FILE = path.join(
  DATA_DIRECTORY,
  process.env.APP_DATA_DIR ? 'discord-clone.sqlite' : 'data.sqlite',
);

const PERMISSIONS = Object.freeze([
  'ADMINISTRATOR',
  'VIEW_CHANNEL',
  'SEND_MESSAGES',
  'MANAGE_MESSAGES',
  'MANAGE_SERVER',
  'MANAGE_ROLES',
  'MANAGE_CHANNELS',
  'KICK_MEMBERS',
  'MODERATE_MEMBERS',
  'CONNECT',
  'SPEAK',
  'STREAM',
  'MUTE_MEMBERS',
  'DEAFEN_MEMBERS',
  'MOVE_MEMBERS',
]);

const DEFAULT_MEMBER_PERMISSIONS = Object.freeze([
  'VIEW_CHANNEL',
  'SEND_MESSAGES',
  'CONNECT',
  'SPEAK',
  'STREAM',
]);

const ALL_PERMISSIONS = Object.freeze([...PERMISSIONS]);

function parsePersistedMap(value) {
  if (!value) return new Map();

  try {
    const entries = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(entries) ? new Map(entries) : new Map();
  } catch (error) {
    return new Map();
  }
}

function sanitizePermissions(permissions) {
  const values = Array.isArray(permissions) ? permissions : [];
  return [...new Set(values.filter(permission => PERMISSIONS.includes(permission)))];
}

function getDefaultRoleId(serverId) {
  return `@everyone:${serverId}`;
}

function createDefaultRole(serverId) {
  return {
    id: getDefaultRoleId(serverId),
    serverId,
    name: '@everyone',
    color: null,
    permissions: [...DEFAULT_MEMBER_PERMISSIONS],
    position: 0,
    isDefault: true,
    managed: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function copyRole(role) {
  return { ...role, permissions: [...(role.permissions || [])] };
}

function publicUser(user) {
  if (!user) return null;
  const { password, email, tokenVersion, ...safeUser } = user;
  return safeUser;
}

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
    this.serverRoles = new Map();
    this.serverMemberRoles = new Map();
    this.serverModeration = new Map();
    this.saveTimeout = null;
    this.stateStore = new SQLiteStateStore({
      databasePath: DATABASE_FILE,
      legacyDataFile: DATA_FILE,
    });
    this.loadData();
  }

  loadData() {
    try {
      const data = this.stateStore.load();
      if (!data) {
        this.seedData();
        return;
      }

      this.servers = Array.isArray(data.servers) ? data.servers : [];
      this.channels = Array.isArray(data.channels) ? data.channels : [];
      this.users = Array.isArray(data.users) ? data.users : [];
      this.friendRequests = Array.isArray(data.friendRequests) ? data.friendRequests : [];
      this.friendships = Array.isArray(data.friendships) ? data.friendships : [];
      this.channelMessages = parsePersistedMap(data.channelMessages);
      // Çevrimiçi durumu kalıcı değildir: uygulama yeniden açıldığında herkes offline başlar.
      this.userStatuses = new Map(this.users.map(user => [user.id, 'offline']));
      this.serverMembers = parsePersistedMap(data.serverMembers);
      this.serverRoles = parsePersistedMap(data.serverRoles);
      this.serverMemberRoles = parsePersistedMap(data.serverMemberRoles);
      this.serverModeration = parsePersistedMap(data.serverModeration);

      if (this.migrateRoleData()) this.saveData();
    } catch (error) {
      console.error('Veri dosyası okunamadı; yeni veri yapısı oluşturuluyor:', error.message);
      this.seedData();
    }
  }

  saveData() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);

    this.saveTimeout = setTimeout(() => {
      try {
        this.stateStore.save(this.createPersistedSnapshot());
      } catch (error) {
        console.error('Veriler kaydedilemedi:', error.message);
      } finally {
        this.saveTimeout = null;
      }
    }, 500);
  }

  // Uygulama kapanırken son 500 ms içindeki değişikliklerin de kalıcı olmasını
  // sağlar. Bu yöntem özellikle Electron'un backend sürecine SIGTERM yolladığı
  // durumda çağrılır.
  flush() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    try {
      return this.stateStore.save(this.createPersistedSnapshot());
    } catch (error) {
      console.error('Veriler kapatılırken kaydedilemedi:', error.message);
      return false;
    }
  }

  close() {
    this.flush();
    this.stateStore.close();
  }

  createPersistedSnapshot() {
    return {
      servers: this.servers,
      channels: this.channels,
      users: this.users,
      friendRequests: this.friendRequests,
      friendships: this.friendships,
      channelMessages: JSON.stringify(Array.from(this.channelMessages.entries())),
      userStatuses: JSON.stringify(Array.from(this.userStatuses.entries())),
      serverMembers: JSON.stringify(Array.from(this.serverMembers.entries())),
      serverRoles: JSON.stringify(Array.from(this.serverRoles.entries())),
      serverMemberRoles: JSON.stringify(Array.from(this.serverMemberRoles.entries())),
      serverModeration: JSON.stringify(Array.from(this.serverModeration.entries())),
    };
  }

  seedData() {
    const defaultServer = {
      id: 'default-server',
      name: 'General Server',
      creatorId: 'system',
      inviteCode: 'PUBLIC',
      createdAt: Date.now(),
      isDM: false,
    };

    this.servers = [defaultServer];
    this.channels = [
      { id: uuidv4(), name: 'general', serverId: defaultServer.id, type: 'text', createdAt: Date.now() },
      { id: uuidv4(), name: 'voice-chat', serverId: defaultServer.id, type: 'voice', createdAt: Date.now() },
    ];
    this.serverMembers.set(defaultServer.id, []);
    this.ensureServerRoleData(defaultServer.id);
    this.saveData();
  }

  migrateRoleData() {
    let changed = false;

    this.servers.filter(server => !server.isDM).forEach(server => {
      if (!this.serverMembers.has(server.id)) {
        this.serverMembers.set(server.id, []);
        changed = true;
      }

      // Eski demo sunucusunda sahip "system" idi ve gerçek bir hesap olmadığı için
      // ayarlar/roller kilitli kalıyordu. İlk geçerli üyeyi sahip yaparak eski veriyi taşırız.
      if (server.id === 'default-server' && server.creatorId === 'system') {
        const firstRealMember = (this.serverMembers.get(server.id) || []).find(userId => this.getUserById(userId));
        if (firstRealMember) {
          server.creatorId = firstRealMember;
          changed = true;
        }
      }

      changed = this.ensureServerRoleData(server.id) || changed;
    });

    return changed;
  }

  ensureServerRoleData(serverId) {
    const server = this.getServerById(serverId);
    if (!server || server.isDM) return false;

    let changed = false;
    const defaultRoleId = getDefaultRoleId(serverId);
    const rawRoles = Array.isArray(this.serverRoles.get(serverId)) ? this.serverRoles.get(serverId) : [];
    const rolesById = new Map();

    rawRoles.forEach((role, index) => {
      if (!role || typeof role.id !== 'string' || rolesById.has(role.id)) {
        changed = true;
        return;
      }

      const isDefault = role.id === defaultRoleId || role.isDefault === true;
      const normalized = {
        id: isDefault ? defaultRoleId : role.id,
        serverId,
        name: isDefault ? '@everyone' : String(role.name || 'Yeni rol').trim().slice(0, 100) || 'Yeni rol',
        color: typeof role.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(role.color) ? role.color : null,
        permissions: isDefault
          ? sanitizePermissions(role.permissions?.length ? role.permissions : DEFAULT_MEMBER_PERMISSIONS)
          : sanitizePermissions(role.permissions),
        position: Number.isFinite(Number(role.position)) ? Number(role.position) : index + 1,
        isDefault,
        managed: isDefault,
        createdAt: role.createdAt || Date.now(),
        updatedAt: role.updatedAt || role.createdAt || Date.now(),
      };

      if (isDefault && rolesById.has(defaultRoleId)) {
        changed = true;
        return;
      }

      rolesById.set(normalized.id, normalized);
    });

    if (!rolesById.has(defaultRoleId)) {
      rolesById.set(defaultRoleId, createDefaultRole(serverId));
      changed = true;
    }

    const orderedRoles = [...rolesById.values()]
      .filter(role => !role.isDefault)
      .sort((first, second) => first.position - second.position || first.createdAt - second.createdAt);
    const defaultRole = rolesById.get(defaultRoleId);
    defaultRole.position = 0;
    defaultRole.isDefault = true;
    defaultRole.managed = true;

    const normalizedRoles = [defaultRole, ...orderedRoles.map((role, index) => ({
      ...role,
      position: index + 1,
      isDefault: false,
      managed: false,
    }))];

    if (JSON.stringify(rawRoles) !== JSON.stringify(normalizedRoles)) changed = true;
    this.serverRoles.set(serverId, normalizedRoles);

    const memberIds = new Set(this.serverMembers.get(serverId) || []);
    const rawAssignments = this.serverMemberRoles.get(serverId);
    const assignments = rawAssignments && typeof rawAssignments === 'object' && !Array.isArray(rawAssignments)
      ? rawAssignments
      : {};
    const cleanedAssignments = {};

    Object.entries(assignments).forEach(([userId, roleIds]) => {
      if (!memberIds.has(userId)) {
        changed = true;
        return;
      }

      const cleanedRoleIds = [...new Set(Array.isArray(roleIds) ? roleIds : [])]
        .filter(roleId => roleId !== defaultRoleId && normalizedRoles.some(role => role.id === roleId && !role.isDefault));

      if (cleanedRoleIds.length) cleanedAssignments[userId] = cleanedRoleIds;
      if (JSON.stringify(roleIds || []) !== JSON.stringify(cleanedRoleIds)) changed = true;
    });

    if (JSON.stringify(assignments) !== JSON.stringify(cleanedAssignments)) changed = true;
    this.serverMemberRoles.set(serverId, cleanedAssignments);

    const rawModeration = this.serverModeration.get(serverId);
    const moderation = rawModeration && typeof rawModeration === 'object' && !Array.isArray(rawModeration)
      ? rawModeration
      : {};
    const cleanedModeration = {};

    Object.entries(moderation).forEach(([userId, state]) => {
      if (!memberIds.has(userId)) {
        changed = true;
        return;
      }

      const normalizedState = {
        serverMuted: Boolean(state?.serverMuted),
        serverDeafened: Boolean(state?.serverDeafened),
        timeoutUntil: Number(state?.timeoutUntil) > Date.now() ? Number(state.timeoutUntil) : null,
        updatedAt: state?.updatedAt || Date.now(),
        updatedBy: state?.updatedBy || null,
      };

      if (normalizedState.serverMuted || normalizedState.serverDeafened || normalizedState.timeoutUntil) {
        cleanedModeration[userId] = normalizedState;
      }
    });

    if (JSON.stringify(moderation) !== JSON.stringify(cleanedModeration)) changed = true;
    this.serverModeration.set(serverId, cleanedModeration);

    return changed;
  }

  getAllPermissions() { return [...ALL_PERMISSIONS]; }
  getDefaultRoleId(serverId) { return getDefaultRoleId(serverId); }

  getAllServers() { return [...this.servers]; }
  getServerById(id) { return this.servers.find(server => server.id === id); }
  getServerByInviteCode(code) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    return this.servers.find(server => server.inviteCode?.toUpperCase() === normalizedCode);
  }

  createServer(name, creatorId) {
    const server = {
      id: uuidv4(),
      name: String(name || '').trim(),
      creatorId,
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      createdAt: Date.now(),
      isDM: false,
    };

    this.servers.push(server);
    this.serverMembers.set(server.id, []);
    this.ensureServerRoleData(server.id);
    this.addServerMember(server.id, creatorId);
    this.createChannel(server.id, 'general', 'text');
    this.saveData();
    return server;
  }

  updateServer(id, updates) {
    const server = this.getServerById(id);
    if (!server) return null;

    if (updates.name) server.name = String(updates.name).trim();
    if (updates.icon !== undefined) server.icon = updates.icon;
    if (updates.inviteCode) server.inviteCode = String(updates.inviteCode).trim().toUpperCase();
    this.saveData();
    return server;
  }

  transferServerOwnership(serverId, newOwnerId) {
    const server = this.getServerById(serverId);
    if (!server || !this.isServerMember(serverId, newOwnerId)) return null;
    server.creatorId = newOwnerId;
    this.saveData();
    return server;
  }

  deleteServer(id) {
    const index = this.servers.findIndex(server => server.id === id);
    if (index === -1) return false;

    const channelIds = this.channels.filter(channel => channel.serverId === id).map(channel => channel.id);
    this.servers.splice(index, 1);
    this.channels = this.channels.filter(channel => channel.serverId !== id);
    channelIds.forEach(channelId => this.channelMessages.delete(channelId));
    this.serverMembers.delete(id);
    this.serverRoles.delete(id);
    this.serverMemberRoles.delete(id);
    this.serverModeration.delete(id);
    this.saveData();
    return true;
  }

  isServerMember(serverId, userId) {
    return Boolean(userId) && (this.serverMembers.get(serverId) || []).includes(userId);
  }

  addServerMember(serverId, userId) {
    const server = this.getServerById(serverId);
    if (!server || !this.getUserById(userId)) return false;
    if (!this.serverMembers.has(serverId)) this.serverMembers.set(serverId, []);

    const members = this.serverMembers.get(serverId);
    if (members.includes(userId)) return false;

    members.push(userId);
    // Eski/temiz kurulumdaki Genel Sunucu sahipsiz kalmasın: ilk gerçek üye
    // sahibi olur. Böylece rol ve kanal ayarları kilitlenmez.
    if (server.id === 'default-server' && server.creatorId === 'system') {
      server.creatorId = userId;
    }
    this.ensureServerRoleData(serverId);
    this.saveData();
    return true;
  }

  removeServerMember(serverId, userId) {
    const members = this.serverMembers.get(serverId);
    if (!members) return false;

    const index = members.indexOf(userId);
    if (index === -1) return false;

    members.splice(index, 1);
    const assignments = this.serverMemberRoles.get(serverId) || {};
    const moderation = this.serverModeration.get(serverId) || {};
    delete assignments[userId];
    delete moderation[userId];
    this.serverMemberRoles.set(serverId, assignments);
    this.serverModeration.set(serverId, moderation);
    this.saveData();
    return true;
  }

  getServerMembers(serverId) {
    const memberIds = this.serverMembers.get(serverId) || [];
    return memberIds.map(id => publicUser(this.getUserById(id))).filter(Boolean);
  }

  getServerRoles(serverId) {
    this.ensureServerRoleData(serverId);
    return (this.serverRoles.get(serverId) || []).map(copyRole);
  }

  getServerRole(serverId, roleId) {
    return this.getServerRoles(serverId).find(role => role.id === roleId) || null;
  }

  createServerRole(serverId, { name, color = null, permissions = [] }) {
    if (!this.getServerById(serverId) || !String(name || '').trim()) return null;

    this.ensureServerRoleData(serverId);
    const roles = this.serverRoles.get(serverId);
    const role = {
      id: uuidv4(),
      serverId,
      name: String(name).trim().slice(0, 100),
      color: typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : null,
      permissions: sanitizePermissions(permissions),
      position: roles.length,
      isDefault: false,
      managed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    roles.push(role);
    this.serverRoles.set(serverId, roles);
    this.ensureServerRoleData(serverId);
    this.saveData();
    return copyRole(this.getServerRole(serverId, role.id));
  }

  updateServerRole(serverId, roleId, updates) {
    this.ensureServerRoleData(serverId);
    const roles = this.serverRoles.get(serverId) || [];
    const role = roles.find(item => item.id === roleId);
    if (!role) return null;

    if (role.isDefault) {
      if (updates.permissions === undefined) return copyRole(role);
      role.permissions = sanitizePermissions(updates.permissions);
      role.updatedAt = Date.now();
      this.saveData();
      return copyRole(role);
    }

    if (updates.name !== undefined) {
      const name = String(updates.name || '').trim().slice(0, 100);
      if (!name) return null;
      role.name = name;
    }
    if (updates.color !== undefined) {
      role.color = typeof updates.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(updates.color)
        ? updates.color
        : null;
    }
    if (updates.permissions !== undefined) role.permissions = sanitizePermissions(updates.permissions);
    role.updatedAt = Date.now();
    this.saveData();
    return copyRole(role);
  }

  deleteServerRole(serverId, roleId) {
    this.ensureServerRoleData(serverId);
    const roles = this.serverRoles.get(serverId) || [];
    const role = roles.find(item => item.id === roleId);
    if (!role || role.isDefault) return false;

    this.serverRoles.set(serverId, roles.filter(item => item.id !== roleId));
    const assignments = this.serverMemberRoles.get(serverId) || {};
    Object.keys(assignments).forEach(userId => {
      assignments[userId] = (assignments[userId] || []).filter(id => id !== roleId);
      if (!assignments[userId].length) delete assignments[userId];
    });
    this.serverMemberRoles.set(serverId, assignments);
    this.ensureServerRoleData(serverId);
    this.saveData();
    return true;
  }

  reorderServerRoles(serverId, roleIds) {
    this.ensureServerRoleData(serverId);
    if (!Array.isArray(roleIds)) return null;

    const roles = this.serverRoles.get(serverId) || [];
    const defaultRole = roles.find(role => role.isDefault);
    const customRoles = roles.filter(role => !role.isDefault);
    const customRoleIds = new Set(customRoles.map(role => role.id));
    const requestedIds = roleIds.filter(roleId => customRoleIds.has(roleId));

    if (requestedIds.length !== customRoles.length || new Set(requestedIds).size !== customRoles.length) return null;

    const byId = new Map(customRoles.map(role => [role.id, role]));
    const reordered = requestedIds.map((roleId, index) => ({
      ...byId.get(roleId),
      position: index + 1,
      updatedAt: Date.now(),
    }));

    this.serverRoles.set(serverId, [defaultRole, ...reordered]);
    this.saveData();
    return this.getServerRoles(serverId);
  }

  getMemberRoleIds(serverId, userId) {
    if (!this.isServerMember(serverId, userId)) return [];

    this.ensureServerRoleData(serverId);
    const assigned = this.serverMemberRoles.get(serverId)?.[userId] || [];
    return [getDefaultRoleId(serverId), ...assigned];
  }

  setMemberRoles(serverId, userId, roleIds) {
    if (!this.isServerMember(serverId, userId) || !Array.isArray(roleIds)) return null;

    this.ensureServerRoleData(serverId);
    const defaultRoleId = getDefaultRoleId(serverId);
    const validRoleIds = new Set((this.serverRoles.get(serverId) || [])
      .filter(role => !role.isDefault)
      .map(role => role.id));
    const nextRoleIds = [...new Set(roleIds)].filter(roleId => roleId !== defaultRoleId && validRoleIds.has(roleId));

    if (nextRoleIds.length !== [...new Set(roleIds)].filter(roleId => roleId !== defaultRoleId).length) {
      return null;
    }

    const assignments = this.serverMemberRoles.get(serverId) || {};
    if (nextRoleIds.length) assignments[userId] = nextRoleIds;
    else delete assignments[userId];
    this.serverMemberRoles.set(serverId, assignments);
    this.saveData();
    return this.getServerMemberDetails(serverId, userId);
  }

  getMemberPermissions(serverId, userId) {
    const server = this.getServerById(serverId);
    if (!server || server.isDM || !this.isServerMember(serverId, userId)) return [];
    if (server.creatorId === userId) return [...ALL_PERMISSIONS];

    const roleIds = new Set(this.getMemberRoleIds(serverId, userId));
    const permissions = new Set();
    (this.serverRoles.get(serverId) || []).forEach(role => {
      if (!roleIds.has(role.id)) return;
      role.permissions.forEach(permission => permissions.add(permission));
    });

    if (permissions.has('ADMINISTRATOR')) return [...ALL_PERMISSIONS];
    return [...permissions];
  }

  hasPermission(serverId, userId, permission) {
    const permissions = this.getMemberPermissions(serverId, userId);
    return permissions.includes('ADMINISTRATOR') || permissions.includes(permission);
  }

  getHighestRolePosition(serverId, userId) {
    const server = this.getServerById(serverId);
    if (!server || !this.isServerMember(serverId, userId)) return -1;
    if (server.creatorId === userId) return Number.MAX_SAFE_INTEGER;

    const roleIds = new Set(this.getMemberRoleIds(serverId, userId));
    return (this.serverRoles.get(serverId) || [])
      .filter(role => roleIds.has(role.id))
      .reduce((highest, role) => Math.max(highest, role.position), 0);
  }

  canManageMember(serverId, actorId, targetUserId) {
    const server = this.getServerById(serverId);
    if (!server || actorId === targetUserId || !this.isServerMember(serverId, actorId) || !this.isServerMember(serverId, targetUserId)) {
      return false;
    }
    if (targetUserId === server.creatorId) return false;
    if (actorId === server.creatorId) return true;

    return this.getHighestRolePosition(serverId, actorId) > this.getHighestRolePosition(serverId, targetUserId);
  }

  canModerateMember(serverId, actorId, targetUserId, permission) {
    return this.hasPermission(serverId, actorId, permission)
      && this.canManageMember(serverId, actorId, targetUserId);
  }

  getMemberModerationState(serverId, userId) {
    const state = this.serverModeration.get(serverId)?.[userId];
    return {
      serverMuted: Boolean(state?.serverMuted),
      serverDeafened: Boolean(state?.serverDeafened),
      timeoutUntil: Number(state?.timeoutUntil) > Date.now() ? Number(state.timeoutUntil) : null,
      isTimedOut: Number(state?.timeoutUntil) > Date.now(),
      updatedAt: state?.updatedAt || null,
      updatedBy: state?.updatedBy || null,
    };
  }

  setMemberModerationState(serverId, userId, updates, updatedBy = null) {
    if (!this.isServerMember(serverId, userId)) return null;

    const moderation = this.serverModeration.get(serverId) || {};
    const current = this.getMemberModerationState(serverId, userId);
    const next = {
      serverMuted: updates.serverMuted === undefined ? current.serverMuted : Boolean(updates.serverMuted),
      serverDeafened: updates.serverDeafened === undefined ? current.serverDeafened : Boolean(updates.serverDeafened),
      timeoutUntil: updates.timeoutUntil === undefined
        ? current.timeoutUntil
        : (Number(updates.timeoutUntil) > Date.now() ? Number(updates.timeoutUntil) : null),
      updatedAt: Date.now(),
      updatedBy,
    };

    if (next.serverMuted || next.serverDeafened || next.timeoutUntil) moderation[userId] = next;
    else delete moderation[userId];
    this.serverModeration.set(serverId, moderation);
    this.saveData();
    return this.getMemberModerationState(serverId, userId);
  }

  isMemberTimedOut(serverId, userId) {
    return this.getMemberModerationState(serverId, userId).isTimedOut;
  }

  getServerMemberDetails(serverId, userId) {
    if (!this.isServerMember(serverId, userId)) return null;
    const user = publicUser(this.getUserById(userId));
    if (!user) return null;

    const roleIds = this.getMemberRoleIds(serverId, userId);
    const rolesById = new Map(this.getServerRoles(serverId).map(role => [role.id, role]));
    const moderation = this.getMemberModerationState(serverId, userId);
    const server = this.getServerById(serverId);

    return {
      ...user,
      status: this.getUserStatus(userId),
      roleIds,
      roles: roleIds.map(roleId => rolesById.get(roleId)).filter(Boolean),
      permissions: this.getMemberPermissions(serverId, userId),
      isOwner: server?.creatorId === userId,
      ...moderation,
    };
  }

  getServerMembersWithDetails(serverId) {
    return (this.serverMembers.get(serverId) || [])
      .map(userId => this.getServerMemberDetails(serverId, userId))
      .filter(Boolean);
  }

  getChannelsByServerId(serverId) { return this.channels.filter(channel => channel.serverId === serverId); }
  getChannelById(id) { return this.channels.find(channel => channel.id === id); }
  createChannel(serverId, name, type = 'text') {
    const channel = { id: uuidv4(), serverId, name, type, createdAt: Date.now() };
    this.channels.push(channel);
    this.saveData();
    return channel;
  }
  deleteChannel(id) {
    const index = this.channels.findIndex(channel => channel.id === id);
    if (index === -1) return false;
    this.channels.splice(index, 1);
    this.channelMessages.delete(id);
    this.saveData();
    return true;
  }
  addChannelMessage(channelId, message) {
    if (!this.channelMessages.has(channelId)) this.channelMessages.set(channelId, []);
    const messages = this.channelMessages.get(channelId);
    messages.push(message);
    if (messages.length > 500) this.channelMessages.set(channelId, messages.slice(-500));
    this.saveData();
  }
  getChannelMessages(channelId) { return this.channelMessages.get(channelId) || []; }
  updateChannelMessage(channelId, messageId, newContent) {
    const message = this.getChannelMessages(channelId).find(item => item.id === messageId);
    if (!message) return null;
    message.content = newContent;
    message.isEdited = true;
    this.saveData();
    return message;
  }
  deleteChannelMessage(channelId, messageId) {
    const messages = this.getChannelMessages(channelId);
    const index = messages.findIndex(message => message.id === messageId);
    if (index === -1) return false;
    messages.splice(index, 1);
    this.saveData();
    return true;
  }

  createUser(username) {
    const user = { id: uuidv4(), username, createdAt: Date.now() };
    this.users.push(user);
    this.userStatuses.set(user.id, 'offline');
    this.addServerMember('default-server', user.id);
    this.assignDefaultServerOwnershipIfNeeded(user.id);
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
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`,
      status: 'offline',
      createdAt: Date.now(),
      tokenVersion: 0,
    };
    this.users.push(user);
    this.userStatuses.set(user.id, 'offline');
    this.addServerMember('default-server', user.id);
    this.assignDefaultServerOwnershipIfNeeded(user.id);
    this.saveData();
    return user;
  }

  assignDefaultServerOwnershipIfNeeded(userId) {
    const defaultServer = this.getServerById('default-server');
    if (defaultServer?.creatorId === 'system' && this.isServerMember(defaultServer.id, userId)) {
      defaultServer.creatorId = userId;
      this.saveData();
    }
  }

  getUserById(id) { return this.users.find(user => user.id === id); }
  getUserByUsername(username) {
    return this.users.find(user => user.username?.trim().toLowerCase() === String(username || '').trim().toLowerCase());
  }
  getUserByEmail(email) {
    return this.users.find(user => user.email?.trim().toLowerCase() === String(email || '').trim().toLowerCase());
  }
  getAllUsers() { return [...this.users]; }
  getPublicUserById(id) { return publicUser(this.getUserById(id)); }
  getPublicUsers() { return this.users.map(publicUser); }

  updateUserStatus(id, status) { this.userStatuses.set(id, status); }
  getUserStatus(id) { return this.userStatuses.get(id) || 'offline'; }

  updateUserPassword(userId, passwordHash, { invalidateSessions = true } = {}) {
    const user = this.getUserById(userId);
    if (!user) return null;
    user.password = passwordHash;
    if (invalidateSessions) user.tokenVersion = (user.tokenVersion || 0) + 1;
    this.saveData();
    return user;
  }

  updateUserEmail(userId, email) {
    const user = this.getUserById(userId);
    const existingUser = this.getUserByEmail(email);
    if (!user || (existingUser && existingUser.id !== userId)) return null;
    user.email = String(email).trim().toLowerCase();
    this.saveData();
    return user;
  }

  updateUserProfile(userId, updates) {
    const user = this.getUserById(userId);
    if (!user) return null;

    if (updates.username) {
      const nextUsername = String(updates.username).trim();
      const existing = this.getUserByUsername(nextUsername);
      if (existing && existing.id !== userId) throw new Error('Username taken');
      user.username = nextUsername;
    }
    if (updates.avatar !== undefined) user.avatar = updates.avatar;
    this.saveData();
    return user;
  }

  getOrCreateDMConversation(userId1, userId2) {
    const [id1, id2] = [userId1, userId2].sort();
    let dmServer = this.servers.find(server => server.isDM && server.dmUserIds?.includes(id1) && server.dmUserIds?.includes(id2));
    if (!dmServer) {
      const serverId = uuidv4();
      dmServer = { id: serverId, name: `DM-${id1}-${id2}`, isDM: true, dmUserIds: [id1, id2], createdAt: Date.now() };
      this.servers.push(dmServer);
      this.serverMembers.set(serverId, [id1, id2]);
      this.channels.push({ id: uuidv4(), serverId, name: 'dm-chat', type: 'text', createdAt: Date.now() });
      this.saveData();
    }
    const channel = this.channels.find(item => item.serverId === dmServer.id);
    return { id: dmServer.id, channelId: channel?.id, user1Id: id1, user2Id: id2 };
  }

  getUserDMConversations(userId) {
    return this.servers
      .filter(server => server.isDM && server.dmUserIds?.includes(userId))
      .map(server => {
        const otherUserId = server.dmUserIds.find(id => id !== userId);
        const channel = this.channels.find(item => item.serverId === server.id);
        return {
          id: server.id,
          channelId: channel?.id,
          user1Id: userId,
          user2Id: otherUserId,
          otherUser: publicUser(this.getUserById(otherUserId)),
        };
      })
      .filter(conversation => conversation.otherUser);
  }

  createFriendRequest(from, to) {
    if (this.friendships.some(friendship => (
      (friendship.user1Id === from && friendship.user2Id === to)
      || (friendship.user1Id === to && friendship.user2Id === from)
    ))) return null;
    if (this.friendRequests.find(request => (
      (request.fromUserId === from && request.toUserId === to)
      || (request.fromUserId === to && request.toUserId === from)
    ))) return null;

    const request = { id: uuidv4(), fromUserId: from, toUserId: to, status: 'pending', createdAt: Date.now() };
    this.friendRequests.push(request);
    this.saveData();
    return request;
  }
  getPendingFriendRequests(userId) {
    return this.friendRequests
      .filter(request => request.toUserId === userId && request.status === 'pending')
      .map(request => ({ ...request, fromUser: publicUser(this.getUserById(request.fromUserId)) }));
  }
  acceptFriendRequest(requestId) {
    const request = this.friendRequests.find(item => item.id === requestId);
    if (!request) return false;
    request.status = 'accepted';
    const [id1, id2] = [request.fromUserId, request.toUserId].sort();
    this.friendships.push({ id: uuidv4(), user1Id: id1, user2Id: id2, createdAt: Date.now() });
    this.saveData();
    return true;
  }
  rejectFriendRequest(requestId) {
    const index = this.friendRequests.findIndex(request => request.id === requestId);
    if (index === -1) return false;
    this.friendRequests.splice(index, 1);
    this.saveData();
    return true;
  }
  getUserFriends(userId) {
    return this.friendships
      .filter(friendship => friendship.user1Id === userId || friendship.user2Id === userId)
      .map(friendship => {
        const friendId = friendship.user1Id === userId ? friendship.user2Id : friendship.user1Id;
        const user = publicUser(this.getUserById(friendId));
        return user ? { ...user, status: this.getUserStatus(friendId) } : null;
      })
      .filter(Boolean);
  }
  removeFriend(userId1, userId2) {
    const [id1, id2] = [userId1, userId2].sort();
    const index = this.friendships.findIndex(friendship => friendship.user1Id === id1 && friendship.user2Id === id2);
    if (index !== -1) {
      this.friendships.splice(index, 1);
      this.saveData();
    }
  }

  findUserById(id) { return this.getUserById(id); }
  findUserByUsername(username) { return this.getUserByUsername(username); }
  findUserByEmail(email) { return this.getUserByEmail(email); }
  getPendingRequests(userId) { return this.getPendingFriendRequests(userId); }
  sendFriendRequest(from, to) { return this.createFriendRequest(from, to); }
  addMemberToServer(serverId, userId) { return this.addServerMember(serverId, userId); }
}

const storage = new InMemoryStorage();
storage.PERMISSIONS = PERMISSIONS;
storage.DEFAULT_MEMBER_PERMISSIONS = DEFAULT_MEMBER_PERMISSIONS;
storage.ALL_PERMISSIONS = ALL_PERMISSIONS;

module.exports = storage;
