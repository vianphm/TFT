'use strict';

const tables = require('../renderer/shared/tables.js');

/**
 * Nhap doi hinh tu ben ngoai.
 *
 * Ho tro 3 kieu dau vao:
 *   1. JSON xuat tu chinh app nay (chinh xac tuyet doi)
 *   2. URL mot trang meta (metatft.gg, doihinhtft.vn, mobalytics...)
 *   3. Van ban / HTML dan tay
 *
 * Voi (2) va (3) khong the biet truoc cau truc HTML cua tung trang, nen dung
 * cach do theo TU KHOA: tim ten tuong trong danh sach tuong cua set da dong bo,
 * tim ten trang bi trong bang cong thuc, roi gom theo tung khoi tieu de.
 * Ket qua la doi hinh NHAP, nguoi dung xem lai va sua trong tab "Doi hinh".
 */

const ITEM_NAMES = Array.from(new Set(
  Object.values(tables.RECIPES)
    .concat(Object.values(tables.ITEM_NAMES_VI || {}))
    .concat(tables.COMPONENTS.reduce((all, c) => all.concat([c.name, c.vi]), []))
)).filter((n) => n && !/tuy set/i.test(n));

const VI_TO_CANONICAL = Object.keys(tables.ITEM_NAMES_VI || {}).reduce((out, en) => {
  out[tables.ITEM_NAMES_VI[en]] = en;
  return out;
}, {});

async function importFromUrl(url, dataset) {
  if (!/^https?:\/\//i.test(url)) throw new Error('Duong dan phai bat dau bang http:// hoac https://');
  const html = await fetchText(url);
  const comps = parseComps(html, dataset);
  if (!comps.length) {
    throw new Error('Khong tim thay doi hinh nao trong trang. Thu bam "Dong bo du lieu" truoc, hoac dan truc tiep noi dung trang vao o ben duoi.');
  }
  return comps.map((c) => ({ ...c, source: url }));
}

function importFromText(text, dataset) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Chua co noi dung de nhap');

  // Kieu 1: JSON xuat tu app
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      const list = Array.isArray(json) ? json : (json.comps || [json]);
      return list.map(normalizeComp).filter(Boolean);
    } catch (err) {
      // khong phai JSON hop le -> roi xuong nhanh do tu khoa
    }
  }
  const comps = parseComps(trimmed, dataset);
  if (!comps.length) throw new Error('Khong nhan ra doi hinh nao trong noi dung da dan');
  return comps;
}

// ---------------------------------------------------------------- do tu khoa

function parseComps(input, dataset) {
  const champions = (dataset && dataset.champions) || [];
  if (!champions.length) {
    throw new Error('Chua co danh sach tuong. Vao Cai dat -> "Dong bo du lieu set" roi thu lai.');
  }

  const blocks = splitIntoBlocks(input);
  const champIndex = buildIndex(champions.map((c) => c.name));
  const itemIndex = buildIndex(ITEM_NAMES);

  const comps = [];
  for (const block of blocks) {
    const hits = findMatches(block.text, champIndex);
    if (hits.length < 4) continue;             // it hon 4 tuong thi khong coi la doi hinh
    const itemHits = findMatches(block.text, itemIndex);

    const units = hits.map((hit, index) => {
      const champ = champions.find((c) => c.name === hit.name) || {};
      return {
        name: hit.name,
        cost: champ.cost || 1,
        star: (champ.cost || 1) <= 2 ? 3 : 2,
        carry: false,
        items: itemsNear(itemHits, hit, hits[index + 1]),
        row: null,
        col: null
      };
    });
    autoPlace(units);
    const withItems = units.filter((u) => u.items.length);
    if (withItems.length) withItems[0].carry = true;

    comps.push({
      id: 'imp-' + Date.now().toString(36) + '-' + comps.length,
      name: block.title || `Doi hinh nhap ${comps.length + 1}`,
      tier: guessTier(block.title) || '',
      style: '',
      traits: [],
      econ: { levelAt: {}, rollDownAt: '', keepGold: 50 },
      notes: 'Nhap tu ngoai, kiem tra lai vi tri dung va trang bi.',
      units: units.slice(0, 10)
    });
  }
  return comps;
}

