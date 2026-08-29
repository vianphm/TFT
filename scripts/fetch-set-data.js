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
const { CDRAGON_URL, parseCdragon } = require('../src/renderer/shared/cdragon.js');
const tables = require('../src/renderer/shared/tables.js');

const OUT = path.join(__dirname, '..', 'src', 'shared', 'data', 'set-fallback.json');
const TIMEOUT_MS = 120000;

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

  const parsed = parseCdragon(raw);
  if (!parsed.champions.length) throw new Error('khong doc duoc tuong nao - cau truc du lieu co the da doi');

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
    `${parsed.components.length} mon co ban`);
  console.log(`  Ghi vao ${path.relative(process.cwd(), OUT)} (${size} KB)`);
}
