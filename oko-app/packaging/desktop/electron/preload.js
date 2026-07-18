// OKO Electron preload — intentionally minimal.
// contextIsolation is on and nodeIntegration is off, so the web app runs sandboxed.
// Expose a tiny bridge only if the app ever needs to know it runs inside the desktop shell.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('OKO_DESKTOP', {
  platform: process.platform,
  isDesktop: true,
});
