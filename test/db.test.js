'use strict';
/** Kiem thu lop truy van database cua set. */
const assert = require('assert');
const db = require('../src/renderer/shared/db.js');
const calc = require('../src/renderer/shared/calc.js');
const tables = require('../src/renderer/shared/tables.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (err) { failed++; console.error('  LOI ' + name + '\n      ' + err.message); process.exitCode = 1; }
}

// Set gia lap: 3 tuong 1 vang, 2 tuong 4 vang, 1 tuong 5 vang
const dataset = {
  setName: 'Set thu', setNumber: 18,
  champions: [
    { name: 'A', cost: 1, traits: ['Tinh Linh', 'Ve Binh'] },
    { name: 'B', cost: 1, traits: ['Tinh Linh'] },
    { name: 'C', cost: 1, traits: ['Ve Binh'] },
    { name: 'D', cost: 4, traits: ['Tinh Linh', 'Phap Su'] },
    { name: 'E', cost: 4, traits: ['Phap Su'] },
    { name: 'F', cost: 5, traits: ['Doc Ton'] }
  ],
  traits: [
    { name: 'Tinh Linh', breakpoints: [2, 4, 6] },
    { name: 'Ve Binh', breakpoints: [2, 4] },
    { name: 'Phap Su', breakpoints: [2, 4] },
    { name: 'Doc Ton', breakpoints: [1] }
  ]
};

console.log('\nDanh chi muc');
test('nhom tuong theo gia', () => {
  const idx = db.index(dataset);
  assert.strictEqual(idx.byCost[1].length, 3);
  assert.strictEqual(idx.byCost[4].length, 2);
  assert.strictEqual(idx.byCost[5].length, 1);
  assert.strictEqual(idx.byCost[2].length, 0);
});
test('nhom tuong theo toc he', () => {
  const idx = db.index(dataset);
  assert.deepStrictEqual(idx.byTrait['Tinh Linh'].map((c) => c.name), ['A', 'B', 'D']);
});
test('tra cuu theo ten khong phan biet hoa thuong', () => {
  const idx = db.index(dataset);
  assert.strictEqual(idx.byName['d'].cost, 4);
});
test('moc toc he duoc sap xep va bo so 0', () => {
  const idx = db.index({ champions: [], traits: [{ name: 'X', breakpoints: [6, 0, 2, 4] }] });
  assert.deepStrictEqual(idx.traitDefs['X'].breakpoints, [2, 4, 6]);
});
test('toc he chi co o tuong van duoc ghi nhan', () => {
  const idx = db.index({
    champions: [{ name: 'Z', cost: 1, traits: ['Bieu Tuong La'] }],
    traits: []
  });
  assert.ok(idx.traitDefs['Bieu Tuong La']);
  assert.deepStrictEqual(idx.traitDefs['Bieu Tuong La'].breakpoints, []);
});

console.log('\nKho tuong suy tu du lieu that');
test('dem so tuong moi muc gia tu du lieu, khong dung bang cung', () => {
  const pool = db.poolFromDataset(dataset);
  assert.strictEqual(pool[1].champions, 3);
  assert.strictEqual(pool[4].champions, 2);
  assert.strictEqual(pool[1].derived, true);
});
test('giu nguyen so ban sao moi tuong theo quy dinh cua Riot', () => {
  const pool = db.poolFromDataset(dataset);
  assert.strictEqual(pool[1].copies, tables.POOL[1].copies);
  assert.strictEqual(pool[4].copies, tables.POOL[4].copies);
});
test('bang doi chieu chi ro cho nao lech voi bang cung', () => {
  const diff = db.poolDiff(dataset);
  const row4 = diff.find((r) => r.cost === 4);
  assert.strictEqual(row4.hardcoded, tables.POOL[4].champions);
  assert.strictEqual(row4.actual, 2);
  assert.strictEqual(row4.changed, true);
});
test('kho tuong that lam doi ti le roll', () => {
  const before = calc.slotProbability({ level: 8, cost: 4, copiesOwnedByYou: 0 });
  calc.setPool(db.poolFromDataset(dataset));   // set nay chi co 2 tuong 4 vang -> de trung hon
  const after = calc.slotProbability({ level: 8, cost: 4, copiesOwnedByYou: 0 });
  calc.resetPool();
  assert.ok(after > before, `${after} phai > ${before}`);
  assert.strictEqual(calc.getPool()[4].champions, tables.POOL[4].champions);
});

