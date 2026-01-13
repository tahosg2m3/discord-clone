const { v4: uuidv4 } = require('uuid');
const ogs = require('open-graph-scraper');
const linkify = require('linkify-it')();

class MessageService {
  constructor() {
    this.messages = new Map(); // channelId -> array of messages
  }

  async createMessage({ username, content, channelId, userId }) {
    const message = {
      id: uuidv4(),
      username,
      userId,
      content,
      channelId,
      timestamp: Date.now(),
      type: 'user',
      isEdited: false,
      metadata: null
    };

    // Link önizlemesi (Metadata) çekme
    const matches = linkify.match(content);
    if (matches && matches.length > 0) {
      try {
        const { result } = await ogs({ url: matches[0].url, timeout: 2000 });
        if (result.ogTitle) {
          message.metadata = {
            title: result.ogTitle,
            description: result.ogDescription,
            image: result.ogImage?.[0]?.url,
            url: matches[0].url
          };
        }
      } catch (err) {
        console.log('OGS Error (Ignored):', err.message);
      }
    }

    if (!this.messages.has(channelId)) {
      this.messages.set(channelId, []);
    }
    this.messages.get(channelId).push(message);

    // Bellek yönetimi (Son 500 mesajı tut)
    const channelMessages = this.messages.get(channelId);
    if (channelMessages.length > 500) {
      this.messages.set(channelId, channelMessages.slice(-500));
    }

    return message;
  }

  // GÜNCELLENDİ: Sayfalama (Pagination) desteği
  getChannelMessages(channelId, limit = 50, before = null) {
    const allMessages = this.messages.get(channelId) || [];
    
    // Tarihe göre sıralı olduğundan emin ol
    const sorted = [...allMessages].sort((a, b) => a.timestamp - b.timestamp);

    let endIndex = sorted.length;
    
    // Eğer 'before' timestamp verilmişse, ondan öncekileri al
    if (before) {
      const foundIndex = sorted.findIndex(m => m.timestamp >= parseInt(before));
      endIndex = foundIndex === -1 ? sorted.length : foundIndex;
    }

    // Slice ile geriye doğru 'limit' kadar mesaj al
    const startIndex = Math.max(0, endIndex - limit);
    return sorted.slice(startIndex, endIndex);
  }

  updateMessage(messageId, newContent, userId) {
    for (const messages of this.messages.values()) {
      const msg = messages.find(m => m.id === messageId);
      if (msg) {
        // Sadece kendi mesajını düzenleyebilir
        if (msg.userId !== userId) return null;
        
        msg.content = newContent;
        msg.isEdited = true;
        return msg;
      }
    }
    return null;
  }

  deleteMessage(messageId, userId) {
    for (const [channelId, messages] of this.messages.entries()) {
      const index = messages.findIndex(m => m.id === messageId);
      if (index !== -1) {
        const msg = messages[index];
        // Sadece kendi mesajını silebilir
        if (msg.userId !== userId) return false;

        messages.splice(index, 1);
        return { channelId, messageId };
      }
    }
    return null;
  }
}

module.exports = { messageService: new MessageService() };