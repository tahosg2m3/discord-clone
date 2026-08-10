const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const storage = require('../storage/inMemory');

const JWT_ISSUER = 'discord-clone';
const JWT_AUDIENCE = 'discord-clone-client';
const DEVELOPMENT_FALLBACK_SECRET = 'discord-clone-development-secret-change-me-before-production';

let warnedAboutFallbackSecret = false;

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  // Paketlenmiş Electron uygulamasında .env dağıtıma dahil edilmez. APP_DATA_DIR
  // altında bir kez üretilen gizli anahtar, uygulama güncellense bile oturumları korur.
  if (process.env.APP_DATA_DIR) {
    const secretPath = path.join(path.resolve(process.env.APP_DATA_DIR), 'jwt-secret');
    try {
      if (fs.existsSync(secretPath)) {
        const existingSecret = fs.readFileSync(secretPath, 'utf8').trim();
        if (existingSecret.length >= 64) return existingSecret;
      }

      fs.mkdirSync(path.dirname(secretPath), { recursive: true });
      const generatedSecret = crypto.randomBytes(64).toString('hex');
      fs.writeFileSync(secretPath, generatedSecret, { encoding: 'utf8', mode: 0o600 });
      return generatedSecret;
    } catch (error) {
      throw new Error('JWT_SECRET okunamadı ve uygulama veri klasöründe güvenli bir anahtar oluşturulamadı.');
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Production için JWT_SECRET veya APP_DATA_DIR zorunludur.');
  }

  if (!warnedAboutFallbackSecret) {
    warnedAboutFallbackSecret = true;
    console.warn('JWT_SECRET tanımlı değil. Production ortamında güçlü ve gizli bir JWT_SECRET ekleyin.');
  }

  return DEVELOPMENT_FALLBACK_SECRET;
}

function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      tokenVersion: user.tokenVersion || 0,
    },
    getJwtSecret(),
    {
      algorithm: 'HS256',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    },
  );
}

function getBearerToken(value) {
  if (typeof value !== 'string') return null;
  const [scheme, token] = value.trim().split(/\s+/);
  return scheme === 'Bearer' && token ? token : null;
}

function verifyAuthToken(token) {
  if (!token || typeof token !== 'string') {
    const error = new Error('Kimlik doğrulama bilgisi gerekli.');
    error.code = 'AUTH_REQUIRED';
    throw error;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    const user = storage.getUserById(payload.sub);

    if (!user || (payload.tokenVersion || 0) !== (user.tokenVersion || 0)) {
      const error = new Error('Oturum artık geçerli değil.');
      error.code = 'AUTH_INVALID';
      throw error;
    }

    return { payload, user };
  } catch (error) {
    if (!error.code) error.code = 'AUTH_INVALID';
    throw error;
  }
}

function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req.headers.authorization);
    const { payload, user } = verifyAuthToken(token);
    req.auth = payload;
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş. Lütfen tekrar giriş yap.' });
  }
}

module.exports = {
  getBearerToken,
  signAuthToken,
  verifyAuthToken,
  requireAuth,
};
