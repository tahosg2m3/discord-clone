const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const storage = require('../storage/inMemory');
const {
  sendTwoFactorCode,
  sendPasswordResetCode,
  sendEmailChangeCode,
} = require('../services/emailService');
const { requireAuth, signAuthToken } = require('../middleware/auth');

const router = express.Router();

const pendingTwoFactorLogins = new Map();
const pendingPasswordResets = new Map();
const pendingEmailChanges = new Map();

const CODE_EXPIRES_IN_MS = 10 * 60 * 1000;
const RESEND_WAIT_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 12;

function publicUser(user) {
  const { password, tokenVersion, ...safeUser } = user;
  return safeUser;
}

function publicProfile(user) {
  const { password, email, tokenVersion, ...safeUser } = user;
  return safeUser;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function createSixDigitCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function isCodeCorrect(receivedCode, storedCodeHash) {
  const receivedHash = Buffer.from(hashCode(receivedCode), 'hex');
  const storedHash = Buffer.from(storedCodeHash, 'hex');

  return receivedHash.length === storedHash.length
    && crypto.timingSafeEqual(receivedHash, storedHash);
}

function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

function isValidPassword(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function emailDeliveryErrorMessage(error, fallback) {
  return error?.code === 'SMTP_CONFIG_ERROR' ? error.message : fallback;
}

function findUserByEmail(email) {
  return storage.getUserByEmail(normalizeEmail(email));
}

async function checkPasswordAndMigrate(user, password) {
  if (!user || typeof password !== 'string') return false;

  let valid = false;
  if (isBcryptHash(user.password)) {
    valid = await bcrypt.compare(password, user.password);
  } else {
    const expected = Buffer.from(String(user.password || ''));
    const supplied = Buffer.from(password);
    valid = expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);

    // Eski düz metin şifreler başarılı ilk girişte otomatik olarak bcrypt'e taşınır.
    if (valid) {
      storage.updateUserPassword(user.id, await bcrypt.hash(password, BCRYPT_ROUNDS), {
        invalidateSessions: false,
      });
    }
  }

  return valid;
}

function createPendingCode(map, userId, extra = {}) {
  const code = createSixDigitCode();
  const ticket = uuidv4();
  map.set(ticket, {
    userId,
    codeHash: hashCode(code),
    expiresAt: Date.now() + CODE_EXPIRES_IN_MS,
    lastSentAt: Date.now(),
    attempts: 0,
    ...extra,
  });
  return { ticket, code };
}

function findPendingRegistration({ username, email }) {
  for (const [ticket, pending] of pendingTwoFactorLogins.entries()) {
    if (Date.now() > pending.expiresAt) {
      pendingTwoFactorLogins.delete(ticket);
      continue;
    }

    const registration = pending.registration;
    if (!registration) continue;

    if (
      registration.email === email
      || registration.username.toLowerCase() === username.toLowerCase()
    ) {
      return { ticket, pending };
    }
  }

  return null;
}

function validatePendingCode(map, ticket, code) {
  const pending = map.get(ticket);
  if (!pending) return { error: 'Doğrulama oturumu bulunamadı. Yeniden dene.', status: 400 };

  if (Date.now() > pending.expiresAt) {
    map.delete(ticket);
    return { error: 'Kodun süresi doldu. İşlemi yeniden başlat.', status: 400 };
  }

  if (pending.attempts >= MAX_CODE_ATTEMPTS) {
    map.delete(ticket);
    return { error: 'Çok fazla yanlış deneme yaptın. İşlemi yeniden başlat.', status: 429 };
  }

  if (!/^\d{6}$/.test(code) || !isCodeCorrect(code, pending.codeHash)) {
    pending.attempts += 1;
    return {
      error: `Kod hatalı. Kalan hakkın: ${Math.max(0, MAX_CODE_ATTEMPTS - pending.attempts)}`,
      status: 400,
    };
  }

  return { pending };
}

async function sendLoginCode(user) {
  const { ticket, code } = createPendingCode(pendingTwoFactorLogins, user.id);
  try {
    await sendTwoFactorCode(user.email, user.username, code);
    return ticket;
  } catch (error) {
    pendingTwoFactorLogins.delete(ticket);
    throw error;
  }
}

async function sendRegistrationCode({ username, email, passwordHash }) {
  const existing = findPendingRegistration({ username, email });
  if (existing) {
    const registration = existing.pending.registration;
    if (registration.email === email && registration.username.toLowerCase() === username.toLowerCase()) {
      return { ticket: existing.ticket, reused: true };
    }

    const error = new Error('Bu kullanıcı adı veya e-posta adresi için doğrulanmayı bekleyen bir kayıt var.');
    error.code = 'PENDING_REGISTRATION_EXISTS';
    throw error;
  }

  const { ticket, code } = createPendingCode(pendingTwoFactorLogins, null, {
    registration: { username, email, passwordHash },
  });

  try {
    await sendTwoFactorCode(email, username, code);
    return { ticket, reused: false };
  } catch (error) {
    pendingTwoFactorLogins.delete(ticket);
    throw error;
  }
}

async function resendPendingCode(map, ticket, sendCode, resolveRecipient = pending => storage.getUserById(pending.userId)) {
  const pending = map.get(ticket);
  if (!pending) return { error: 'Doğrulama oturumu bulunamadı. Yeniden dene.', status: 400 };
  if (Date.now() > pending.expiresAt) {
    map.delete(ticket);
    return { error: 'Kodun süresi doldu. İşlemi yeniden başlat.', status: 400 };
  }

  const remainingWait = RESEND_WAIT_MS - (Date.now() - pending.lastSentAt);
  if (remainingWait > 0) {
    return { error: `Yeni kod için ${Math.ceil(remainingWait / 1000)} saniye bekle.`, status: 429 };
  }

  const recipient = resolveRecipient(pending);
  if (!recipient) {
    map.delete(ticket);
    return { error: 'Kullanıcı bulunamadı.', status: 404 };
  }

  const code = createSixDigitCode();
  const previousLastSentAt = pending.lastSentAt;
  // Start the resend cooldown immediately so concurrent requests cannot flood
  // the recipient, but retain the old working code if the SMTP call fails.
  pending.lastSentAt = Date.now();
  try {
    await sendCode(recipient, code, pending);
  } catch (error) {
    pending.lastSentAt = previousLastSentAt;
    throw error;
  }

  pending.codeHash = hashCode(code);
  pending.expiresAt = Date.now() + CODE_EXPIRES_IN_MS;
  pending.attempts = 0;
  return { pending };
}

router.post('/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (username.length < 2 || username.length > 50 || !isValidEmail(email) || !isValidPassword(password)) {
      return res.status(400).json({
        error: 'Geçerli bir kullanıcı adı, e-posta ve en az 8 karakterlik şifre zorunludur.',
      });
    }

    if (storage.getUserByUsername(username) || storage.getUserByEmail(email)) {
      return res.status(409).json({ error: 'Bu kullanıcı adı veya e-posta adresi zaten kullanımda.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    // SMTP teslimi başarısız olursa kullanıcı/veri üyeliği oluşmaz. Hesap yalnızca
    // e-postadaki kod doğrulandığında kalıcı olarak oluşturulur.
    const registrationResult = await sendRegistrationCode({ username, email, passwordHash });
    const loginTicket = registrationResult.ticket;

    return res.status(201).json({
      requiresTwoFactor: true,
      loginTicket,
      message: 'Kayıt başarılı. Doğrulama kodu e-posta adresine gönderildi.',
    });
  } catch (error) {
    console.error('Kayıt doğrulama hatası:', error.message);
    return res.status(503).json({
      error: emailDeliveryErrorMessage(error, 'Kayıt doğrulama e-postası gönderilemedi. SMTP ayarlarını kontrol edip yeniden dene.'),
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const user = findUserByEmail(email);

    if (!user || !(await checkPasswordAndMigrate(user, password))) {
      return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
    }

    const loginTicket = await sendLoginCode(storage.getUserById(user.id));
    return res.json({
      requiresTwoFactor: true,
      loginTicket,
      message: 'Doğrulama kodu e-posta adresine gönderildi.',
    });
  } catch (error) {
    console.error('Giriş doğrulama hatası:', error.message);
    return res.status(503).json({
      error: emailDeliveryErrorMessage(error, 'Doğrulama e-postası gönderilemedi. SMTP ayarlarını kontrol et.'),
    });
  }
});

router.post('/verify-2fa', (req, res) => {
  const loginTicket = String(req.body.loginTicket || '');
  const code = String(req.body.code || '').trim();
  const result = validatePendingCode(pendingTwoFactorLogins, loginTicket, code);

  if (result.error) return res.status(result.status).json({ error: result.error });

  let user;
  if (result.pending.registration) {
    const registration = result.pending.registration;
    try {
      user = storage.createUserWithAuth({
        username: registration.username,
        email: registration.email,
        password: registration.passwordHash,
      });
    } catch (error) {
      pendingTwoFactorLogins.delete(loginTicket);
      return res.status(409).json({
        error: 'Bu kullanıcı adı veya e-posta adresi doğrulama sırasında başka bir hesap tarafından kullanıldı. Lütfen tekrar kayıt ol.',
      });
    }
  } else {
    user = storage.getUserById(result.pending.userId);
  }
  pendingTwoFactorLogins.delete(loginTicket);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

  return res.json({ user: publicUser(user), token: signAuthToken(user) });
});

router.post('/resend-2fa', async (req, res) => {
  try {
    const loginTicket = String(req.body.loginTicket || '');
    const result = await resendPendingCode(
      pendingTwoFactorLogins,
      loginTicket,
      (user, code) => sendTwoFactorCode(user.email, user.username, code),
      pending => pending.registration || storage.getUserById(pending.userId),
    );
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.json({ message: 'Yeni doğrulama kodu e-posta adresine gönderildi.' });
  } catch (error) {
    console.error('Kod tekrar gönderilemedi:', error.message);
    return res.status(503).json({ error: emailDeliveryErrorMessage(error, 'Yeni kod gönderilemedi.') });
  }
});

// E-posta adresinin varlığı hakkında bilgi sızdırmamak için her zaman aynı mesaj döner.
router.post('/request-password-reset', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = findUserByEmail(email);
  let resetTicket = null;

  try {
    if (user) {
      const created = createPendingCode(pendingPasswordResets, user.id);
      resetTicket = created.ticket;
      await sendPasswordResetCode(user.email, user.username, created.code);
    }
  } catch (error) {
    if (resetTicket) pendingPasswordResets.delete(resetTicket);
    console.error('Şifre sıfırlama e-postası gönderilemedi:', error.message);
  }

  return res.json({
    message: 'Bu e-posta hesabı kayıtlıysa şifre sıfırlama kodu gönderildi.',
    ...(resetTicket ? { resetTicket } : {}),
  });
});

router.post('/resend-password-reset', async (req, res) => {
  try {
    const resetTicket = String(req.body.resetTicket || '');
    const result = await resendPendingCode(pendingPasswordResets, resetTicket, (user, code) => (
      sendPasswordResetCode(user.email, user.username, code)
    ));
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.json({ message: 'Yeni şifre sıfırlama kodu e-posta adresine gönderildi.' });
  } catch (error) {
    console.error('Şifre sıfırlama kodu tekrar gönderilemedi:', error.message);
    return res.status(503).json({ error: emailDeliveryErrorMessage(error, 'Yeni kod gönderilemedi.') });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const resetTicket = String(req.body.resetTicket || '');
    const code = String(req.body.code || '').trim();
    const newPassword = String(req.body.newPassword || '');
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ error: 'Yeni şifre en az 8, en fazla 128 karakter olmalıdır.' });
    }

    const result = validatePendingCode(pendingPasswordResets, resetTicket, code);
    if (result.error) return res.status(result.status).json({ error: result.error });

    const user = storage.getUserById(result.pending.userId);
    if (!user) {
      pendingPasswordResets.delete(resetTicket);
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    storage.updateUserPassword(user.id, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
    pendingPasswordResets.delete(resetTicket);
    return res.json({ message: 'Şifren güncellendi. Güvenlik için yeniden giriş yap.' });
  } catch (error) {
    console.error('Şifre sıfırlama hatası:', error.message);
    return res.status(500).json({ error: 'Şifre güncellenemedi.' });
  }
});

router.post('/request-email-change', requireAuth, async (req, res) => {
  try {
    const newEmail = normalizeEmail(req.body.newEmail);
    const currentPassword = String(req.body.currentPassword || '');

    if (!isValidEmail(newEmail)) return res.status(400).json({ error: 'Geçerli bir e-posta adresi gir.' });
    if (newEmail === normalizeEmail(req.user.email)) return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanımda.' });
    if (storage.getUserByEmail(newEmail)) return res.status(409).json({ error: 'Bu e-posta adresi başka bir hesapta kullanılıyor.' });
    if (!(await checkPasswordAndMigrate(req.user, currentPassword))) {
      return res.status(401).json({ error: 'Mevcut şifren hatalı.' });
    }

    const created = createPendingCode(pendingEmailChanges, req.user.id, { newEmail });
    try {
      await sendEmailChangeCode(newEmail, req.user.username, created.code);
    } catch (error) {
      pendingEmailChanges.delete(created.ticket);
      throw error;
    }

    return res.json({
      emailChangeTicket: created.ticket,
      message: 'Doğrulama kodu yeni e-posta adresine gönderildi.',
    });
  } catch (error) {
    console.error('E-posta değişikliği doğrulaması gönderilemedi:', error.message);
    return res.status(503).json({ error: emailDeliveryErrorMessage(error, 'Doğrulama e-postası gönderilemedi.') });
  }
});

router.post('/resend-email-change', requireAuth, async (req, res) => {
  try {
    const emailChangeTicket = String(req.body.emailChangeTicket || '');
    const pending = pendingEmailChanges.get(emailChangeTicket);
    if (!pending || pending.userId !== req.user.id) {
      return res.status(400).json({ error: 'Doğrulama oturumu bulunamadı. İşlemi yeniden başlat.' });
    }

    const result = await resendPendingCode(pendingEmailChanges, emailChangeTicket, (user, code, current) => (
      sendEmailChangeCode(current.newEmail, user.username, code)
    ));
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.json({ message: 'Yeni doğrulama kodu yeni e-posta adresine gönderildi.' });
  } catch (error) {
    console.error('E-posta değişikliği kodu tekrar gönderilemedi:', error.message);
    return res.status(503).json({ error: emailDeliveryErrorMessage(error, 'Yeni kod gönderilemedi.') });
  }
});

router.post('/confirm-email-change', requireAuth, (req, res) => {
  const emailChangeTicket = String(req.body.emailChangeTicket || '');
  const code = String(req.body.code || '').trim();
  const pending = pendingEmailChanges.get(emailChangeTicket);

  if (!pending || pending.userId !== req.user.id) {
    return res.status(400).json({ error: 'Doğrulama oturumu bulunamadı. İşlemi yeniden başlat.' });
  }

  const result = validatePendingCode(pendingEmailChanges, emailChangeTicket, code);
  if (result.error) return res.status(result.status).json({ error: result.error });

  if (storage.getUserByEmail(result.pending.newEmail)) {
    pendingEmailChanges.delete(emailChangeTicket);
    return res.status(409).json({ error: 'Bu e-posta adresi artık başka bir hesapta kullanılıyor.' });
  }

  const user = storage.updateUserEmail(req.user.id, result.pending.newEmail);
  pendingEmailChanges.delete(emailChangeTicket);
  if (!user) return res.status(400).json({ error: 'E-posta adresi güncellenemedi.' });
  return res.json({ user: publicUser(user), message: 'E-posta adresin güncellendi.' });
});

router.get('/verify', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.get('/:id', requireAuth, (req, res) => {
  const user = storage.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  return res.json(req.params.id === req.user.id ? publicUser(user) : publicProfile(user));
});

router.put('/:id', requireAuth, (req, res) => {
  if (req.params.id !== req.user.id) return res.status(403).json({ error: 'Başka bir kullanıcının profilini değiştiremezsin.' });

  try {
    const user = storage.updateUserProfile(req.user.id, {
      username: req.body.username,
      avatar: req.body.avatar,
    });
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    return res.json(publicUser(user));
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Profil güncellenemedi.' });
  }
});

module.exports = router;
