const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

let runtimeEnvLoaded = false;

function loadRuntimeEmailConfig() {
  if (runtimeEnvLoaded) return;
  runtimeEnvLoaded = true;

  // Paketli uygulamada sırlar kaynak dizininde tutulmamalı. İstenirse işletim
  // sistemi tarafından sağlanan bu yol üzerinden harici bir dotenv dosyası okunur.
  const runtimeEnvFile = process.env.RUNTIME_ENV_FILE || process.env.SMTP_ENV_FILE;
  if (runtimeEnvFile) dotenv.config({ path: runtimeEnvFile, override: false });
}

function configurationError(message) {
  const error = new Error(message);
  error.code = 'SMTP_CONFIG_ERROR';
  return error;
}

function getSmtpSecure(port) {
  const configuredValue = process.env.SMTP_SECURE;
  if (configuredValue === undefined || configuredValue === '') {
    // SMTP'nin 465 portundaki TLS bağlantısı varsayılan olarak güvenlidir.
    return port === 465;
  }

  const value = String(configuredValue).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(value)) return true;
  if (['false', '0', 'no'].includes(value)) return false;
  throw configurationError('SMTP_SECURE yalnızca true veya false olabilir.');
}

function createTransporter() {
  loadRuntimeEmailConfig();

  const missing = ['SMTP_USER', 'SMTP_PASS'].filter(key => !String(process.env[key] || '').trim());
  if (missing.length) {
    throw configurationError(`SMTP yapılandırması eksik: ${missing.join(', ')} tanımlanmalı.`);
  }

  const port = Number(process.env.SMTP_PORT || 465);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw configurationError('SMTP_PORT 1 ile 65535 arasında geçerli bir sayı olmalıdır.');
  }

  const host = String(process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const secure = getSmtpSecure(port);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    // Submission ports must upgrade with STARTTLS; do not silently fall back
    // to clear text if a network attacker strips the server capability.
    requireTLS: !secure,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    tls: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[character]));
}

async function sendSecurityCode(email, username, code, { subject, heading, description }) {
  const transporter = createTransporter();
  const safeUsername = escapeHtml(username);

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    text: `Merhaba ${username},\n\n${description}\n\nKodun: ${code}\n\nBu kod 10 dakika geçerlidir. Bu işlemi sen başlatmadıysan bu e-postayı görmezden gelebilirsin.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#1f2937">
        <h2>${heading}</h2>
        <p>Merhaba <strong>${safeUsername}</strong>,</p>
        <p>${description}</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f3f4f6;padding:18px;text-align:center;border-radius:8px;color:#111827">
          ${code}
        </div>
        <p>Bu kod <strong>10 dakika</strong> geçerlidir.</p>
        <p style="color:#6b7280;font-size:13px">Bu işlemi sen başlatmadıysan bu e-postayı görmezden gelebilirsin.</p>
      </div>
    `,
  });
}

function sendTwoFactorCode(email, username, code) {
  return sendSecurityCode(email, username, code, {
    subject: 'tahosapp giriş doğrulama kodun',
    heading: 'Giriş doğrulaması',
    description: 'tahosapp hesabına giriş için doğrulama kodun:',
  });
}

function sendPasswordResetCode(email, username, code) {
  return sendSecurityCode(email, username, code, {
    subject: 'tahosapp şifre sıfırlama kodun',
    heading: 'Şifre sıfırlama',
    description: 'Şifreni sıfırlamak için doğrulama kodun:',
  });
}

function sendEmailChangeCode(email, username, code) {
  return sendSecurityCode(email, username, code, {
    subject: 'tahosapp e-posta değişikliği kodun',
    heading: 'E-posta değişikliğini onayla',
    description: 'Bu e-posta adresini hesabına bağlamak için doğrulama kodun:',
  });
}

module.exports = {
  createTransporter,
  sendTwoFactorCode,
  sendPasswordResetCode,
  sendEmailChangeCode,
};
