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
const VI_ITEMS = path.join(DATA_DIR, 'set18-items-vi.json');
const DATATFT_ROLES = path.join(DATA_DIR, 'set18-roles.json');
const DATATFT_CHARMS = path.join(DATA_DIR, 'set18-charms.json');
const DATATFT_UNITS = path.join(DATA_DIR, 'set18-units-datatft.json');
const DATATFT_TRAITS = path.join(DATA_DIR, 'set18-traits-datatft.json');
const BLITZ_CHAMPION_STATS = path.join(DATA_DIR, 'set18-champion-stats-blitz.json');
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
    champions: localizedChampionData(parsed.champions),
    traits: localizedTraits(parsed.traits),
    components: parsed.components,
    items: parsed.items,
    emblems: parsed.emblems,
    augments: parsed.augments,
    charms: readDataArray(DATATFT_CHARMS, 'charms'),
    recipes: Object.keys(tables.RECIPES).map((key) => ({
      apiName: key,
      name: tables.RECIPES[key],
      composition: key.split('+')
    })),
    itemCatalog: localizedItemCatalog(parsed)
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

function readDataArray(file, key) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8'))[key] || []; } catch (_) { return []; }
}

/** DataTFT phan loai vai tro chi tiet hon du lieu game tho. */
function localizedChampionRoles(champions) {
  let roleMap = {};
  try { roleMap = JSON.parse(fs.readFileSync(DATATFT_ROLES, 'utf8')).roles || {}; } catch (_) {}
  return (champions || []).map((champion) => Object.assign({}, champion, {
    role: roleMap[champion.variantGroup || champion.name] || roleMap[champion.name] || champion.role || null
  }));
}

/** Giu CDragon lam ID game, ghep DataTFT lam chi so theo sao va mo ta de doc. */
function localizedChampionData(champions) {
  const withRoles = localizedChampionRoles(champions);
  let source = { dataVersion: null, units: [] };
  try { source = JSON.parse(fs.readFileSync(DATATFT_UNITS, 'utf8')); } catch (_) {}
  const byName = Object.fromEntries((source.units || []).map((unit) => [unit.name, unit]));
  let blitz = { patch: null, filters: null, champions: [] };
  try { blitz = JSON.parse(fs.readFileSync(BLITZ_CHAMPION_STATS, 'utf8')); } catch (_) {}
  const blitzByApi = Object.fromEntries((blitz.champions || []).map((row) => [String(row.apiName).toLowerCase(), row]));
  const blitzByName = {};
  withRoles.forEach((champion) => {
    const row = blitzByApi[String(champion.apiName).toLowerCase()];
    if (row) blitzByName[champion.variantGroup || champion.name] = row;
  });
  return withRoles.map((champion) => {
    const unit = byName[champion.variantGroup || champion.name] || byName[champion.name];
    const meta = blitzByApi[String(champion.apiName).toLowerCase()] || blitzByName[champion.variantGroup || champion.name];
    return Object.assign({}, champion, unit ? {
      role: unit.role || champion.role, datatft: {
        id: unit.id,
        dataVersion: source.dataVersion,
        image: unit.image,
        stats: unit.stats,
        ability: cleanDatatftAbility(unit.ability)
      }
    } : {}, meta ? {
      blitz: {
        patch: blitz.patch, filters: blitz.filters, rank: meta.rank, tier: meta.tier,
        pickRate: meta.pickRate, avgPlace: meta.avgPlace, top4: meta.top4,
        winRate: meta.winRate, recommendedItems: meta.recommendedItems
      }
    } : {});
  });
}

function cleanDatatftAbility(ability) {
  if (!ability) return ability;
  return Object.assign({}, ability, {
    // DataTFT doi khi de sot token noi bo, vi du RivalsAugment.AbilityTooltip.
    // Lux con co ba dong nhan tieng Trung; he so da duoc giu rieng trong scalings.
    description: String(ability.description || '').replace(/\{[^}]+\}/g, '')
      .split('\n').filter((line) => !/[\u3400-\u9fff]/.test(line)).join('\n').trim()
  });
}

