'use strict';

const fs = require('fs');
const path = require('path');
const { net } = require('electron');

const CDRAGON_URL = 'https://raw.communitydragon.org/latest/cdragon/tft/en_us.json';
const CDRAGON_CDN = 'https://raw.communitydragon.org/latest/game/';
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
      syncedAt: parsed.syncedAt
    };
  }
}

/** Rut gon file en_us.json (rat nang) thanh dung nhung gi app can. */
function parseCdragon(raw) {
  const sets = raw.sets || {};
  const setNumber = Object.keys(sets)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => b - a)[0];
  const set = sets[String(setNumber)] || { champions: [], traits: [] };

  const champions = (set.champions || [])
    .filter((c) => c.cost > 0 && Array.isArray(c.traits) && c.traits.length)
    .map((c) => ({
      apiName: c.apiName,
      name: c.name,
      cost: c.cost,
      traits: c.traits,
      icon: toCdn(c.squareIcon || c.tileIcon)
    }))
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));

  const traits = (set.traits || []).map((t) => ({
    apiName: t.apiName,
    name: t.name,
    icon: toCdn(t.icon),
    breakpoints: (t.effects || []).map((e) => e.minUnits)
  }));

  const allItems = raw.items || [];
  const items = allItems
    .filter((i) => Array.isArray(i.composition) && i.composition.length === 2)
    .map((i) => ({
      apiName: i.apiName,
      name: i.name,
      composition: i.composition,
      icon: toCdn(i.icon),
      desc: stripTags(i.desc || '')
    }));

  const components = allItems
    .filter((i) => (!i.composition || !i.composition.length) && i.icon && /items\/hexcore/i.test(i.icon))
    .map((i) => ({ apiName: i.apiName, name: i.name, icon: toCdn(i.icon) }));

  const augments = allItems
    .filter((i) => /augment/i.test(i.apiName || '') && i.name)
    .map((i) => ({ apiName: i.apiName, name: i.name, icon: toCdn(i.icon), desc: stripTags(i.desc || '') }));

  return {
    source: 'communitydragon',
    syncedAt: new Date().toISOString(),
    setNumber,
    setName: set.name || `Set ${setNumber}`,
    champions,
    traits,
    items,
    components,
    augments
  };
}

function toCdn(iconPath) {
  if (!iconPath) return null;
  return CDRAGON_CDN + String(iconPath).toLowerCase().replace(/\.(tex|dds)$/, '.png');
}

function stripTags(text) {
  return String(text).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
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
