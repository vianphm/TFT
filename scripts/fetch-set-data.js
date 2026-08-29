'use strict';
/**
 * Tai du lieu set hien tai tu Community Dragon va ghi de len ban dong goi trong repo
 * (src/shared/data/set-fallback.json).
 *
 * Nho vay app co san danh sach tuong/toc he ngay khi vua cai, khong phai cho dong bo.
 * Chay tay:            node scripts/fetch-set-data.js
 * Tu dong hang tuan:   .github/workflows/data.yml
 */
const fs = require('fs');
const path = require('path');
const { CDRAGON_URL, parseCdragon, diagnose } = require('../src/renderer/shared/cdragon.js');
const tables = require('../src/renderer/shared/tables.js');

const DATA_DIR = path.join(__dirname, '..', 'src', 'shared', 'data');
const OUT = path.join(DATA_DIR, 'set-fallback.json');       // ban da rut gon, app dung truc tiep
const RAW_OUT = path.join(DATA_DIR, 'set18-raw.json');      // nguyen ban tu Community Dragon
const SET_MUTATOR = process.env.TFT_SET_MUTATOR || 'TFTSet18';
const TIMEOUT_MS = 180000;

main().catch((err) => {
  console.error('Loi:', err.message);
  process.exit(1);
});

async function main() {
  console.log('Dang tai', CDRAGON_URL);
  const started = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let raw;
  try {
    const res = await fetch(CDRAGON_URL, { signal: controller.signal });
    if (!res.ok) throw new Error('may chu tra ve ' + res.status);
    raw = await res.json();
  } finally {
    clearTimeout(timer);
  }

  // In ra tat ca nhanh du lieu de doi chieu - Community Dragon giu ca set cu lan set moi
  console.log('\nCac nhanh set tim thay (theo thu tu uu tien):');
  diagnose(raw).slice(0, 12).forEach(function (c, i) {
    console.log(`  ${i === 0 ? '->' : '  '} [${c.source}] ${c.mutator || 'so ' + c.number}` +
      ` "${c.name || '?'}" - ${c.champions} tuong, ${c.traits} toc he,` +
      ` gia: ${[1, 2, 3, 4, 5].map((k) => c.byCost[k]).join('/')}`);
  });

  const parsed = parseCdragon(raw, { mutator: SET_MUTATOR });
  if (parsed.setMutator !== SET_MUTATOR) {
    throw new Error(`khong tim thay nhanh ${SET_MUTATOR} trong du lieu (doc duoc: ${parsed.setMutator})`);
  }
  writeRaw(raw);
  if (!parsed.champions.length) throw new Error('khong doc duoc tuong nao - cau truc du lieu co the da doi');

  // In het danh sach de nguoi doc log tu doi chieu voi game
  console.log(`\nToan bo tuong doc duoc tu ${parsed.setMutator || parsed.setNumber}:`);
  [1, 2, 3, 4, 5].forEach((cost) => {
    const list = parsed.champions.filter((c) => c.cost === cost);
    console.log(`  ${cost} vang (${list.length}): ` + list.map((c) => c.name).join(', '));
  });
  console.log(`\n  Toc he (${parsed.traits.length}): ` + parsed.traits.map((t) => t.name).join(', '));
  console.log(`  An (${(parsed.emblems || []).length}): ` +
    (parsed.emblems || []).slice(0, 40).map((e) => e.name).join(', '));
  const withAbility = parsed.champions.filter((c) => c.ability && c.ability.name).length;
  console.log(`  Co chieu thuc: ${withAbility}/${parsed.champions.length} tuong`);

  warn(parsed);

  // Giu lai bang cong thuc ghep do cua rieng app (ten tieng Anh chuan, khong doi theo set)
  const payload = {
    source: 'communitydragon',
    syncedAt: parsed.syncedAt,
    setNumber: parsed.setNumber,
    setName: parsed.setName,
    champions: parsed.champions,
    traits: parsed.traits,
    components: parsed.components,
    items: parsed.items,
    emblems: parsed.emblems,
    recipes: Object.keys(tables.RECIPES).map((key) => ({
      apiName: key,
      name: tables.RECIPES[key],
      composition: key.split('+')
    }))
  };

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 1), 'utf8');

  const byCost = {};
  parsed.champions.forEach((c) => { byCost[c.cost] = (byCost[c.cost] || 0) + 1; });
  const size = (fs.statSync(OUT).size / 1024).toFixed(0);

  console.log(`\nXong sau ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`  Set ${parsed.setNumber} - ${parsed.setName}`);
  console.log(`  ${parsed.champions.length} tuong: ` +
    [1, 2, 3, 4, 5].map((c) => `${byCost[c] || 0} tuong ${c} vang`).join(', '));
  console.log(`  ${parsed.traits.length} toc he, ${parsed.items.length} trang bi ghep, ` +
    `${parsed.components.length} mon co ban, ${(parsed.emblems || []).length} an`);
  console.log(`  Ghi vao ${path.relative(process.cwd(), OUT)} (${size} KB)`);
}

/**
 * Ghi nguyen ban du lieu cua set can lay: toan bo tuong (ke ca truong ma app chua dung),
 * toc he day du, trang bi, an va lo nang cap. De sau nay can them thu gi thi lay o day,
 * khong phai tai lai tu dau.
 */
function writeRaw(raw) {
  const entry = (raw.setData || []).find((s) => s.mutator === SET_MUTATOR);
  if (!entry) throw new Error(`khong co nhanh ${SET_MUTATOR} trong setData`);

  const payload = {
    fetchedAt: new Date().toISOString(),
    source: CDRAGON_URL,
    mutator: entry.mutator,
    name: entry.name,
    number: entry.number,
    champions: entry.champions || [],
    traits: entry.traits || [],
    items: raw.items || []
  };

  fs.writeFileSync(RAW_OUT, JSON.stringify(payload), 'utf8');
  const mb = (fs.statSync(RAW_OUT).size / 1024 / 1024).toFixed(1);
  console.log(`\n  Nguyen ban: ${payload.champions.length} tuong, ${payload.traits.length} toc he, ` +
    `${payload.items.length} trang bi -> ${path.relative(process.cwd(), RAW_OUT)} (${mb} MB)`);
}

/**
 * Chan du lieu vo ly truoc khi ghi de.
 * Mot set that co khoang 13-14 tuong moi muc gia 1-4 va 8-10 tuong 5 vang.
 * Neu lech xa nghia la da doc nham nhanh (vi du nhanh gop nhieu mua cu lai voi nhau).
 */
function warn(parsed) {
  const byCost = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  parsed.champions.forEach((c) => { if (byCost[c.cost] !== undefined) byCost[c.cost]++; });
  const problems = [];

  if (parsed.champions.length < 40 || parsed.champions.length > 80) {
    problems.push(`so tuong bat thuong: ${parsed.champions.length}`);
  }
  if (byCost[5] > 12) {
    problems.push(`co toi ${byCost[5]} tuong 5 vang - nhanh nay chac chan gop nhieu mua`);
  }
  if (byCost[1] < 8 || byCost[2] < 8 || byCost[3] < 8 || byCost[4] < 8) {
    problems.push(`thieu tuong o mot muc gia: ${[1, 2, 3, 4, 5].map((k) => byCost[k]).join('/')}`);
  }

  // Nhieu ban sao cua cung mot tuong (Lux (Coven), Lux (Solar)...) = dau hieu gop mua cu
  const baseNames = {};
  parsed.champions.forEach((c) => {
    const base = String(c.name).replace(/\s*\(.*\)\s*$/, '');
    baseNames[base] = (baseNames[base] || 0) + 1;
  });
  const duplicated = Object.keys(baseNames).filter((n) => baseNames[n] > 2);
  if (duplicated.length) {
    problems.push(`co tuong lap nhieu lan (${duplicated.slice(0, 3).join(', ')}) - nhanh gop nhieu mua`);
  }

  if (problems.length) {
    console.warn('\nCANH BAO - du lieu trong bat thuong:\n  - ' + problems.join('\n  - ') +
      '\n  (dat TFT_SET_MUTATOR de chi dinh nhanh khac neu can)\n');
  }
}
