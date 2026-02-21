const express = require('express');
const router = express.Router();
const storage = require('../storage/inMemory');
const { messageService } = require('../services/messageService'); 

router.get('/:userId', (req, res) => {
  const convs = storage.getUserDMConversations(req.params.userId);
  res.json(convs);
});

router.post('/create', (req, res) => {
  const { userId1, userId2 } = req.body;
  const conv = storage.getOrCreateDMConversation(userId1, userId2);
  res.json(conv);
});

// Artık DM mesajları için sunucu kanalının veritabanına bakılıyor
router.get('/messages/:conversationId', (req, res) => {
  // conversationId burada aslında gizli DM sunucusunun (dmServer.id) ID'sidir
  const channel = storage.channels.find(c => c.serverId === req.params.conversationId);
  
  if (!channel) return res.json([]);
  
  const before = req.query.before;
  const messages = messageService.getChannelMessages(channel.id, 50, before);
  res.json(messages);
});

module.exports = router;