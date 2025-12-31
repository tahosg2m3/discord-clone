const { v4: uuidv4 } = require('uuid');

class MessageService {
  constructor() {
    this.messages = new Map(); // channelId -> array of messages
  }

  createMessage({ username, content, channelId }) {
    const message = {
      id: uuidv4(),
      username,
      content,
      channelId,
      timestamp: Date.now(),
      type: 'user',
    };

    // Store message
    if (!this.messages.has(channelId)) {
      this.messages.set(channelId, []);
    }
    this.messages.get(channelId).push(message);

    // Keep only last 100 messages per channel (memory management)
    const channelMessages = this.messages.get(channelId);
    if (channelMessages.length > 100) {
      this.messages.set(channelId, channelMessages.slice(-100));
    }

    return message;
  }

  getChannelMessages(channelId, limit = 50) {
    const messages = this.messages.get(channelId) || [];
    return messages.slice(-limit); // Return last N messages
  }

  deleteMessage(messageId) {
    for (const [channelId, messages] of this.messages.entries()) {
      const index = messages.findIndex(m => m.id === messageId);
      if (index !== -1) {
        messages.splice(index, 1);
        return true;
      }
    }
    return false;
  }
}

module.exports = { messageService: new MessageService() };
