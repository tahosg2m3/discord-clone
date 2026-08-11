const { v4: uuidv4 } = require('uuid');
const linkify = require('linkify-it')();
const storage = require('../storage/inMemory'); // Storage'ı dahil ettik


// User supplied URLs are never fetched by the backend.  Networked Open Graph
// scraping permits SSRF and DNS-rebinding attacks, so the message card below
// is built entirely from locally parsed URL data.
function createSafeLinkMetadata(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return {
      title: url.hostname.replace(/^www\./i, '') || url.href,
      url: url.href,
    };
  } catch {
    return null;
  }
}

function normalizeVoiceMessage(value) {
  if (!value || typeof value !== 'object' || typeof value.url !== 'string') return null;
  const url = value.url.trim().slice(0, 2048);
  const durationMs = Math.min(Math.max(Number(value.durationMs) || 0, 100), 600_000);
  if (!url || !durationMs) return null;
  const waveform = Array.isArray(value.waveform)
    ? value.waveform.slice(0, 256).map(point => Math.min(1, Math.max(0, Number(point) || 0)))
    : [];
  const mimeType = /^audio\/[a-z0-9.+-]+$/i.test(String(value.mimeType || ''))
    ? String(value.mimeType).slice(0, 100)
    : 'audio/webm';
  return { url, durationMs, waveform, mimeType };
}

class MessageService {
  // Constructor'da artık veri tutmuyoruz, storage kullanacağız.

  async createMessage({ username, content, channelId, userId, attachments = [], replyTo = null, voiceMessage = null }) {
    const safeVoiceMessage = normalizeVoiceMessage(voiceMessage);
    const message = {
      id: uuidv4(),
      username,
      userId,
      content,
      channelId,
      timestamp: Date.now(),
      type: safeVoiceMessage ? 'voice' : 'user',
      isEdited: false,
      metadata: null,
      attachments: Array.isArray(attachments) ? attachments : [],
      replyTo: replyTo && typeof replyTo === 'object' ? {
        id: String(replyTo.id || ''),
        username: String(replyTo.username || ''),
        content: String(replyTo.content || '').slice(0, 500),
      } : null,
      reactions: {},
      isPinned: false,
      voiceMessage: safeVoiceMessage,
      editHistory: [],
    };

    // URL yerelde ayrıştırılır; backend hiçbir kullanıcı bağlantısına istek atmaz.
    const matches = linkify.match(content);
    if (matches && matches.length > 0) message.metadata = createSafeLinkMetadata(matches[0].url);

    // Storage'a kaydet (Bu sayede kalıcı olur)
    storage.addChannelMessage(channelId, message);

    return message;
  }

  getChannelMessages(channelId, limit = 50, before = null) {
    // Mesajları Storage'dan çek
    const allMessages = storage.getChannelMessages(channelId);
    
    // Sıralama ve Pagination işlemleri
    const sorted = [...allMessages].sort((a, b) => a.timestamp - b.timestamp);

    let endIndex = sorted.length;
    
    if (before) {
      const foundIndex = sorted.findIndex(m => m.timestamp >= parseInt(before));
      endIndex = foundIndex === -1 ? sorted.length : foundIndex;
    }

    const startIndex = Math.max(0, endIndex - limit);
    return sorted.slice(startIndex, endIndex);
  }

  updateMessage(messageId, newContent, userId) {
    // Storage üzerinden güncelleme yap
    // (Storage içinde updateChannelMessage fonksiyonunu kullanıyoruz)
    // Önce kanal ID'sini bulmamız lazım ama şu anki yapıda messageId ile kanal bulmak zor olabilir.
    // Performans için tüm kanalları aramak yerine, storage'a channelId'yi de gönderebiliriz.
    // Ancak socket handler'da channelId zaten var.
    // Şimdilik storage.updateChannelMessage çağırırken channelId gerekiyor.
    
    // NOT: Bu fonksiyonun çağrıldığı yerde (messageHandler.js) channelId zaten gönderiliyor.
    // Burayı güncelliyoruz:
    return null; // Aşağıdaki overloaded metoda bakın
  }
  
  // Overload: channelId parametresi eklendi
  updateMessageWithChannel(channelId, messageId, newContent, userId) {
      const msg = storage.getChannelMessages(channelId).find(m => m.id === messageId);
      if (msg) {
          if (msg.userId !== userId) return null; // Yetki kontrolü
          
          return storage.updateChannelMessage(channelId, messageId, newContent);
      }
      return null;
  }

  deleteMessageWithChannel(channelId, messageId, userId) {
      const msg = storage.getChannelMessages(channelId).find(m => m.id === messageId);
      if (msg) {
          if (msg.userId !== userId) return false; // Yetki kontrolü
          
          return storage.deleteChannelMessage(channelId, messageId);
      }
      return false;
  }
}

const service = new MessageService();

// updateMessage ve deleteMessage için wrapper (eski kodlarla uyum için)
service.updateMessage = (messageId, content, userId) => {
    // Bu metod eski haliyle channelId bilmediği için verimsizdir.
    // Handler'ı güncellemek daha iyi. Ama uyumluluk için tüm kanalları tarayabiliriz:
    for (const channel of storage.channels) {
        const result = service.updateMessageWithChannel(channel.id, messageId, content, userId);
        if (result) return result;
    }
    return null;
};

service.deleteMessage = (messageId, userId) => {
    for (const channel of storage.channels) {
        const result = service.deleteMessageWithChannel(channel.id, messageId, userId);
        if (result) return { channelId: channel.id, messageId };
    }
    return null;
};

module.exports = { messageService: service };
