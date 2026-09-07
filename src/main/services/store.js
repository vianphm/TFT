'use strict';

const fs = require('fs');
const path = require('path');

class Store {
  constructor(filePath, defaultData = {}) {
    this.filePath = filePath;
    this.data = this._load(defaultData);
  }

  _load(fallback) {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      }
    } catch (e) {
      console.warn('[store] Khong doc duoc file config, dung mac dinh:', e.message);
    }
    return Object.assign({}, fallback);
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('[store] Khong luu duoc config:', e.message);
    }
  }

  get(key, fallback = null) {
    const keys = key.split('.');
    let cur = this.data;
    for (const k of keys) {
      if (cur == null || typeof cur !== 'object') return fallback;
      cur = cur[k];
    }
    return cur !== undefined ? cur : fallback;
  }

  set(key, val) {
    const keys = key.split('.');
    let cur = this.data;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
      cur = cur[k];
    }
    cur[keys[keys.length - 1]] = val;
    this.save();
    return val;
  }

  all() {
    return this.data;
  }
}

module.exports = { Store };