console.log('\nTra cuu phuc vu phan tich');
test('toc he cua mot tuong kem moc va so tuong cung toc', () => {
  const rows = db.traitsOf(dataset, 'a');
  assert.strictEqual(rows.length, 2);
  const tinhLinh = rows.find((r) => r.name === 'Tinh Linh');
  assert.deepStrictEqual(tinhLinh.breakpoints, [2, 4, 6]);
  assert.strictEqual(tinhLinh.poolSize, 3);
});
test('tuong khong co trong set thi tra ve rong', () => {
  assert.deepStrictEqual(db.traitsOf(dataset, 'Khong Co'), []);
});
test('goi y tuong re nhat de bat moc', () => {
  const picks = db.cheapestForTrait(dataset, 'Tinh Linh', 2);
  assert.deepStrictEqual(picks.map((c) => c.name), ['A', 'B']);
});
test('chan gia toi da khi goi y', () => {
  const picks = db.cheapestForTrait(dataset, 'Phap Su', 2, { maxCost: 3 });
  assert.strictEqual(picks.length, 0);
});
test('bo qua tuong dang bi loai tru', () => {
  const picks = db.cheapestForTrait(dataset, 'Tinh Linh', 2, { exclude: ['A'] });
  assert.deepStrictEqual(picks.map((c) => c.name), ['B', 'D']);
});
test('tom tat set', () => {
  const s = db.summary(dataset);
  assert.strictEqual(s.champions, 6);
  assert.strictEqual(s.traits, 4);
  assert.strictEqual(s.biggestTraits[0].name, 'Tinh Linh');
});

console.log('\nChi muc va tra cuu Augments');
const datasetWithAugments = Object.assign({}, dataset, {
  augments: [
    { name: 'Kinh Te I', tier: 'silver', tags: ['econ'], desc: 'Vang' },
    { name: 'Giao Tranh II', tier: 'gold', tags: ['combat'], desc: 'Sat thuong' },
    { name: 'An Tinh Linh', tier: 'gold', tags: ['emblem'], associatedTraits: ['Tinh Linh'], desc: 'Nhan An' },
    { name: 'Sieu Cap III', tier: 'prismatic', tags: ['combat', 'items'], desc: 'Do anh sang' }
  ]
});

test('nhom augment theo tier va tag', () => {
  const idx = db.index(datasetWithAugments);
  assert.strictEqual(idx.augmentsByTier.silver.length, 1);
  assert.strictEqual(idx.augmentsByTier.gold.length, 2);
  assert.strictEqual(idx.augmentsByTier.prismatic.length, 1);
  assert.strictEqual(idx.augmentsByTag.combat.length, 2);
  assert.strictEqual(idx.augmentsByTag.econ.length, 1);
  assert.strictEqual(idx.augmentsByTag.emblem.length, 1);
});

test('tra cuu va tim kiem augment theo ten, tier, tag', () => {
  const resultsByQuery = db.searchAugments(datasetWithAugments, 'Giao Tranh');
  assert.strictEqual(resultsByQuery.length, 1);
  assert.strictEqual(resultsByQuery[0].tier, 'gold');

  const resultsByTier = db.searchAugments(datasetWithAugments, '', { tier: 'prismatic' });
  assert.strictEqual(resultsByTier.length, 1);
  assert.strictEqual(resultsByTier[0].name, 'Sieu Cap III');

  const resultsByTrait = db.searchAugments(datasetWithAugments, '', { trait: 'Tinh Linh' });
  assert.strictEqual(resultsByTrait.length, 1);
  assert.strictEqual(resultsByTrait[0].name, 'An Tinh Linh');
});

console.log('\nTra cuu Toc He');
test('searchTraits tim kiem va tra ve day du ten tieng Viet, breakpoints va tuong', () => {
  const traits = db.searchTraits(dataset, 'Tinh Linh');
  assert.strictEqual(traits.length, 1);
  assert.strictEqual(traits[0].name, 'Tinh Linh');
  assert.deepStrictEqual(traits[0].breakpoints, [2, 4, 6]);
  assert.strictEqual(traits[0].champions.length, 3);
});

console.log(`\n${passed} phep thu da qua, ${failed} phep thu LOI.\n`);
if (failed) console.error(`==> CO ${failed} PHEP THU KHONG QUA <==\n`);


