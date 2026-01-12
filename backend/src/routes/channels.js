const express = require('express');
const router = express.Router();
const storage = require('../storage/inMemory');
const { messageService } = require('../services/messageService'); // Mesaj servisini ekledik

// GET /api/channels?serverId=xxx - Sunucuya ait kanalları getir
router.get('/', (req, res) => {
  const { serverId } = req.query;
  
  if (!serverId) {
    return res.status(400).json({ error: 'serverId query parameter required' });
  }

  const channels = storage.getChannelsByServerId(serverId);
  res.json(channels);
});

// GET /api/channels/:id - ID'ye göre kanal getir
router.get('/:id', (req, res) => {
  const channel = storage.getChannelById(req.params.id);
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  res.json(channel);
});

// YENİ: GET /api/channels/:id/messages - Kanalın mesaj geçmişini getir
router.get('/:id/messages', (req, res) => {
  const { id } = req.params;
  const { limit } = req.query;
  
  // messageService üzerinden mesajları çek (Varsayılan limit 50)
  const messages = messageService.getChannelMessages(id, parseInt(limit) || 50);
  res.json(messages);
});

// POST /api/channels - Yeni kanal oluştur
router.post('/', (req, res) => {
  const { serverId, name, type } = req.body; 
  
  if (!serverId || !name || !name.trim()) {
    return res.status(400).json({ error: 'serverId and name required' });
  }

  const server = storage.getServerById(serverId);
  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }

  // Kanalı oluştur (type gönderilmezse 'text' olur)
  const channel = storage.createChannel(serverId, name.trim(), type || 'text');
  res.status(201).json(channel);
});

// DELETE /api/channels/:id - Kanal sil
router.delete('/:id', (req, res) => {
  const deleted = storage.deleteChannel(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  res.json({ message: 'Channel deleted' });
});

module.exports = router;