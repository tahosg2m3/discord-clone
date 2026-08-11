const {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  session,
  shell,
  utilityProcess,
} = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Do not trust an ambient NODE_ENV in an installed application: a machine-wide
// development value must never make a packaged build load localhost content.
const isDev = !app.isPackaged;
const APP_SCHEME = 'discord-clone';
const APP_HOST = 'app';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const APP_ENTRY_URL = `${APP_ORIGIN}/index.html`;
const RENDERER_ROOT = path.resolve(__dirname, '../frontend/dist');
const BACKEND_PORT = '3001';
const PEER_PORT = '9000';
const SHUTDOWN_MESSAGE = 'discord-clone:shutdown';

const PRODUCTION_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http://127.0.0.1:3001 http://localhost:3001",
  "media-src 'self' blob: https: http://127.0.0.1:3001 http://localhost:3001",
  "font-src 'self' data:",
  "connect-src 'self' http://127.0.0.1:3001 http://localhost:3001 ws://127.0.0.1:3001 ws://localhost:3001 http://127.0.0.1:9000 http://localhost:9000 ws://127.0.0.1:9000 ws://localhost:9000 https://tenor.googleapis.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-src 'none'",
].join('; ');

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

function createBackendEnvironment(runtimeEnvFile) {
  const environment = { ...process.env };
  delete environment.NODE_OPTIONS;
  delete environment.NODE_EXTRA_CA_CERTS;
  delete environment.ELECTRON_RUN_AS_NODE;

  return {
    ...environment,
    PORT: BACKEND_PORT,
    PEER_PORT,
    HOST: '127.0.0.1',
    PEER_HOST: '127.0.0.1',
    CLIENT_URL: APP_ORIGIN,
    APP_DATA_DIR: app.getPath('userData'),
    RUNTIME_ENV_FILE: runtimeEnvFile,
    DESKTOP_INSTANCE_TOKEN: backendInstanceToken,
    NODE_ENV: 'production',
  };
}

function startPackagedBackend() {
  if (isDev || backendProcess) return;

  const backendRoot = path.join(process.resourcesPath, 'backend');
  const backendEntry = path.join(backendRoot, 'src', 'server.js');
  const runtimeEnvFile = prepareRuntimeEnvFile();
  backendInstanceToken = crypto.randomBytes(32).toString('hex');

  try {
    const child = utilityProcess.fork(backendEntry, [], {
      cwd: backendRoot,
      env: createBackendEnvironment(runtimeEnvFile),
      stdio: 'inherit',
      serviceName: 'Discord Clone Backend',
    });
    backendProcess = child;

    child.on('error', (type, location, report) => {
      console.error('Backend utility process error:', type, location, report || '');
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
  }
}

async function waitForPackagedBackend(timeoutMs = 8_000) {
  if (isDev) return true;
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

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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

  app.whenReady().then(async () => {
    if (!isDev) registerProductionProtocol();
    configurePermissions();
    startPackagedBackend();
    const backendReady = await waitForPackagedBackend();
    if (!backendReady) {
      dialog.showErrorBox(
        'Discord Clone başlatılamadı',
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
}
