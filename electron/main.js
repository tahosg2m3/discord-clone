const { app, BrowserWindow, desktopCapturer, ipcMain, Menu, session, shell } = require('electron');
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let backendProcess;
let isQuitting = false;

function isTrustedAppWebContents(webContents, origin = '') {
  if (!mainWindow?.webContents || !webContents || webContents.id !== mainWindow.webContents.id) return false;
  const source = origin || webContents.getURL() || '';
  if (isDev) return /^http:\/\/(localhost|127\.0\.0\.1):5173(?:\/|$)/i.test(source);
  return source.startsWith('file://') || source === 'null';
}

function isTrustedAppFrame(frame, origin = '') {
  const mainFrame = mainWindow?.webContents?.mainFrame;
  if (!frame || !mainFrame || frame.processId !== mainFrame.processId || frame.routingId !== mainFrame.routingId) return false;
  const source = origin || frame.url || '';
  if (isDev) return /^http:\/\/(localhost|127\.0\.0\.1):5173(?:\/|$)/i.test(source);
  return source.startsWith('file://') || source === 'null';
}

function openExternalSafely(url) {
  if (/^(https?:|mailto:)/i.test(String(url || ''))) shell.openExternal(url).catch(() => {});
}

function prepareRuntimeEnvFile() {
  const configuredPath = process.env.RUNTIME_ENV_FILE || process.env.SMTP_ENV_FILE;
  const runtimeEnvFile = configuredPath || path.join(app.getPath('userData'), 'runtime.env');
  const exampleFile = `${runtimeEnvFile}.example`;
  const packagedTemplate = path.join(process.resourcesPath, 'backend', 'runtime.env.example');

  try {
    if (!fs.existsSync(runtimeEnvFile) && !fs.existsSync(exampleFile) && fs.existsSync(packagedTemplate)) {
      fs.copyFileSync(packagedTemplate, exampleFile);
    }
  } catch (error) {
    console.warn('SMTP örnek yapılandırması oluşturulamadı:', error.message);
  }

  return runtimeEnvFile;
}

function startPackagedBackend() {
  // Geliştirmede backend npm komutuyla zaten ayrı başlatılır. Paketli
  // uygulamada ise kullanıcı ayrıca terminal açmadan API + PeerJS çalışır.
  if (isDev || backendProcess) return;

  const backendEntry = path.join(process.resourcesPath, 'backend', 'src', 'server.js');
  const runtimeEnvFile = prepareRuntimeEnvFile();
  backendProcess = fork(backendEntry, [], {
    env: {
      ...process.env,
      PORT: process.env.PORT || '3001',
      CLIENT_URL: process.env.CLIENT_URL || 'null',
      APP_DATA_DIR: app.getPath('userData'),
      RUNTIME_ENV_FILE: runtimeEnvFile,
      NODE_ENV: 'production',
    },
    silent: false,
  });

  backendProcess.on('exit', () => {
    backendProcess = null;
  });
}

function stopPackagedBackend(onStopped) {
  const child = backendProcess;
  if (!child || child.killed) {
    onStopped?.();
    return;
  }

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (backendProcess === child) backendProcess = null;
    onStopped?.();
  };

  child.once('exit', finish);
  child.kill('SIGTERM');
  setTimeout(() => {
    if (!finished && child.exitCode === null) child.kill('SIGKILL');
  }, 11_000).unref();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#1a1b1e',
    show: false, // Don't show until ready
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isTrustedAppWebContents(mainWindow.webContents, url)) return;
    event.preventDefault();
    openExternalSafely(url);
  });

  // Load app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Menu
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Electron'da mikrofon ve ekran paylaşımı için izinler varsayılan olarak
  // reddedilebiliyor. Sadece bu yerel uygulamanın medya izinlerine onay veriyoruz.
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    return isTrustedAppWebContents(webContents, requestingOrigin)
      && (permission === 'media' || permission === 'display-capture');
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(
      isTrustedAppWebContents(webContents, details?.requestingUrl)
        && (permission === 'media' || permission === 'display-capture'),
    );
  });

  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    if (!isTrustedAppFrame(_request.frame, _request.securityOrigin)) {
      callback({});
      return;
    }
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
    callback(sources[0] ? { video: sources[0] } : {});
  });

  startPackagedBackend();
  createWindow();
});

app.on('before-quit', (event) => {
  if (isDev || !backendProcess || isQuitting) return;
  event.preventDefault();
  isQuitting = true;
  stopPackagedBackend(() => app.quit());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});
