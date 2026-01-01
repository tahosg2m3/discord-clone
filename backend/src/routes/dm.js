// backend/src/routes/dm.js
const express = require('express');
const router = express.Router();
const storage = require('../storage/inMemory');

// Get user's DM conversations
router.get('/:userId', (req, res) => {
  const { userId } = req.params;
  const conversations = storage.getUserDMConversations(userId);
  res.json(conversations);
});

// Get or create DM conversation
router.post('/create', (req, res) => {
  const { userId1, userId2 } = req.body;
  
  if (!userId1 || !userId2) {
    return res.status(400).json({ error: 'Both user IDs required' });
  }

  if (userId1 === userId2) {
    return res.status(400).json({ error: 'Cannot DM yourself' });
  }

  const conversation = storage.getOrCreateDMConversation(userId1, userId2);
  res.json(conversation);
});

// Get DM messages
router.get('/messages/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  const messages = storage.getDMMessages(conversationId);
  res.json(messages);
});

module.exports = router;