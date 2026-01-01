// backend/src/routes/friends.js
const express = require('express');
const router = express.Router();
const storage = require('../storage/inMemory');

// Get user's friends
router.get('/:userId', (req, res) => {
  const { userId } = req.params;
  const friends = storage.getUserFriends(userId);
  res.json(friends);
});

// Get pending friend requests
router.get('/:userId/pending', (req, res) => {
  const { userId } = req.params;
  const requests = storage.getPendingFriendRequests(userId);
  res.json(requests);
});

// Send friend request
router.post('/request', (req, res) => {
  const { fromUserId, toUserId } = req.body;
  
  if (!fromUserId || !toUserId) {
    return res.status(400).json({ error: 'Both user IDs required' });
  }

  if (fromUserId === toUserId) {
    return res.status(400).json({ error: 'Cannot add yourself' });
  }

  const request = storage.createFriendRequest(fromUserId, toUserId);
  
  if (!request) {
    return res.status(400).json({ error: 'Request already exists or users are friends' });
  }

  res.status(201).json(request);
});

// Accept friend request
router.post('/accept', (req, res) => {
  const { requestId } = req.body;
  
  const success = storage.acceptFriendRequest(requestId);
  
  if (!success) {
    return res.status(404).json({ error: 'Request not found' });
  }

  res.json({ message: 'Friend request accepted' });
});

// Reject friend request
router.post('/reject', (req, res) => {
  const { requestId } = req.body;
  
  const success = storage.rejectFriendRequest(requestId);
  
  if (!success) {
    return res.status(404).json({ error: 'Request not found' });
  }

  res.json({ message: 'Friend request rejected' });
});

// Remove friend
router.delete('/:userId/:friendId', (req, res) => {
  const { userId, friendId } = req.params;
  
  storage.removeFriend(userId, friendId);
  
  res.json({ message: 'Friend removed' });
});

module.exports = router;