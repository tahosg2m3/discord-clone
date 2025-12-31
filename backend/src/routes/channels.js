// backend/src/routes/channels.js
const express = require('express');
const router = express.Router();
const storage = require('../storage/inMemory');

// GET /api/channels?serverId=xxx - Get channels by server
router.get('/', (req, res) => {
  const { serverId } = req.query;
  
  if (!serverId) {
    return res.status(400).json({ error: 'serverId query parameter required' });
  }

  const channels = storage.getChannelsByServerId(serverId);
  res.json(channels);
});

// GET /api/channels/:id - Get channel by ID
router.get('/:id', (req, res) => {
  const channel = storage.getChannelById(req.params.id);
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  res.json(channel);
});

// POST /api/channels - Create new channel
router.post('/', (req, res) => {
  const { serverId, name, type } = req.body; // type eklendi
  
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

// DELETE /api/channels/:id - Delete channel
router.delete('/:id', (req, res) => {
  const deleted = storage.deleteChannel(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  res.json({ message: 'Channel deleted' });
});

module.exports = router;