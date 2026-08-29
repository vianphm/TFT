'use strict';
/**
 * Tao du lieu du phong (src/shared/data/set-fallback.json) tu bang cong thuc trong tables.js.
 * Du lieu tuong cua tung set khong nam o day - app tai truc tiep tu Community Dragon khi chay.
 * Chay lai: node scripts/make-fallback.js
 */
const fs = require('fs');
const path = require('path');
const tables = require('../src/renderer/shared/tables.js');

const items = Object.keys(tables.RECIPES).map((key) => ({
  apiName: key,
  name: tables.RECIPES[key],
  composition: key.split('+'),
  desc: tables.ITEM_NOTES[tables.RECIPES[key]] || ''
}));

const payload = {
  source: 'bundled',
  syncedAt: null,
  setNumber: null,
  setName: 'Chua dong bo du lieu set',
  champions: [],
  traits: [],
  components: tables.COMPONENTS.map((c) => ({ apiName: c.id, name: c.name, vi: c.vi, stat: c.stat })),
  items,
  augments: []
};

const out = path.join(__dirname, '..', 'src', 'shared', 'data', 'set-fallback.json');
fs.writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8');
console.log('da tao set-fallback.json voi', items.length, 'cong thuc');
