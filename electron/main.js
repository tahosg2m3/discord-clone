const {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  safeStorage,
  session,
  shell,
  utilityProcess,
} = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { AutomaticPresenceDetector } = require('./automaticPresence');

// Electron ana süreci için oluşturulabilecek Node tanı raporlarının ortam
// değişkenlerini (örneğin harici DATA_ENCRYPTION_KEY) içermesine izin verme.
try {
  if (process.report && 'excludeEnv' in process.report) process.report.excludeEnv = true;
} catch (_) {
  // Bazı eski Electron/Node sürümlerinde bu özellik salt okunur olabilir.
}

// Do not trust an ambient NODE_ENV in an installed application: a machine-wide
// development value must never make a packaged build load localhost content.
const isDev = !app.isPackaged;
// Ürün adı tahosapp olarak değiştiğinde mevcut kurulumların şifreli yerel
// verilerini kaybetme. Eski veri klasörü varsa ve yeni klasör henüz yoksa
// yalnız o kurulum için eski güvenli konumu kullan; temiz kurulumlar tahosapp
// klasörünü kullanır.
if (!isDev) {
  const appDataPath = app.getPath('appData');
  const currentUserDataPath = app.getPath('userData');
  const legacyUserDataPath = path.join(appDataPath, 'Discord Clone');
  if (!fs.existsSync(currentUserDataPath) && fs.existsSync(legacyUserDataPath)) {
    app.setPath('userData', legacyUserDataPath);
  }
}
const APP_SCHEME = 'discord-clone';
const APP_HOST = 'app';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const APP_ENTRY_URL = `${APP_ORIGIN}/index.html`;
const RENDERER_ROOT = path.resolve(__dirname, '../frontend/dist');
const DEPLOYMENT_CONFIG_PATH = path.resolve(__dirname, '../deployment/app-config.json');
const BACKEND_PORT = '3001';
const PEER_PORT = '9000';
const SHUTDOWN_MESSAGE = 'discord-clone:shutdown';
const PROTECTED_DATA_KEY_FILE = 'data-encryption-key.safe';
const DATA_MIGRATION_MARKER_FILE = 'data-encryption-migration.json';
const ENCRYPTED_STATE_MAGIC = Buffer.from('discord-clone-encrypted-state', 'utf8');
const BACKEND_PLATFORM_ENV_KEYS = Object.freeze([
  // Node/native modüllerin temel süreç ve geçici klasör ihtiyaçları. Uygulama
  // sırları (SMTP/JWT/GIPHY vb.) burada yoktur; yalnız runtime.env'den okunur.
  'PATH',
  'SystemRoot',
  'WINDIR',
  'ComSpec',
  'PATHEXT',
  'TEMP',
  'TMP',
  'TMPDIR',
  'HOME',
  'USERPROFILE',
  'LOCALAPPDATA',
  'APPDATA',
  'PROGRAMDATA',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TZ',
]);

