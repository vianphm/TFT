'use strict';

const path = require('path');
const { BrowserWindow } = require('electron');

function createMainWindow(store, preloadPath) {
  const savedBounds = store.get('window.mainBounds', { width: 1280, height: 820 });

  const win = new BrowserWindow({
    width: savedBounds.width || 1280,
    height: savedBounds.height || 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#090d16',
    title: 'Blitz TFT Companion',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.loadFile(path.join(__dirname, '..', '..', 'renderer', 'app', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

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