function localizedTraits(traits) {
  let source = { dataVersion: null, traits: [] };
  try { source = JSON.parse(fs.readFileSync(DATATFT_TRAITS, 'utf8')); } catch (_) {}
  const byName = Object.fromEntries((source.traits || []).map((trait) => [trait.name, trait]));
  return (traits || []).map((trait) => {
    const extra = byName[trait.name];
    if (!extra) return trait;
    return Object.assign({}, trait, {
      description: extra.description || trait.description || '',
      datatft: { dataVersion: source.dataVersion, levels: extra.levels, unitIds: extra.unitIds }
    });
  });
}

/**
 * Ghep CDragon (apiName/icon/cong thuc chuan) voi VNTFT (ten/mo ta tieng Viet).
 * Cong thuc la khoa noi on dinh hon ten vi hai nguon dung hai ngon ngu khac nhau.
 */
function localizedItemCatalog(parsed) {
  let vi = {};
  try { vi = JSON.parse(fs.readFileSync(VI_ITEMS, 'utf8')); } catch (_) { return []; }

  const canonical = {};
  (parsed.items || []).concat(parsed.emblems || []).forEach((item) => {
    if (!item.composition || item.composition.length !== 2) return;
    canonical[recipeKey(item.composition.map(componentId))] = item;
  });

  const enrich = (item, category, active) => {
    const key = recipeKey(item.composition || []);
    const official = canonical[key] || null;
    return Object.assign({}, item, {
      category,
      active: active !== false,
      apiName: official && official.apiName,
      enName: official && official.name,
      icon: (official && official.icon) || item.icon || null,
      composition: item.composition || (official && official.composition) || []
    });
  };

  return []
    .concat((vi.baseItems || []).map((item) => enrich(item, 'standard', true)))
    .concat((vi.emblems || []).map((item) => enrich(item, 'emblem', true)))
    .concat((vi.lightItems || []).map((item) => enrich(item, 'radiant', true)))
    .concat((vi.artifacts || []).map((item) => enrich(item, 'artifact', true)))
    .concat((vi.supportItems || []).map((item) => enrich(item, 'support', false)));
}

function recipeKey(parts) {
  return (parts || []).filter(Boolean).slice().sort().join('+');
}

function componentId(apiName) {
  const value = String(apiName || '').toLowerCase();
  if (value === 'bf' || /bfsword/.test(value)) return 'bf';
  if (value === 'bow' || /recurvebow/.test(value)) return 'bow';
  if (value === 'rod' || /needlesslylargerod/.test(value)) return 'rod';
  if (value === 'tear' || /tearofthegoddess/.test(value)) return 'tear';
  if (value === 'vest' || /chainvest/.test(value)) return 'vest';
  if (value === 'cloak' || /negatroncloak/.test(value)) return 'cloak';
  if (value === 'belt' || /giantsbelt/.test(value)) return 'belt';
  if (value === 'glove' || /sparringgloves/.test(value)) return 'glove';
  if (value === 'spat' || /spatula/.test(value)) return 'spat';
  if (value === 'pan' || /fryingpan/.test(value)) return 'pan';
  return null;
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
  const seenByCost = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set() };
  parsed.champions.forEach((c) => {
    if (seenByCost[c.cost]) seenByCost[c.cost].add(String(c.variantGroup || c.name).toLowerCase());
  });
  Object.keys(byCost).forEach((cost) => { byCost[cost] = seenByCost[cost].size; });
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

  // Bien the (vd Lux Coven/Solar) la co che cua cung mot tuong, da gom bang variantGroup.

  if (problems.length) {
    console.warn('\nCANH BAO - du lieu trong bat thuong:\n  - ' + problems.join('\n  - ') +
      '\n  (dat TFT_SET_MUTATOR de chi dinh nhanh khac neu can)\n');
  }
}