function requireCleanUrl(value, label, { secureOnly = false } = {}) {
  let parsed;
  try {
    parsed = new URL(String(value || ''));
  } catch (_) {
    throw new Error(`${label} geçerli bir URL değil.`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${label} kullanıcı bilgisi, sorgu veya parça içeremez.`);
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error(`${label} yalnızca origin içermeli; yol eklenmemeli.`);
  }
  if (secureOnly && parsed.protocol !== 'https:') {
    throw new Error(`${label} uzak modda https:// ile başlamalı.`);
  }
  if (!secureOnly && !['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${label} http:// veya https:// ile başlamalı.`);
  }
  return parsed.origin;
}

function loadDeploymentConfig() {
  let source;
  try {
    source = JSON.parse(fs.readFileSync(DEPLOYMENT_CONFIG_PATH, 'utf8'));
  } catch (error) {
    throw new Error(`Dağıtım yapılandırması okunamadı: ${error.message}`);
  }

  const mode = String(source?.mode || '').trim().toLowerCase();
  if (!['local', 'remote'].includes(mode)) {
    throw new Error('deployment/app-config.json içindeki mode local veya remote olmalı.');
  }

  if (mode === 'local') {
    return Object.freeze({
      mode,
      apiOrigin: `http://127.0.0.1:${BACKEND_PORT}`,
      socketUrl: `http://127.0.0.1:${BACKEND_PORT}`,
      peerHost: '127.0.0.1',
      peerPort: Number(PEER_PORT),
      peerPath: '/peerjs',
      peerSecure: false,
      startsBundledBackend: true,
    });
  }

  const apiOrigin = requireCleanUrl(source.apiOrigin, 'apiOrigin', { secureOnly: true });
  const socketUrl = requireCleanUrl(source.socketUrl || source.apiOrigin, 'socketUrl', { secureOnly: true });
  const peerHost = String(source.peerHost || '').trim().toLowerCase();
  if (!peerHost || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(peerHost)) {
    throw new Error('peerHost yalnızca geçerli bir alan adı olmalı.');
  }
  const peerPort = Number(source.peerPort ?? 443);
  if (!Number.isInteger(peerPort) || peerPort < 1 || peerPort > 65535) {
    throw new Error('peerPort 1 ile 65535 arasında olmalı.');
  }
  const peerPath = String(source.peerPath || '/peerjs').trim();
  if (!/^\/[A-Za-z0-9/_-]*$/.test(peerPath) || peerPath.includes('..')) {
    throw new Error('peerPath / ile başlayan güvenli bir yol olmalı.');
  }
  if (source.peerSecure !== true) {
    throw new Error('Uzak modda peerSecure true olmalı.');
  }

  return Object.freeze({
    mode,
    apiOrigin,
    socketUrl,
    peerHost,
    peerPort,
    peerPath,
    peerSecure: true,
    startsBundledBackend: false,
  });
}

const DEPLOYMENT_CONFIG = loadDeploymentConfig();
const RENDERER_RUNTIME_CONFIG = Object.freeze({
  mode: DEPLOYMENT_CONFIG.mode,
  apiOrigin: DEPLOYMENT_CONFIG.apiOrigin,
  apiUrl: `${DEPLOYMENT_CONFIG.apiOrigin}/api`,
  socketUrl: DEPLOYMENT_CONFIG.socketUrl,
  peerHost: DEPLOYMENT_CONFIG.peerHost,
  peerPort: DEPLOYMENT_CONFIG.peerPort,
  peerPath: DEPLOYMENT_CONFIG.peerPath,
  peerSecure: DEPLOYMENT_CONFIG.peerSecure,
});

function websocketOrigin(httpOrigin) {
  const parsed = new URL(httpOrigin);
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  return parsed.origin;
}

function buildProductionCsp() {
  const peerHttpOrigin = `${DEPLOYMENT_CONFIG.peerSecure ? 'https' : 'http'}://${DEPLOYMENT_CONFIG.peerHost}:${DEPLOYMENT_CONFIG.peerPort}`;
  const connectSources = new Set([
    "'self'",
    DEPLOYMENT_CONFIG.apiOrigin,
    DEPLOYMENT_CONFIG.socketUrl,
    websocketOrigin(DEPLOYMENT_CONFIG.socketUrl),
    peerHttpOrigin,
    websocketOrigin(peerHttpOrigin),
  ]);

  return [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https: ${DEPLOYMENT_CONFIG.apiOrigin}`,
  `media-src 'self' blob: https: ${DEPLOYMENT_CONFIG.apiOrigin}`,
  "font-src 'self' data:",
  `connect-src ${[...connectSources].join(' ')}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-src 'none'",
  ].join('; ');
}

const PRODUCTION_CSP = buildProductionCsp();

// This must run before app.ready. The custom standard/secure protocol avoids
// granting the renderer the broad privileges of file:// pages.
protocol.registerSchemesAsPrivileged([{
  scheme: APP_SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
  },
}]);

let mainWindow;
let backendProcess;
let backendInstanceToken;
let isQuitting = false;
let automaticPresenceDetector;
let latestAutomaticPresence = [];

function parseUrl(value) {
  try {
    return new URL(String(value || ''));
  } catch (_) {
    return null;
  }
}

function isTrustedRendererOrigin(value) {
  const parsed = parseUrl(value);
  if (!parsed || parsed.username || parsed.password) return false;

  if (isDev) {
    return parsed.protocol === 'http:'
      && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
      && parsed.port === '5173';
  }

  return parsed.protocol === `${APP_SCHEME}:`
    && parsed.hostname === APP_HOST
    && !parsed.port;
}

function isTrustedTopLevelUrl(value) {
  const parsed = parseUrl(value);
  if (!parsed || !isTrustedRendererOrigin(value)) return false;
  if (isDev) return true;
  return parsed.pathname === '/' || parsed.pathname === '/index.html';
}

function isTrustedAppWebContents(webContents, requestingOrigin = '') {
  if (!mainWindow?.webContents || !webContents || webContents.id !== mainWindow.webContents.id) return false;
  if (!isTrustedTopLevelUrl(webContents.getURL())) return false;
  return !requestingOrigin || isTrustedRendererOrigin(requestingOrigin);
}

function isTrustedAppFrame(frame, requestingOrigin = '') {
  const mainFrame = mainWindow?.webContents?.mainFrame;
  if (!frame || !mainFrame || frame.processId !== mainFrame.processId || frame.routingId !== mainFrame.routingId) return false;
  if (!isTrustedTopLevelUrl(frame.url)) return false;
  return !requestingOrigin || isTrustedRendererOrigin(requestingOrigin);
}

function getRendererFile(requestUrl) {
  const parsed = parseUrl(requestUrl);
  if (!parsed
    || parsed.protocol !== `${APP_SCHEME}:`
    || parsed.hostname !== APP_HOST
    || parsed.username
    || parsed.password
    || parsed.port) return null;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(parsed.pathname || '/');
  } catch (_) {
    return null;
  }

  if (decodedPath.includes('\0') || decodedPath.includes('\\')) return null;
  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const candidate = path.resolve(RENDERER_ROOT, relativePath);
  const relative = path.relative(RENDERER_ROOT, candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return relative === '' && path.basename(candidate) === 'index.html' ? candidate : null;
  }
  return candidate;
}

