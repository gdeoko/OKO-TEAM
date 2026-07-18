// OKO desktop shell (Electron).
// Default: loads the live OKO web app. For OFFLINE mode set OKO_OFFLINE=1 and place a
// copy of oko-app/prototype/index.html at ./app/index.html (see build-desktop.md).
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

const REMOTE_URL = 'https://true-journey-418.higgsfield.app';
const OFFLINE = process.env.OKO_OFFLINE === '1';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 380,
    minHeight: 640,
    center: true,
    backgroundColor: '#000000',
    title: 'OKO',
    autoHideMenuBar: true,
    icon: process.platform === 'linux'
      ? path.join(__dirname, 'build', 'icon.png')
      : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: true,
    },
  });

  if (OFFLINE) {
    win.loadFile(path.join(__dirname, 'app', 'index.html'));
  } else {
    win.loadURL(REMOTE_URL);
  }

  // Open external links (mailto, other domains) in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(REMOTE_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // brand-clean; remove this line to keep native menu
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
