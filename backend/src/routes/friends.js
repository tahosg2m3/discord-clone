const express = require('express');

const storage = require('../storage/inMemory');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function emitFriendUpdate(req, userId) {
  req.app.get('io')?.to(`user:${userId}`).emit('friends:changed', { userId });
}

router.use(requireAuth);

router.get('/:userId/pending', (req, res) => {
  if (req.params.userId !== req.user.id) return res.status(403).json({ error: 'Bu isteklere erişim yetkin yok.' });
  return res.json(storage.getPendingRequests(req.user.id));
});

router.get('/:userId', (req, res) => {
  if (req.params.userId !== req.user.id) return res.status(403).json({ error: 'Bu arkadaş listesine erişim yetkin yok.' });
  return res.json(storage.getUserFriends(req.user.id));
});

router.post('/request', (req, res) => {
  const targetUsername = String(req.body.targetUsername || '').trim();
  const targetUserId = String(req.body.toUserId || '').trim();
  const targetUser = targetUserId
    ? storage.getUserById(targetUserId)
    : storage.findUserByUsername(targetUsername);

  if (!targetUser) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  if (targetUser.id === req.user.id) return res.status(400).json({ error: 'Kendine arkadaşlık isteği gönderemezsin.' });

  const request = storage.sendFriendRequest(req.user.id, targetUser.id);
  if (!request) return res.status(400).json({ error: 'İstek zaten gönderilmiş veya zaten arkadaşsınız.' });

  req.app.get('io')?.to(`user:${targetUser.id}`).emit('friend:request', {
    request: { ...request, fromUser: storage.getPublicUserById(req.user.id) },
  });
  return res.status(201).json(request);
});

router.post('/accept', (req, res) => {
  const request = storage.friendRequests.find(item => item.id === req.body.requestId);
  if (!request || request.toUserId !== req.user.id || request.status !== 'pending') {
    return res.status(400).json({ error: 'Arkadaşlık isteği bulunamadı.' });
  }

  storage.acceptFriendRequest(request.id);
  emitFriendUpdate(req, request.fromUserId);
  emitFriendUpdate(req, request.toUserId);
  return res.json({ message: 'Arkadaşlık isteği kabul edildi.' });
});

router.post('/reject', (req, res) => {
  const request = storage.friendRequests.find(item => item.id === req.body.requestId);
  if (!request || request.toUserId !== req.user.id || request.status !== 'pending') {
    return res.status(400).json({ error: 'Arkadaşlık isteği bulunamadı.' });
  }

  storage.rejectFriendRequest(request.id);
  emitFriendUpdate(req, req.user.id);
  return res.json({ message: 'Arkadaşlık isteği reddedildi.' });
});

router.delete('/:userId/:friendId', (req, res) => {
  if (req.params.userId !== req.user.id) return res.status(403).json({ error: 'Bu arkadaşlığı değiştiremezsin.' });
  storage.removeFriend(req.user.id, req.params.friendId);
  emitFriendUpdate(req, req.user.id);
  emitFriendUpdate(req, req.params.friendId);
  return res.json({ success: true });
});

module.exports = router;
