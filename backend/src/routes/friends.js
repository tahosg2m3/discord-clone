const express = require('express');
const router = express.Router();
const storage = require('../storage/inMemory');

// GET /api/friends/:userId - Arkadaş listesini getir
router.get('/:userId', (req, res) => {
  const friends = storage.getUserFriends(req.params.userId);
  res.json(friends);
});

// GET /api/friends/:userId/pending - Bekleyen istekleri getir
router.get('/:userId/pending', (req, res) => {
  // HATA BURADAYDI: getPendingFriendRequests -> getPendingRequests
  const requests = storage.getPendingRequests(req.params.userId);
  
  // İstekleri gönderen kullanıcıların detaylarını da ekleyelim
  const requestsWithDetails = requests.map(req => {
    const fromUser = storage.findUserById(req.fromUserId);
    return {
      ...req,
      fromUser: fromUser ? { id: fromUser.id, username: fromUser.username, avatar: fromUser.avatar } : null
    };
  });

  res.json(requestsWithDetails);
});

// POST /api/friends/request - Arkadaş isteği gönder
router.post('/request', (req, res) => {
  const { fromUserId, targetUsername } = req.body;

  if (!fromUserId || !targetUsername) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // HATA BURADAYDI: getUserByUsername -> findUserByUsername
  const targetUser = storage.findUserByUsername(targetUsername);

  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (targetUser.id === fromUserId) {
    return res.status(400).json({ error: 'Cannot add yourself' });
  }

  const request = storage.sendFriendRequest(fromUserId, targetUser.id);
  
  if (!request) {
    return res.status(400).json({ error: 'Request already sent or users are already friends' });
  }

  res.status(201).json(request);
});

// POST /api/friends/accept - İsteği kabul et
router.post('/accept', (req, res) => {
  const { requestId } = req.body;
  
  const success = storage.acceptFriendRequest(requestId);
  if (success) {
    res.json({ message: 'Friend request accepted' });
  } else {
    res.status(400).json({ error: 'Failed to accept request' });
  }
});

// POST /api/friends/reject - İsteği reddet
router.post('/reject', (req, res) => {
  const { requestId } = req.body;
  
  const success = storage.rejectFriendRequest(requestId);
  if (success) {
    res.json({ message: 'Friend request rejected' });
  } else {
    res.status(400).json({ error: 'Failed to reject request' });
  }
});

module.exports = router;