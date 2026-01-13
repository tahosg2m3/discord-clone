const express = require('express');
const router = express.Router();
const storage = require('../storage/inMemory');
const { messageService } = require('../services/messageService');

// GET /api/channels?serverId=xxx
router.get('/', (req, res) => {
  const { serverId } = req.query;
  if (!serverId) return res.status(400).json({ error: 'serverId required' });
  const channels = storage.getChannelsByServerId(serverId);
  res.json(channels);
});

// GET /api/channels/:id
router.get('/:id', (req, res) => {
  const channel = storage.getChannelById(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  res.json(channel);
});

// GET /api/channels/:id/messages (Pagination eklendi)
router.get('/:id/messages', (req, res) => {
  const { id } = req.params;
  const { limit, before } = req.query;
  
  const messages = messageService.getChannelMessages(
    id, 
    parseInt(limit) || 50, 
    before // Timestamp
  );
  res.json(messages);
});

// POST /api/channels
router.post('/', (req, res) => {
  const { serverId, name, type } = req.body;
  if (!serverId || !name?.trim()) return res.status(400).json({ error: 'Fields required' });
  
  const server = storage.getServerById(serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const channel = storage.createChannel(serverId, name.trim(), type || 'text');
  res.status(201).json(channel);
});

// DELETE /api/channels/:id
router.delete('/:id', (req, res) => {
  if (storage.deleteChannel(req.params.id)) {
    res.json({ message: 'Deleted' });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

module.exports = router;