'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Kho cau hinh JSON don gian (khong phu thuoc package ngoai).
 * Ghi file theo kieu atomic: ghi ra .tmp roi rename de tranh hong file khi tat may.
 */
class Store {
  constructor(filePath, defaults = {}) {
    this.filePath = filePath;
    this.defaults = defaults;
    this.data = this._load();
    this._writeTimer = null;
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      return mergeDeep(clone(this.defaults), JSON.parse(raw));
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('[store] khong doc duoc cau hinh, dung mac dinh:', err.message);
      }
      return clone(this.defaults);
    }
  }

  get(keyPath, fallback) {
    const value = keyPath.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), this.data);
    return value === undefined ? fallback : value;
  }

  set(keyPath, value) {
    const keys = keyPath.split('.');
    const last = keys.pop();
    let node = this.data;
    for (const key of keys) {
      if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
      node = node[key];
    }
    node[last] = value;
    this.save();
    return value;
  }

  merge(patch) {
    this.data = mergeDeep(this.data, patch);
    this.save();
    return this.data;
  }

  all() {
    return clone(this.data);
  }

  reset() {
    this.data = clone(this.defaults);
    this.save();
    return this.data;
  }

  /** Ghi tre 150ms de gom nhieu thay doi lien tiep (keo widget, doi opacity...). */
  save() {
    if (this._writeTimer) clearTimeout(this._writeTimer);
    this._writeTimer = setTimeout(() => this.saveNow(), 150);
  }

  saveNow() {
    if (this._writeTimer) {
      clearTimeout(this._writeTimer);
      this._writeTimer = null;
    }
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmp, this.filePath);
    } catch (err) {
      console.error('[store] khong ghi duoc cau hinh:', err.message);
    }
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeDeep(base, patch) {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch === undefined ? base : patch;
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = isPlainObject(value) && isPlainObject(base[key]) ? mergeDeep(base[key], value) : value;
  }
  return out;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

module.exports = { Store, mergeDeep };
