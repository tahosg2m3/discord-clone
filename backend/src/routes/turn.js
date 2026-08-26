const crypto = require('crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');

const { requireAuth } = require('../middleware/auth');
const { createRateLimitOptions } = require('../middleware/rateLimit');

const router = express.Router();
const credentialsRateLimit = rateLimit(createRateLimitOptions('external', 'turn-credentials'));

function normalizePort(value, fallback) {
  const port = Number(value || fallback);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
}

function normalizeHost(value) {
  const host = String(value || '').trim().toLowerCase();
  if (!host || host.length > 253) return null;
  if (!/^[a-z0-9.-]+$/.test(host) || host.startsWith('.') || host.endsWith('.')) return null;
  return host;
}

router.get('/', credentialsRateLimit, requireAuth, (req, res) => {
  const secret = String(process.env.TURN_SECRET || '').trim();
  const host = normalizeHost(process.env.TURN_HOST);

  if (!host || secret.length < 32) {
    return res.status(503).json({
      error: 'TURN servisi henüz yapılandırılmamış.',
      code: 'TURN_NOT_CONFIGURED',
    });
  }

  const port = normalizePort(process.env.TURN_PORT, 3478);
  const requestedTtl = Number(process.env.TURN_CREDENTIAL_TTL_SECONDS || 3600);
  const ttlSeconds = Number.isFinite(requestedTtl)
    ? Math.min(Math.max(Math.trunc(requestedTtl), 300), 86400)
    : 3600;
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + ttlSeconds;
  const encodedUserId = Buffer.from(String(req.user.id), 'utf8').toString('base64url').slice(0, 80);
  const username = `${expiresAtSeconds}:${encodedUserId}`;
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');

  const urls = [
    `turn:${host}:${port}?transport=udp`,
    `turn:${host}:${port}?transport=tcp`,
  ];
  const tlsPort = Number(process.env.TURN_TLS_PORT || 0);
  if (Number.isInteger(tlsPort) && tlsPort > 0 && tlsPort <= 65535) {
    urls.push(`turns:${host}:${tlsPort}?transport=tcp`);
  }

  res.set('Cache-Control', 'no-store');
  return res.json({
    iceServers: [
      { urls: [`stun:${host}:${port}`] },
      { urls, username, credential },
    ],
    expiresAt: expiresAtSeconds * 1000,
  });
});

module.exports = router;