/** Cat noi dung thanh cac khoi theo the tieu de; neu la van ban thuan thi cat theo dong trong. */
function splitIntoBlocks(input) {
  const hasTags = /<\/?[a-z][\s\S]*>/i.test(input);
  if (!hasTags) {
    return input.split(/\n\s*\n/).map((chunk) => {
      const lines = chunk.trim().split('\n');
      return { title: cleanText(lines[0] || ''), text: cleanText(chunk) };
    }).filter((b) => b.text);
  }

  // Giu lai alt/title cua anh: cac trang meta thuong de ten tuong o do.
  const enriched = input
    .replace(/<img[^>]*?(?:alt|title)="([^"]+)"[^>]*>/gi, ' $1 ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');

  const parts = enriched.split(/(<h[1-4][^>]*>[\s\S]*?<\/h[1-4]>)/i);
  const blocks = [];
  let currentTitle = '';
  let buffer = '';
  for (const part of parts) {
    if (/^<h[1-4]/i.test(part)) {
      if (buffer.trim()) blocks.push({ title: currentTitle, text: cleanText(buffer) });
      currentTitle = cleanText(part);
      buffer = '';
    } else {
      buffer += part;
    }
  }
  if (buffer.trim()) blocks.push({ title: currentTitle, text: cleanText(buffer) });
  if (!blocks.length) blocks.push({ title: '', text: cleanText(enriched) });
  return blocks;
}

function cleanText(html) {
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bo dau tieng Viet + ha chu thuong de so khop de hon. */
function normalize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase();
}

function buildIndex(names) {
  return names
    .map((name) => ({ name, needle: normalize(name) }))
    .filter((entry) => entry.needle.length >= 3)
    .sort((a, b) => b.needle.length - a.needle.length); // ten dai khop truoc de tranh trung
}

/** Tim tat ca ten xuat hien trong van ban, khong trung lap, giu thu tu xuat hien. */
function findMatches(text, index) {
  const haystack = normalize(text);
  const found = [];
  const seen = new Set();
  for (const entry of index) {
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(entry.needle, from);
      if (at < 0) break;
      const before = haystack[at - 1] || ' ';
      const after = haystack[at + entry.needle.length] || ' ';
      const isWord = /[a-z0-9]/;
      if (!isWord.test(before) && !isWord.test(after) && !seen.has(entry.name)) {
        found.push({ name: entry.name, at });
        seen.add(entry.name);
      }
      from = at + entry.needle.length;
    }
  }
  return found.sort((a, b) => a.at - b.at);
}

/** Trang bi nam giua vi tri tuong nay va tuong ke tiep thi coi la cua tuong nay. */
function itemsNear(itemHits, champHit, nextChampHit) {
  const start = champHit.at;
  const end = nextChampHit ? nextChampHit.at : Infinity;
  return itemHits
    .filter((item) => item.at > start && item.at < end)
    .slice(0, 3)
    .map((item) => VI_TO_CANONICAL[item.name] || item.name);
}

/** Xep tam vi tri: gia cao ra sau, do dan len truoc. */
function autoPlace(units) {
  const front = units.filter((u) => u.cost <= 2 || !u.items.length);
  const back = units.filter((u) => front.indexOf(u) < 0);
  front.forEach((u, i) => { u.row = 0; u.col = (i + 1) % 7; });
  back.forEach((u, i) => { u.row = 3; u.col = (i + 2) % 7; });
}

function guessTier(title) {
  const m = /\b(S\+|S|A|B|C|D)\s*(?:tier|bac)?\b/i.exec(String(title || ''));
  return m ? m[1].toUpperCase() : '';
}

function normalizeComp(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const units = Array.isArray(raw.units) ? raw.units : [];
  return {
    id: raw.id || 'imp-' + Math.random().toString(36).slice(2, 9),
    name: String(raw.name || 'Doi hinh khong ten'),
    tier: String(raw.tier || ''),
    style: String(raw.style || ''),
    traits: Array.isArray(raw.traits) ? raw.traits : [],
    econ: raw.econ && typeof raw.econ === 'object' ? raw.econ : { levelAt: {}, rollDownAt: '', keepGold: 50 },
    notes: String(raw.notes || ''),
    units: units.map((u) => ({
      name: String(u.name || '?'),
      cost: Number(u.cost) || 1,
      star: Number(u.star) || 2,
      carry: Boolean(u.carry),
      items: Array.isArray(u.items) ? u.items.map(String).slice(0, 3) : [],
      row: u.row === null || u.row === undefined ? null : Number(u.row),
      col: u.col === null || u.col === undefined ? null : Number(u.col)
    }))
  };
}

function fetchText(url) {
  const { net } = require('electron');
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method: 'GET' });
    request.setHeader('User-Agent', 'TFT-Companion/0.1 (+local app)');
    const chunks = [];
    const timeout = setTimeout(() => {
      request.abort();
      reject(new Error('Het thoi gian cho khi tai trang (45s)'));
    }, 45000);
    request.on('response', (response) => {
      if (response.statusCode >= 400) {
        clearTimeout(timeout);
        response.resume();
        reject(new Error(`Trang tra ve loi ${response.statusCode}`));
        return;
      }
      response.on('data', (c) => chunks.push(c));
      response.on('end', () => {
        clearTimeout(timeout);
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    request.on('error', (err) => { clearTimeout(timeout); reject(err); });
    request.end();
  });
}

module.exports = { importFromUrl, importFromText, normalizeComp };
