const { v4: uuidv4 } = require('uuid');
const ogs = require('open-graph-scraper');
const linkify = require('linkify-it')();
const storage = require('../storage/inMemory'); // Storage'ı dahil ettik

class MessageService {
  // Constructor'da artık veri tutmuyoruz, storage kullanacağız.

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

    // Link önizlemesi (Metadata)
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