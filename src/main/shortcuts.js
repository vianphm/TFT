'use strict';

const { globalShortcut } = require('electron');

class ShortcutManager {
  constructor({ onToggleOverlay, onToggleClickThrough, onToggleMain } = {}) {
    this.callbacks = {
      onToggleOverlay,
      onToggleClickThrough,
      onToggleMain
    };
  }

  register() {
    globalShortcut.unregisterAll();

    try {
      if (this.callbacks.onToggleOverlay) {
        globalShortcut.register('F2', this.callbacks.onToggleOverlay);
        globalShortcut.register('Control+Shift+T', this.callbacks.onToggleOverlay);
      }
      if (this.callbacks.onToggleClickThrough) {
        globalShortcut.register('F3', this.callbacks.onToggleClickThrough);
        globalShortcut.register('Control+Shift+E', this.callbacks.onToggleClickThrough);
      }
      if (this.callbacks.onToggleMain) {
        globalShortcut.register('Control+Shift+D', this.callbacks.onToggleMain);
      }
    } catch (e) {
      console.warn('[shortcuts] Loi dang ky phim tat:', e.message);
    }
  }

  unregister() {
    globalShortcut.unregisterAll();
  }
}

module.exports = { ShortcutManager };