function registerProductionProtocol() {
  protocol.handle(APP_SCHEME, async request => {
    const filePath = getRendererFile(request.url);
    if (!filePath) return new Response('Not found', { status: 404 });

    try {
      const stats = await fs.promises.stat(filePath);
      if (!stats.isFile()) return new Response('Not found', { status: 404 });

      const fileResponse = await net.fetch(pathToFileURL(filePath).href);
      const headers = new Headers(fileResponse.headers);
      headers.set('X-Content-Type-Options', 'nosniff');
      if (path.extname(filePath).toLowerCase() === '.html') {
        headers.set('Content-Security-Policy', PRODUCTION_CSP);
        headers.set('Cache-Control', 'no-store');
      }

      return new Response(fileResponse.body, {
        status: fileResponse.status,
        statusText: fileResponse.statusText,
        headers,
      });
    } catch (_) {
      return new Response('Not found', { status: 404 });
    }
  });
}

function getExternalUrl(value) {
  if (typeof value !== 'string' || value.length > 4096 || /[\r\n\0]/.test(value)) return null;
  const parsed = parseUrl(value);
  if (!parsed || !['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return null;
  if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && (parsed.username || parsed.password)) return null;
  return parsed.href;
}

function openExternalSafely(value) {
  const url = getExternalUrl(value);
  if (url) shell.openExternal(url).catch(() => {});
}

function prepareRuntimeEnvFile() {
  const configuredPath = process.env.RUNTIME_ENV_FILE || process.env.SMTP_ENV_FILE;
  const runtimeEnvFile = configuredPath
    ? path.resolve(configuredPath)
    : path.join(app.getPath('userData'), 'runtime.env');
  const exampleFile = `${runtimeEnvFile}.example`;
  const packagedTemplate = path.join(process.resourcesPath, 'backend', 'runtime.env.example');

  try {
    if (!fs.existsSync(runtimeEnvFile) && !fs.existsSync(exampleFile) && fs.existsSync(packagedTemplate)) {
      fs.mkdirSync(path.dirname(exampleFile), { recursive: true });
      fs.copyFileSync(packagedTemplate, exampleFile);
    }
  } catch (error) {
    console.warn('SMTP örnek yapılandırması oluşturulamadı:', error.message);
  }

  return runtimeEnvFile;
}

async function writeProtectedFileAtomic(targetPath, contents) {
  const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  let handle;
  try {
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    handle = await fs.promises.open(temporaryPath, 'wx', 0o600);
    await handle.writeFile(contents);
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.promises.rename(temporaryPath, targetPath);
    if (process.platform !== 'win32') await fs.promises.chmod(targetPath, 0o600);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fs.promises.unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

function fileContainsBytes(filePath, needle) {
  const descriptor = fs.openSync(filePath, 'r');
  const chunkSize = 64 * 1024;
  const buffer = Buffer.allocUnsafe(chunkSize + needle.length - 1);
  let overlap = 0;
  let position = 0;
  try {
    while (true) {
      const bytesRead = fs.readSync(descriptor, buffer, overlap, chunkSize, position);
      if (!bytesRead) return false;
      const available = overlap + bytesRead;
      if (buffer.subarray(0, available).includes(needle)) return true;
      overlap = Math.min(needle.length - 1, available);
      buffer.copy(buffer, 0, available - overlap, available);
      position += bytesRead;
    }
  } finally {
    fs.closeSync(descriptor);
  }
}

function inspectStateBeforeProtectedKeyCreation(dataDirectory) {
  let entries;
  try {
    entries = fs.readdirSync(dataDirectory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return { hasLegacyPlaintext: false };
    throw new Error(`Uygulama veri klasörü anahtar oluşturulmadan önce denetlenemedi: ${error.message}`);
  }

  const names = new Set(entries.map(entry => entry.name));
  const hasProtectedKeyResidue = entries.some(entry => (
    entry.name.startsWith(`${PROTECTED_DATA_KEY_FILE}.`) && entry.name.endsWith('.tmp')
  ));
  const hasMigrationMarker = names.has(DATA_MIGRATION_MARKER_FILE)
    || entries.some(entry => (
      entry.name.startsWith(`${DATA_MIGRATION_MARKER_FILE}.`) && entry.name.endsWith('.tmp')
    ));
  const hasRawKeyResidue = entries.some(entry => (
    /^(?:data-encryption\.key|data\.sqlite-key)(?:\..+\.tmp)?$/i.test(entry.name)
  ));

  if (hasProtectedKeyResidue || hasMigrationMarker || hasRawKeyResidue) {
    throw new Error(
      'İşletim sistemi korumalı veri anahtarı eksik, ancak önceki bir anahtar/migration kaydı mevcut. '
      + 'Yeni anahtar üretilmedi; doğru anahtarı veya uygulama veri yedeğini geri yükleyin.',
    );
  }

  const stateArtifacts = entries.filter(entry => (
    /^(?:data\.json(?:\..+\.tmp)?|(?:discord-clone|data)\.sqlite(?:-(?:wal|shm|journal)|\..+\.tmp)?|datayedek.*\.json(?:\..+\.tmp)?)$/i
      .test(entry.name)
  ));

  let hasLegacyPlaintext = false;
  for (const artifact of stateArtifacts) {
    if (!artifact.isFile()) {
      throw new Error(`Uygulama veri kalıntısı normal bir dosya değil (${artifact.name}); yeni anahtar üretilmedi.`);
    }
    const artifactPath = path.join(dataDirectory, artifact.name);
    const size = fs.statSync(artifactPath).size;
    if (!size) continue;
    if (fileContainsBytes(artifactPath, ENCRYPTED_STATE_MAGIC)) {
      throw new Error(
        'Şifreli uygulama verisi bulundu ancak işletim sistemi korumalı anahtarı eksik. '
        + 'Yeni anahtar üretilmedi; veri kurtarma için eski anahtarı geri yükleyin.',
      );
    }
    hasLegacyPlaintext = true;
  }

  return { hasLegacyPlaintext };
}

async function getPackagedDataEncryptionKey() {
  // Kurumsal/harici dağıtımlar kendi 32 baytlık anahtarlarını süreç ortamından
  // sağlayabilir. Bu durumda Electron anahtar dosyası oluşturmaz.
  if (process.env.DATA_ENCRYPTION_KEY) {
    return { key: process.env.DATA_ENCRYPTION_KEY, created: false, external: true };
  }

  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error('İşletim sistemi güvenli anahtar deposu kullanılamıyor. DATA_ENCRYPTION_KEY tanımlayın.');
  }
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
    throw new Error('Linux güvenli anahtar deposu basic_text modunda. DATA_ENCRYPTION_KEY harici ve güvenli biçimde tanımlanmalıdır.');
  }

  const protectedKeyPath = path.join(app.getPath('userData'), PROTECTED_DATA_KEY_FILE);
  if (fs.existsSync(protectedKeyPath)) {
    const encryptedKey = await fs.promises.readFile(protectedKeyPath);
    const decrypted = await safeStorage.decryptStringAsync(encryptedKey);
    const key = decrypted?.result;
    if (!key) throw new Error('İşletim sistemi korumalı veri anahtarı çözülemedi.');

    if (decrypted.shouldReEncrypt) {
      const rotated = await safeStorage.encryptStringAsync(key);
      await writeProtectedFileAtomic(protectedKeyPath, rotated);
    }
    return { key, created: false, external: false };
  }

  // Anahtar dosyasının silinmesini yeni kurulum sanmak şifreli veriyi kalıcı
  // olarak kilitler. Envelope kanıtı veya eski key/marker varsa fail-closed.
  inspectStateBeforeProtectedKeyCreation(app.getPath('userData'));
  const key = crypto.randomBytes(32).toString('base64url');
  const encryptedKey = await safeStorage.encryptStringAsync(key);
  await writeProtectedFileAtomic(protectedKeyPath, encryptedKey);
  return { key, created: true, external: false };
}

function createBackendEnvironment(runtimeEnvFile, dataEncryptionKey, allowPlaintextStateMigration = false) {
  const environment = {};
  BACKEND_PLATFORM_ENV_KEYS.forEach(key => {
    const value = process.env[key];
    if (typeof value === 'string' && value) environment[key] = value;
  });

  const backendEnvironment = {
    ...environment,
    PORT: BACKEND_PORT,
    PEER_PORT,
    HOST: '127.0.0.1',
    PEER_HOST: '127.0.0.1',
    CLIENT_URL: APP_ORIGIN,
    APP_DATA_DIR: app.getPath('userData'),
    RUNTIME_ENV_FILE: runtimeEnvFile,
    DATA_ENCRYPTION_KEY: dataEncryptionKey,
    DESKTOP_INSTANCE_TOKEN: backendInstanceToken,
    NODE_ENV: 'production',
  };
  if (allowPlaintextStateMigration) {
    backendEnvironment.ALLOW_PLAINTEXT_STATE_MIGRATION = 'true';
  }
  return backendEnvironment;
}

async function startPackagedBackend() {
  if (isDev || backendProcess || !DEPLOYMENT_CONFIG.startsBundledBackend) return;

  const backendRoot = path.join(process.resourcesPath, 'backend');
  const backendEntry = path.join(backendRoot, 'src', 'server.js');
  const runtimeEnvFile = prepareRuntimeEnvFile();
  backendInstanceToken = crypto.randomBytes(32).toString('hex');

  try {
    const dataKey = await getPackagedDataEncryptionKey();
    const explicitExternalMigration = dataKey.external
      && String(process.env.ALLOW_PLAINTEXT_STATE_MIGRATION || '').trim().toLowerCase() === 'true';
    // İlk safeStorage anahtarı, paketli eski plaintext kurulumu yalnız bir kez
    // taşıyabilsin. Harici anahtarda ise operatörün açık opt-in'i zorunludur.
    const allowPlaintextStateMigration = dataKey.created || explicitExternalMigration;
    const child = utilityProcess.fork(backendEntry, [], {
      cwd: backendRoot,
      env: createBackendEnvironment(
        runtimeEnvFile,
        dataKey.key,
        allowPlaintextStateMigration,
      ),
      stdio: 'inherit',
      serviceName: 'tahosapp Backend',
    });
    if (dataKey.external) delete process.env.DATA_ENCRYPTION_KEY;
    delete process.env.ALLOW_PLAINTEXT_STATE_MIGRATION;
    backendProcess = child;

    child.on('error', (type, location) => {
      // Electron'un üçüncü argümanı tam Node diagnostic report'tur ve child
      // environment içindeki veri anahtarını/sırları barındırabilir. Asla loglama.
      const incidentId = crypto.randomUUID();
      const safeType = String(type || 'Unknown').replace(/[\r\n\t]/g, ' ').slice(0, 80);
      const safeLocation = String(location || 'unknown').replace(/[\r\n\t]/g, ' ').slice(0, 240);
      console.error(`Backend utility process error [${incidentId}] type=${safeType} location=${safeLocation}`);
    });
    child.on('exit', code => {
      if (backendProcess === child) {
        backendProcess = null;
        backendInstanceToken = null;
      }
      if (!isQuitting && code !== 0) {
        console.error(`Backend process exited with code ${code}.`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          dialog.showErrorBox(
            'Yerel servis durdu',
            'Uygulamanın yerel servisi beklenmedik biçimde kapandı. Verilerin zarar görmemesi için uygulama kapatılacak.',
          );
          app.quit();
        }
      }
    });
  } catch (error) {
    backendProcess = null;
    backendInstanceToken = null;
    console.error('Backend process could not be started:', error);
    throw error;
  }
}

async function waitForPackagedBackend(timeoutMs = 8_000) {
  if (isDev || !DEPLOYMENT_CONFIG.startsBundledBackend) return true;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline && backendProcess) {
    const requestController = new AbortController();
    const requestTimeout = setTimeout(() => requestController.abort(), 750);
    requestTimeout.unref();

    try {
      const response = await net.fetch(`http://127.0.0.1:${BACKEND_PORT}/health`, {
        bypassCustomProtocolHandlers: true,
        signal: requestController.signal,
      });
      if (response.ok
        && response.headers.get('x-discord-clone-instance') === backendInstanceToken) return true;
    } catch (_) {
      // Backend startup is asynchronous; retry briefly before loading the UI.
    } finally {
      clearTimeout(requestTimeout);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return false;
}

function stopPackagedBackend(onStopped) {
  const child = backendProcess;
  if (!child) {
    onStopped?.();
    return;
  }

  let finished = false;
  let forceTimer;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (forceTimer) clearTimeout(forceTimer);
    if (backendProcess === child) backendProcess = null;
    backendInstanceToken = null;
    onStopped?.();
  };

  child.once('exit', finish);
  try {
    // Unlike POSIX signals, this message is also graceful on Windows and lets
    // the backend flush SQLite/JSON state before it exits.
    child.postMessage({ type: SHUTDOWN_MESSAGE });
  } catch (_) {
    if (!child.kill()) finish();
  }

  forceTimer = setTimeout(() => {
    if (!finished && !child.kill()) finish();
  }, 11_000);
  forceTimer.unref();
}

function chooseDisplaySource(request, callback) {
  if (!request.userGesture
    || !request.videoRequested
    || !isTrustedAppFrame(request.frame, request.securityOrigin)) {
    callback({});
    return;
  }

  desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 0, height: 0 },
    fetchWindowIcons: true,
  }).then(sources => {
    if (!sources.length || !mainWindow || mainWindow.isDestroyed()) {
      callback({});
      return;
    }

    let completed = false;
    const complete = streams => {
      if (completed) return;
      completed = true;
      callback(streams || {});
    };

    const menuItems = [];
    const appendGroup = (label, entries) => {
      if (!entries.length) return;
      if (menuItems.length) menuItems.push({ type: 'separator' });
      menuItems.push({ label, enabled: false });
      entries.forEach(source => {
        menuItems.push({
          label: source.name || 'Adsız kaynak',
          icon: source.appIcon && !source.appIcon.isEmpty() ? source.appIcon.resize({ width: 16, height: 16 }) : undefined,
          click: () => {
            const streams = { video: source };
            if (request.audioRequested && process.platform === 'win32') streams.audio = 'loopbackWithMute';
            complete(streams);
          },
        });
      });
    };

    appendGroup('Ekranlar', sources.filter(source => source.id.startsWith('screen:')));
    appendGroup('Pencereler', sources.filter(source => source.id.startsWith('window:')));
    menuItems.push({ type: 'separator' }, { label: 'İptal', click: () => complete({}) });

    const picker = Menu.buildFromTemplate(menuItems);
    picker.popup({
      window: mainWindow,
      callback: () => complete({}),
    });
  }).catch(() => callback({}));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'tahosapp-icon.png'),
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      navigateOnDragDrop: false,
      safeDialogs: true,
      devTools: isDev,
      enableWebSQL: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#1a1b1e',
    autoHideMenuBar: !isDev,
    show: false,
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isTrustedTopLevelUrl(url)) return;
    event.preventDefault();
    openExternalSafely(url);
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(APP_ENTRY_URL);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  const template = [
    {
      label: 'File',
      submenu: [{ role: 'quit' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        ...(isDev ? [{ role: 'forceReload' }, { role: 'toggleDevTools' }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }],
    },
  ];

  // Kurulu uygulamada tarayıcı hissi veren File/Edit/View/Window menüsünü
  // tamamen kaldır. Geliştirme sırasında hata ayıklama menüsü kullanılabilir.
  Menu.setApplicationMenu(isDev ? Menu.buildFromTemplate(template) : null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function publishAutomaticPresence(activities) {
  latestAutomaticPresence = Array.isArray(activities) ? activities : [];
  if (!mainWindow || mainWindow.isDestroyed() || !isTrustedTopLevelUrl(mainWindow.webContents.getURL())) return;
  mainWindow.webContents.send('automatic-presence:update', latestAutomaticPresence);
}

function startAutomaticPresence() {
  if (process.platform !== 'win32') return { supported: false, activities: [] };
  if (!automaticPresenceDetector) {
    automaticPresenceDetector = new AutomaticPresenceDetector({
      onActivities: publishAutomaticPresence,
      onError: error => console.warn('Otomatik Rich Presence algılayıcısı:', String(error?.message || error).slice(0, 240)),
    });
  }
  automaticPresenceDetector.stopping = false;
  automaticPresenceDetector.start();
  return { supported: true, activities: latestAutomaticPresence };
}

function stopAutomaticPresence() {
  automaticPresenceDetector?.stop();
  automaticPresenceDetector = null;
  latestAutomaticPresence = [];
  return { success: true };
}

function configurePermissions() {
  const allowedPermissions = new Set(['media', 'display-capture', 'speaker-selection']);

  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    return allowedPermissions.has(permission)
      && details?.isMainFrame !== false
      && isTrustedAppWebContents(webContents, requestingOrigin)
      && (!details?.embeddingOrigin || isTrustedRendererOrigin(details.embeddingOrigin));
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details?.requestingUrl || webContents?.getURL() || '';
    callback(
      allowedPermissions.has(permission)
        && details?.isMainFrame !== false
        && isTrustedAppWebContents(webContents, requestingUrl),
    );
  });

  session.defaultSession.setDisplayMediaRequestHandler(chooseDisplaySource, { useSystemPicker: true });
}

const ownsSingleInstance = isDev || app.requestSingleInstanceLock();

if (!ownsSingleInstance) {
  app.quit();
} else {
  if (!isDev) {
    app.on('second-instance', () => {
      if (!mainWindow) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    });
  }

  ipcMain.on('runtime-config:get', event => {
    event.returnValue = null;
    const senderUrl = event.senderFrame?.url || event.sender?.getURL?.() || '';
    if (event.senderFrame && event.senderFrame !== event.sender.mainFrame) return;
    if (!isTrustedRendererOrigin(senderUrl)) return;
    event.returnValue = RENDERER_RUNTIME_CONFIG;
  });

  app.whenReady().then(async () => {
    if (!isDev) registerProductionProtocol();
    configurePermissions();
    await startPackagedBackend();
    const backendReady = await waitForPackagedBackend();
    if (!backendReady) {
      dialog.showErrorBox(
        'tahosapp başlatılamadı',
        `Yerel servis 127.0.0.1:${BACKEND_PORT} adresinde başlatılamadı. Bu portu kullanan başka bir programı kapatıp tekrar deneyin.`,
      );
      app.quit();
      return;
    }
    createWindow();
  }).catch(error => {
    console.error('Application startup failed:', error);
    app.quit();
  });

  app.on('before-quit', event => {
    stopAutomaticPresence();
    if (isDev || !backendProcess || isQuitting) return;
    event.preventDefault();
    isQuitting = true;
    stopPackagedBackend(() => app.quit());
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  ipcMain.handle('get-app-path', event => {
    if (!isTrustedAppFrame(event.senderFrame, event.senderFrame?.url)) return null;
    return app.getPath('userData');
  });

  ipcMain.handle('automatic-presence:start', event => {
    if (!isTrustedAppFrame(event.senderFrame, event.senderFrame?.url)) return { supported: false, activities: [] };
    return startAutomaticPresence();
  });

  ipcMain.handle('automatic-presence:stop', event => {
    if (!isTrustedAppFrame(event.senderFrame, event.senderFrame?.url)) return { success: false };
    return stopAutomaticPresence();
  });
}
