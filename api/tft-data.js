'use strict';

/**
 * Cau noi den database cua game (Vercel serverless).
 *
 * Vi sao can: file en_us.json cua Community Dragon nang khoang 10-30 MB va khong phai
 * luc nao cung cho goi truc tiep tu trinh duyet. Ham nay tai ve o phia may chu, rut gon
 * con vai tram KB (tuong, toc he, trang bi), roi tra ve kem CORS va cache CDN.
 *
 *   GET /api/tft-data            -> du lieu day du da rut gon
 *   GET /api/tft-data?slim=1     -> bo augment va mo ta trang bi cho nhe hon nua
 */

const { CDRAGON_URL, parseCdragon } = require('../src/renderer/shared/cdragon.js');
const bundled = require('../src/shared/data/set-fallback.json');

// Giu lai trong bo nho cua instance de nhieu request lien tiep khong tai lai
let cache = { at: 0, payload: null };
const TTL_MS = 6 * 60 * 60 * 1000;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const slim = String((req.query && req.query.slim) || '') === '1';

  try {
    const data = await load();
    const payload = slim ? trim(data) : data;

    // CDN giu 6 tieng, van tra ban cu trong luc lam moi -> dien thoai luon co ngay du lieu
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify(payload));
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({
      error: 'Khong lay duoc du lieu tu Community Dragon',
      detail: err.message
    });
  }
};

async function load() {
  if (cache.payload && Date.now() - cache.at < TTL_MS) return cache.payload;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(CDRAGON_URL, { signal: controller.signal });
    if (!response.ok) throw new Error('Community Dragon tra ve ' + response.status);
    const parsed = parseCdragon(await response.json());
    parsed.itemCatalog = bundled.itemCatalog || [];
    parsed.charms = bundled.charms || [];
    const roles = Object.fromEntries((bundled.champions || []).map((c) => [c.variantGroup || c.name, c.role]));
    parsed.champions = (parsed.champions || []).map((c) => Object.assign({}, c, {
      role: roles[c.variantGroup || c.name] || roles[c.name] || c.role || null
    }));
    cache = { at: Date.now(), payload: parsed };
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

// De kiem thu duoc phan rut gon ma khong can goi mang
module.exports.trim = trim;

/** Ban gon: du de tinh toc he va ghep do, bo phan mo ta dai dong. */
function trim(data) {
  return {
    source: data.source,
    syncedAt: data.syncedAt,
    setNumber: data.setNumber,
    setName: data.setName,
    champions: data.champions,
    traits: data.traits,
    items: (data.items || []).map((i) => ({ name: i.name, composition: i.composition, icon: i.icon })),
    components: data.components || [],
    emblems: data.emblems || [],
    charms: data.charms || [],
    itemCatalog: data.itemCatalog || []
  };
}
