'use strict';
/** Kiem thu phan rut gon du lieu cua ham /api/tft-data (khong goi mang). */
const assert = require('assert');
const api = require('../api/tft-data.js');
const cdragon = require('../src/renderer/shared/cdragon.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (err) { failed++; console.error('  LOI ' + name + '\n      ' + err.message); process.exitCode = 1; }
}

// Mot mieng du lieu giong that cua Community Dragon
const raw = {
  sets: {
    '13': { name: 'Set cu', champions: [], traits: [] },
    '18': {
      name: 'Tinh Linh',
      champions: [
        { apiName: 'TFT18_Ahri', name: 'Ahri', cost: 4, traits: ['Tinh Linh', 'Phap Su'], squareIcon: 'ASSETS/Characters/Ahri/HUD/Ahri_Square.TFT_Set18.tex' },
        { apiName: 'TFT18_Dummy', name: 'Bia tap ban', cost: 0, traits: [] },
        { apiName: 'TFT18_Garen', name: 'Garen', cost: 1, traits: ['Ve Binh'], squareIcon: 'ASSETS/Garen.dds' }
      ],
      traits: [
        { apiName: 'TFT18_TinhLinh', name: 'Tinh Linh', icon: 'x.tex', effects: [{ minUnits: 2 }, { minUnits: 4 }] }
      ]
    }
  },
  items: [
    { apiName: 'TFT_Item_InfinityEdge', name: 'Infinity Edge', composition: ['TFT_Item_BFSword', 'TFT_Item_SparringGloves'], icon: 'a.tex', desc: '<b>Chi mang</b> tang' },
    { apiName: 'TFT_Item_BFSword', name: 'B.F. Sword', composition: [], icon: 'ASSETS/Maps/Particles/TFT/Item_Icons/Hexcore/bfsword.tex' },
    { apiName: 'TFT18_Augment_Something', name: 'Loi nang cap X', icon: 'b.tex', desc: 'mo ta' }
  ]
};

console.log('\nDoc du lieu Community Dragon');
test('lay set moi nhat, khong lay set cu', () => {
  const data = cdragon.parseCdragon(raw);
  assert.strictEqual(data.setNumber, 18);
  assert.strictEqual(data.setName, 'Tinh Linh');
});
test('bo bia tap ban (gia 0) va tuong khong co toc he', () => {
  const data = cdragon.parseCdragon(raw);
  assert.deepStrictEqual(data.champions.map((c) => c.name), ['Garen', 'Ahri']);
});
test('sap xep tuong theo gia tang dan', () => {
  const data = cdragon.parseCdragon(raw);
  assert.ok(data.champions[0].cost <= data.champions[data.champions.length - 1].cost);
});
test('doi duong dan icon sang png tren CDN', () => {
  const data = cdragon.parseCdragon(raw);
  assert.ok(data.champions[0].icon.endsWith('.png'), data.champions[0].icon);
  assert.ok(data.champions[0].icon.startsWith('https://raw.communitydragon.org/'));
});
test('moc toc he doc tu effects', () => {
  const data = cdragon.parseCdragon(raw);
  assert.deepStrictEqual(data.traits[0].breakpoints, [2, 4]);
});
test('chi lay trang bi ghep tu 2 mon', () => {
  const data = cdragon.parseCdragon(raw);
  assert.deepStrictEqual(data.items.map((i) => i.name), ['Infinity Edge']);
});
test('nhan ra mon co ban va loi nang cap', () => {
  const data = cdragon.parseCdragon(raw);
  assert.deepStrictEqual(data.components.map((c) => c.name), ['B.F. Sword']);
  assert.strictEqual(data.augments.length, 1);
});
test('bo the html trong mo ta', () => {
  const data = cdragon.parseCdragon(raw);
  assert.strictEqual(data.items[0].desc, 'Chi mang tang');
});

console.log('\nRut gon cho dien thoai');
test('ban gon giu tuong va toc he, bo augment', () => {
  const slim = api.trim(cdragon.parseCdragon(raw));
  assert.strictEqual(slim.champions.length, 2);
  assert.strictEqual(slim.traits.length, 1);
  assert.strictEqual(slim.augments, undefined);
});
test('ban gon bo mo ta trang bi cho nhe', () => {
  const slim = api.trim(cdragon.parseCdragon(raw));
  assert.strictEqual(slim.items[0].desc, undefined);
  assert.strictEqual(slim.items[0].name, 'Infinity Edge');
});
test('ban gon nho hon ban day du', () => {
  const full = cdragon.parseCdragon(raw);
  assert.ok(JSON.stringify(api.trim(full)).length < JSON.stringify(full).length);
});

console.log(`\n${passed} phep thu da qua, ${failed} phep thu LOI.\n`);
if (failed) console.error(`==> CO ${failed} PHEP THU KHONG QUA <==\n`);
