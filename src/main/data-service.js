'use strict';

const fs = require('fs');
const path = require('path');
const { net } = require('electron');
const { CDRAGON_URL, parseCdragon } = require('../renderer/shared/cdragon.js');

const BUNDLED_DIR = path.join(__dirname, '..', 'shared', 'data');

/**
 * Nguon du lieu tuong/toc/trang bi cua set hien tai.
 *
 * - Uu tien cache trong thu muc userData (da tai truoc do).
 * - Khong co cache thi dung du lieu dong goi san trong src/shared/data.
 * - Nguoi dung bam "Dong bo" thi tai lai tu Community Dragon.
 */
class DataService {
  constructor(userDataDir) {
    this.cacheFile = path.join(userDataDir, 'data', 'tft-set.json');
    this.cache = null;
  }

  /** Du lieu dung ngay: cache -> ban dong goi. Khong bao gio nem loi. */
  load() {
    if (this.cache) return this.cache;
    this.cache = this._readJson(this.cacheFile) || this._bundled();
    return this.cache;
  }

  _bundled() {
    const set = this._readJson(path.join(BUNDLED_DIR, 'set-fallback.json'));
    return set || { source: 'empty', setNumber: null, setName: 'Khong co du lieu', champions: [], traits: [], items: [], augments: [] };
  }

  _readJson(file) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      return null;
    }
  }

  /** Tai lai tu Community Dragon roi ghi cache. Tra ve { ok, setNumber, ... }. */
  async sync() {
    const raw = await fetchJson(CDRAGON_URL);
    const parsed = parseCdragon(raw);
    const bundled = this._bundled();
    // VNTFT cung cap ban dich + nhom trang bi; CDragon cung cap ID/icon du lieu song.
    // Giu catalog da dong goi khi dong bo de khong lam mat phan tieng Viet.
    parsed.itemCatalog = (bundled && bundled.itemCatalog) || [];
    parsed.charms = (bundled && bundled.charms) || [];
    const roles = Object.fromEntries(((bundled && bundled.champions) || [])
      .map((champion) => [champion.variantGroup || champion.name, champion.role]));
    parsed.champions = (parsed.champions || []).map((champion) => Object.assign({}, champion, {
      role: roles[champion.variantGroup || champion.name] || roles[champion.name] || champion.role || null
    }));
    fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
    fs.writeFileSync(this.cacheFile, JSON.stringify(parsed), 'utf8');
    this.cache = parsed;
    return {
      ok: true,
      setNumber: parsed.setNumber,
      setName: parsed.setName,
      champions: parsed.champions.length,
      items: parsed.items.length,
      traits: parsed.traits.length,
      augments: (parsed.augments || []).length,
      charms: (parsed.charms || []).length,
      catalogItems: parsed.itemCatalog.length,
      syncedAt: parsed.syncedAt
    };
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method: 'GET' });
    const chunks = [];
    const timeout = setTimeout(() => {
      request.abort();
      reject(new Error('Het thoi gian cho khi tai du lieu (60s)'));
    }, 60000);

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        clearTimeout(timeout);
        response.resume();
        reject(new Error(`May chu tra ve ${response.statusCode}`));
        return;
      }
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        clearTimeout(timeout);
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (err) {
          reject(new Error('Du lieu tai ve khong doc duoc: ' + err.message));
        }
      });
    });
    request.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    request.end();
  });
}

module.exports = { DataService };
