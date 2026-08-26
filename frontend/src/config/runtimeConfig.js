function withoutTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

const desktopRuntime = globalThis.tahosappRuntime && typeof globalThis.tahosappRuntime === 'object'
  ? globalThis.tahosappRuntime
  : {};

const envApiUrl = withoutTrailingSlash(import.meta.env.VITE_API_URL);
const envApiOrigin = withoutTrailingSlash(import.meta.env.VITE_API_ORIGIN)
  || envApiUrl.replace(/\/api$/, '');

export const API_ORIGIN = withoutTrailingSlash(desktopRuntime.apiOrigin)
  || envApiOrigin
  || 'http://127.0.0.1:3001';

export const API_URL = withoutTrailingSlash(desktopRuntime.apiUrl)
  || envApiUrl
  || `${API_ORIGIN}/api`;

export const SOCKET_URL = withoutTrailingSlash(desktopRuntime.socketUrl)
  || withoutTrailingSlash(import.meta.env.VITE_SOCKET_URL)
  || API_ORIGIN;

const configuredPeerPort = Number(desktopRuntime.peerPort ?? import.meta.env.VITE_PEER_PORT ?? 9000);

export const PEER_CONFIG = Object.freeze({
  host: String(desktopRuntime.peerHost || import.meta.env.VITE_PEER_HOST || '127.0.0.1'),
  port: Number.isInteger(configuredPeerPort) && configuredPeerPort > 0 ? configuredPeerPort : 9000,
  path: String(desktopRuntime.peerPath || import.meta.env.VITE_PEER_PATH || '/peerjs'),
  secure: typeof desktopRuntime.peerSecure === 'boolean'
    ? desktopRuntime.peerSecure
    : import.meta.env.VITE_PEER_SECURE === 'true',
});

export const DEPLOYMENT_MODE = desktopRuntime.mode === 'remote' ? 'remote' : 'local';
