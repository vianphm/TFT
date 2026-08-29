'use strict';

const { globalShortcut } = require('electron');

/**
 * Dang ky phim tat toan cuc. Phim nao he dieu hanh/app khac da chiem thi bo qua
 * va bao lai cho UI de nguoi dung doi phim khac.
 */
class HotkeyManager {
  constructor(store) {
    this.store = store;
    this.handlers = new Map();
    this.failed = [];
  }

  register(actions) {
    this.handlers = new Map(Object.entries(actions));
    return this.apply();
  }

  apply() {
    globalShortcut.unregisterAll();
    this.failed = [];
    const hotkeys = this.store.get('hotkeys', {});
    for (const [action, accelerator] of Object.entries(hotkeys)) {
      const handler = this.handlers.get(action);
      if (!handler || !accelerator) continue;
      try {
        const ok = globalShortcut.register(accelerator, handler);
        if (!ok) this.failed.push({ action, accelerator, reason: 'da bi ung dung khac chiem' });
      } catch (err) {
        this.failed.push({ action, accelerator, reason: err.message });
      }
    }
    if (this.failed.length) {
      console.warn('[hotkeys] khong dang ky duoc:', this.failed);
    }
    return this.failed;
  }

  update(action, accelerator) {
    this.store.set(`hotkeys.${action}`, accelerator);
    return this.apply();
  }

  dispose() {
    globalShortcut.unregisterAll();
  }
}

module.exports = { HotkeyManager };
