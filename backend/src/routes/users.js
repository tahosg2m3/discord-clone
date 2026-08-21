const express = require('express');
const { rateLimit } = require('express-rate-limit');

const storage = require('../storage/inMemory');
const { requireAuth } = require('../middleware/auth');
const { createRateLimitOptions } = require('../middleware/rateLimit');

const router = express.Router();
const authRateLimit = rateLimit(createRateLimitOptions('auth', 'users'));
const readRateLimit = rateLimit(createRateLimitOptions('read', 'users'));
const mutationRateLimit = rateLimit(createRateLimitOptions('mutation', 'users'));

function privateUser(user) {
  if (!user) return null;
  const { password, tokenVersion, ...safeUser } = user;
  return { ...safeUser, status: storage.getUserStatus(user.id) };
}

function emitProfileUpdate(req, user) {
  const io = req.app.get('io');
  if (!io || !user) return;
  const publicProfile = storage.getPublicUserById(user.id);
  storage.getAllServers()
    .filter(server => !server.isDM && storage.isServerMember(server.id, user.id))
    .forEach(server => {
      io.to(`server:${server.id}`).emit('user:profile-updated', {
        serverId: server.id,
        userId: user.id,
        user: publicProfile,
      });
      io.to(`server:${server.id}`).emit('server:members-changed', { serverId: server.id });
    });
}

function emitSocialUpdate(req, userIds) {
  const io = req.app.get('io');
  if (!io) return;
  [...new Set(userIds.filter(Boolean))].forEach(userId => {
    io.to(`user:${userId}`).emit('friends:changed', { userId });
  });
}

router.use(authRateLimit, requireAuth, readRateLimit, mutationRateLimit);

// Eski kullanıcı adıyla şifresiz giriş endpoint'i güvenlik nedeniyle kaldırıldı.
router.post('/login', (req, res) => res.status(410).json({
  error: 'Bu giriş yöntemi kaldırıldı. E-posta ve iki aşamalı doğrulama kullan.',
}));

router.get('/', (req, res) => res.json(storage.getPublicUsers()));

router.get('/me', (req, res) => res.json({ user: privateUser(req.user) }));

router.patch('/me', async (req, res) => {
  const allowedFields = [
    'username',
    'avatar',
    'banner',
    'bio',
    'customStatus',
    'presenceStatus',
    'locale',
    'theme',
  ];
  const updates = {};
  allowedFields.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) updates[field] = req.body[field];
  });

  try {
    const user = storage.updateUserProfile(req.user.id, updates);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    // Kullanıcı adı değiştiğinde mevcut socket oturumları da eski adla
    // mesaj göndermeye devam etmesin.
    const io = req.app.get('io');
    if (io) {
      try {
        const sockets = await io.in(`user:${user.id}`).fetchSockets();
        sockets.forEach(activeSocket => {
          if (activeSocket.authUser?.id !== user.id) return;
          activeSocket.authUser.username = user.username;
          if (activeSocket.userData) activeSocket.userData.username = user.username;
        });
      } catch (error) {
        console.warn('Aktif profil oturumları güncellenemedi:', error.message);
      }
    }

    emitProfileUpdate(req, user);
    return res.json({ user: privateUser(user) });
  } catch (error) {
    const message = error.message === 'Username taken'
      ? 'Bu kullanıcı adı zaten kullanılıyor.'
      : (error.message || 'Profil güncellenemedi.');
    return res.status(400).json({ error: message });
  }
});

router.get('/me/blocks', (req, res) => res.json({ users: storage.getBlockedUsers(req.user.id) }));

function blockUser(req, res) {
  const targetUserId = String(req.params.userId || req.body?.userId || req.body?.targetUserId || '').trim();
  if (!targetUserId) return res.status(400).json({ error: 'Engellenecek kullanıcı gerekli.' });
  if (targetUserId === req.user.id) return res.status(400).json({ error: 'Kendini engelleyemezsin.' });
  if (!storage.getUserById(targetUserId)) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

  const blocked = storage.blockUser(req.user.id, targetUserId);
  if (!blocked) return res.status(400).json({ error: 'Kullanıcı engellenemedi.' });
  emitSocialUpdate(req, [req.user.id, targetUserId]);
  req.app.get('io')?.to(`user:${req.user.id}`).emit('blocks:changed', { userId: req.user.id });
  return res.status(201).json({ blockedUser: blocked.user, blockedAt: blocked.createdAt });
}

router.post('/me/blocks', blockUser);
router.post('/me/blocks/:userId', blockUser);

router.delete('/me/blocks/:userId', (req, res) => {
  const targetUserId = String(req.params.userId || '').trim();
  const removed = storage.unblockUser(req.user.id, targetUserId);
  if (!removed) return res.status(404).json({ error: 'Bu kullanıcı engellenenler listesinde değil.' });
  req.app.get('io')?.to(`user:${req.user.id}`).emit('blocks:changed', { userId: req.user.id });
  return res.json({ success: true });
});

module.exports = router;
