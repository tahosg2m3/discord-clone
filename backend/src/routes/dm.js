const express = require('express');

const storage = require('../storage/inMemory');
const { messageService } = require('../services/messageService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/messages/:conversationId', (req, res) => {
  const conversation = storage.getServerById(req.params.conversationId);
  if (!conversation?.isDM || !conversation.dmUserIds?.includes(req.user.id)) {
    return res.status(403).json({ error: 'Bu özel mesaja erişim yetkin yok.' });
  }

  const channel = storage.getChannelsByServerId(conversation.id).find(item => item.type === 'text');
  if (!channel) return res.json([]);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  return res.json(messageService.getChannelMessages(channel.id, limit, req.query.before));
});

router.get('/:userId', (req, res) => {
  if (req.params.userId !== req.user.id) {
    return res.status(403).json({ error: 'Sadece kendi özel mesajlarını görüntüleyebilirsin.' });
  }
  return res.json(storage.getUserDMConversations(req.user.id));
});

router.post('/create', (req, res) => {
  const targetUserId = String(req.body.userId2 || req.body.targetUserId || '').trim();
  if (!targetUserId || targetUserId === req.user.id) return res.status(400).json({ error: 'Geçerli bir kullanıcı seç.' });
  if (!storage.getUserById(targetUserId)) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

  const conversation = storage.getOrCreateDMConversation(req.user.id, targetUserId);
  return res.json(conversation);
});

module.exports = router;
