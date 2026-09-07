'use strict';

const path = require('path');
const { BrowserWindow, screen } = require('electron');

class OverlayManager {
  constructor(store, preloadPath) {
    this.store = store;
    this.preloadPath = preloadPath;
    this.window = null;
    this.widgetBounds = [];
    this.isDragging = false;
    this.cursorTimer = null;
    this.lastIgnoreState = null;
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
    win.setIgnoreMouseEvents(false);

    win.loadFile(path.join(__dirname, '..', '..', 'renderer', 'overlay', 'overlay.html'));

    win.on('closed', () => {
      this.stopCursorTracking();
      this.window = null;
    });

    this.window = win;
    return win;
  }

  startCursorTracking() {
    if (this.cursorTimer) return;
    this.cursorTimer = setInterval(() => {
      if (!this.window || this.window.isDestroyed() || !this.window.isVisible()) return;

      const clickThroughLocked = this.store.get('overlay.clickThrough', true);
      // Khi đang kéo thả hoặc người dùng chủ động mở chuột (F3) -> Nhận chuột hoàn toàn
      if (!clickThroughLocked || this.isDragging) {
        this._setIgnore(false);
        return;
      }

      // Lấy tọa độ con trỏ chuột toàn cục thực tế từ Windows DWM
      const pt = screen.getCursorScreenPoint();
      let isOverWidget = false;

      for (let i = 0; i < this.widgetBounds.length; i++) {
        const b = this.widgetBounds[i];
        if (
          pt.x >= b.x && pt.x <= (b.x + b.width) &&
          pt.y >= b.y && pt.y <= (b.y + b.height)
        ) {
          isOverWidget = true;
          break;
        }
      }

      // Chuột nằm trong widget -> Bật tương tác (ignore: false)
      // Chuột nằm ngoài vùng widget -> Bấm xuyên vào trận đấu (ignore: true)
      this._setIgnore(!isOverWidget);
    }, 35);
  }

  _setIgnore(ignore) {
    if (this.lastIgnoreState !== ignore && this.window && !this.window.isDestroyed()) {
      this.lastIgnoreState = ignore;
      this.window.setIgnoreMouseEvents(ignore, { forward: true });
    }
  }

  stopCursorTracking() {
    if (this.cursorTimer) {
      clearInterval(this.cursorTimer);
      this.cursorTimer = null;
    }
  }

  show() {
    const win = this.create();
    if (!win.isVisible()) {
      win.showInactive();
    }
    win.setAlwaysOnTop(true, 'screen-saver');
    this.store.set('overlay.visible', true);
    this.startCursorTracking();
  }

  hide() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide();
      this.store.set('overlay.visible', false);
      this.stopCursorTracking();
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
    if (!next) {
      this._setIgnore(false);
    }
    return next;
  }

  setHover(hovering) {
    if (this.isDragging) return;
    this._setIgnore(!hovering);
  }

  updateBounds(bounds) {
    if (Array.isArray(bounds)) {
      const display = screen.getPrimaryDisplay();
      const originX = display.bounds.x || 0;
      const originY = display.bounds.y || 0;

      this.widgetBounds = bounds.map((b) => ({
        x: originX + b.x,
        y: originY + b.y,
        width: b.width,
        height: b.height
      }));
    }
  }

  setDragging(dragging) {
    this.isDragging = Boolean(dragging);
    if (this.isDragging) {
      this._setIgnore(false);
    }
  }

  broadcast(channel, data) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, data);
    }
  }
}

module.exports = { OverlayManager };
