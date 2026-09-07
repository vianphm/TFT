'use strict';

const path = require('path');
const { BrowserWindow, screen } = require('electron');

class OverlayManager {
  constructor(store, preloadPath) {
    this.store = store;
    this.preloadPath = preloadPath;
    this.window = null;
  }

  create() {
    if (this.window && !this.window.isDestroyed()) return this.window;

    const display = screen.getPrimaryDisplay();
    const { x, y, width, height } = display.bounds;

    const win = new BrowserWindow({
      x,
      y,
      width,
      height,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      alwaysOnTop: true,
      hasShadow: false,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      focusable: false,
      title: 'Blitz TFT Overlay',
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false
      }
    });

    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setIgnoreMouseEvents(this.store.get('overlay.clickThrough', true), { forward: true });

    win.loadFile(path.join(__dirname, '..', '..', 'renderer', 'overlay', 'overlay.html'));

    win.on('closed', () => {
      this.window = null;
    });

    this.window = win;
    return win;
  }

  show() {
    const win = this.create();
    if (!win.isVisible()) {
      win.showInactive();
    }
    win.setAlwaysOnTop(true, 'screen-saver');
    this.store.set('overlay.visible', true);
  }

  hide() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide();
      this.store.set('overlay.visible', false);
    }
  }

  toggle(force) {
    const isVisible = this.window && !this.window.isDestroyed() && this.window.isVisible();
    const next = force !== undefined ? Boolean(force) : !isVisible;
    if (next) this.show();
    else this.hide();
    return next;
  }

  setClickThrough(enabled) {
    const next = Boolean(enabled);
    this.store.set('overlay.clickThrough', next);
    if (this.window && !this.window.isDestroyed()) {
      this.window.setIgnoreMouseEvents(next, { forward: true });
      this.window.setFocusable(!next);
    }
    return next;
  }

  setHover(hovering) {
    if (!this.window || this.window.isDestroyed()) return;
    const isLocked = this.store.get('overlay.clickThrough', true);
    if (!isLocked) return; // Luon cho phep click neu dang mo khoa
    // Neu dang rê chuot vao widget thi cho phep click, ra ngoai thi chuot xuyen vao game
    this.window.setIgnoreMouseEvents(!hovering, { forward: true });
  }

  broadcast(channel, data) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, data);
    }
  }
}

module.exports = { OverlayManager };
