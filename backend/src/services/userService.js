class UserService {
  constructor() {
    this.channelMembers = new Map(); // channelId -> Map(socketId -> user)
  }

  addUser(channelId, user) {
    if (!this.channelMembers.has(channelId)) {
      this.channelMembers.set(channelId, new Map());
    }
    this.channelMembers.get(channelId).set(user.id, user);
  }

  removeUser(channelId, socketId) {
    if (this.channelMembers.has(channelId)) {
      this.channelMembers.get(channelId).delete(socketId);
      
      // Clean up empty channels
      if (this.channelMembers.get(channelId).size === 0) {
        this.channelMembers.delete(channelId);
      }
    }
  }

  getChannelMembers(channelId) {
    if (!this.channelMembers.has(channelId)) {
      return [];
    }
    return Array.from(this.channelMembers.get(channelId).values());
  }

  getUserBySocket(socketId) {
    for (const members of this.channelMembers.values()) {
      if (members.has(socketId)) {
        return members.get(socketId);
      }
    }
    return null;
  }

  getAllOnlineUsers() {
    const users = new Set();
    for (const members of this.channelMembers.values()) {
      for (const user of members.values()) {
        users.add(user.username);
      }
    }
    return Array.from(users);
  }
}

module.exports = { userService: new UserService() };
