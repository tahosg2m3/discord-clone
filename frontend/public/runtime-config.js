// Web builds receive their endpoints from Vite environment variables. The
// packaged desktop protocol replaces this file with a frozen validated config
// before the application bundle starts.
if (!globalThis.tahosappRuntime) {
  Object.defineProperty(globalThis, 'tahosappRuntime', {
    value: Object.freeze({}),
    writable: false,
    configurable: false,
  });
}
