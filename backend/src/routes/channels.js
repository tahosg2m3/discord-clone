const express = require('express');

const storage = require('../storage/inMemory');
const { messageService } = require('../services/messageService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function canAccessServer(serverId, userId, permission = 'VIEW_CHANNEL') {
  const server = storage.getServerById(serverId);
  if (!server) return { allowed: false, server: null };
  if (server.isDM) return { allowed: server.dmUserIds?.includes(userId), server };
  return {
    allowed: storage.isServerMember(serverId, userId) && storage.hasPermission(serverId, userId, permission),
    server,
  };
}

function getChannelAccess(channelId, userId, permission = 'VIEW_CHANNEL') {
  const channel = storage.getChannelById(channelId);
  if (!channel) return { allowed: false, channel: null, server: null };
  return { channel, ...canAccessServer(channel.serverId, userId, permission) };
}

router.use(requireAuth);

router.get('/', (req, res) => {
  const serverId = String(req.query.serverId || '');
  if (!serverId) return res.status(400).json({ error: 'serverId gerekli.' });

  const access = canAccessServer(serverId, req.user.id, 'VIEW_CHANNEL');
  if (!access.server) return res.status(404).json({ error: 'Sunucu bulunamadı.' });
  if (!access.allowed) return res.status(403).json({ error: 'Bu sunucuya erişim yetkin yok.' });
  return res.json(storage.getChannelsByServerId(serverId));
});

router.get('/:id/messages', (req, res) => {
  const access = getChannelAccess(req.params.id, req.user.id, 'VIEW_CHANNEL');
  if (!access.channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });
  if (!access.allowed) return res.status(403).json({ error: 'Bu kanala erişim yetkin yok.' });

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  return res.json(messageService.getChannelMessages(req.params.id, limit, req.query.before));
});

router.get('/:id', (req, res) => {
  const access = getChannelAccess(req.params.id, req.user.id, 'VIEW_CHANNEL');
  if (!access.channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });
  if (!access.allowed) return res.status(403).json({ error: 'Bu kanala erişim yetkin yok.' });
  return res.json(access.channel);
});

router.post('/', (req, res) => {
  const serverId = String(req.body.serverId || '');
  const name = String(req.body.name || '').trim();
  const type = req.body.type === 'voice' ? 'voice' : 'text';
  if (!serverId || !name || name.length > 100) return res.status(400).json({ error: 'Geçerli kanal bilgileri gerekli.' });

  const access = canAccessServer(serverId, req.user.id, 'MANAGE_CHANNELS');
  if (!access.server) return res.status(404).json({ error: 'Sunucu bulunamadı.' });
  if (access.server.isDM || !access.allowed) return res.status(403).json({ error: 'Kanal oluşturma yetkin yok.' });

  const channel = storage.createChannel(serverId, name, type);
  req.app.get('io')?.to(`server:${serverId}`).emit('channels:changed', { serverId });
  return res.status(201).json(channel);
});

router.delete('/:id', (req, res) => {
  const access = getChannelAccess(req.params.id, req.user.id, 'MANAGE_CHANNELS');
  if (!access.channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });
  if (access.server.isDM || !access.allowed) return res.status(403).json({ error: 'Kanal silme yetkin yok.' });

  const serverId = access.channel.serverId;
  storage.deleteChannel(req.params.id);
  req.app.get('io')?.to(`server:${serverId}`).emit('channels:changed', { serverId });
  return res.json({ message: 'Kanal silindi.' });
});

module.exports = router;
