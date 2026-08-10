const express = require('express');

const storage = require('../storage/inMemory');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// Eski kullanıcı adıyla şifresiz giriş endpoint'i güvenlik nedeniyle kaldırıldı.
router.post('/login', (req, res) => res.status(410).json({
  error: 'Bu giriş yöntemi kaldırıldı. E-posta ve iki aşamalı doğrulama kullan.',
}));

router.get('/', (req, res) => res.json(storage.getPublicUsers()));

module.exports = router;
