const { contextBridge, ipcRenderer } = require('electron');

const runtimeConfig = ipcRenderer.sendSync('runtime-config:get');
const safeRuntimeConfig = runtimeConfig && typeof runtimeConfig === 'object'
  ? Object.freeze({ ...runtimeConfig })
  : Object.freeze({});

contextBridge.exposeInMainWorld('tahosappRuntime', safeRuntimeConfig);

contextBridge.exposeInMainWorld('electron', {
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  platform: process.platform,
  automaticPresence: Object.freeze({
    start: () => ipcRenderer.invoke('automatic-presence:start'),
    stop: () => ipcRenderer.invoke('automatic-presence:stop'),
    onUpdate: callback => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, activities) => callback(Array.isArray(activities) ? activities : []);
      ipcRenderer.on('automatic-presence:update', listener);
      return () => ipcRenderer.removeListener('automatic-presence:update', listener);
    },
  }),
});
