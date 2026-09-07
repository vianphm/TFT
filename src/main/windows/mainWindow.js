'use strict';

const path = require('path');
const { BrowserWindow } = require('electron');

function createMainWindow(store, preloadPath) {
  const savedBounds = store.get('window.mainBounds', { width: 1280, height: 820 });

  const winOptions = {
    width: Math.max(960, savedBounds.width || 1280),
    height: Math.max(640, savedBounds.height || 820),
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#090d16',
    title: 'Blitz TFT Companion',
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  };

  if (savedBounds.x != null && savedBounds.y != null && savedBounds.x >= 0 && savedBounds.y >= 0) {
    winOptions.x = savedBounds.x;
    winOptions.y = savedBounds.y;
  } else {
    winOptions.center = true;
  }

  const win = new BrowserWindow(winOptions);

  win.loadFile(path.join(__dirname, '..', '..', 'renderer', 'app', 'index.html'));

  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[mainWindow] Load error:', code, desc);
  });

  win.show();
  win.focus();
  win.setAlwaysOnTop(true);
  setTimeout(() => {
    if (!win.isDestroyed()) {
      win.setAlwaysOnTop(false);
    }
  }, 600);

  const saveBounds = () => {
    if (!win.isDestroyed() && !win.isMinimized() && !win.isMaximized()) {
      store.set('window.mainBounds', win.getBounds());
    }
  };

  win.on('resize', saveBounds);
  win.on('move', saveBounds);

  return win;
}

module.exports = { createMainWindow };
