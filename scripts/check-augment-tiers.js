'use strict';
const fs = require('fs');
const path = require('path');

const fb = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/shared/data/set-fallback.json'), 'utf8'));
const nullTiers = (fb.augments || []).filter(a => a.tier === null);
console.log('Null tier count:', nullTiers.length);
console.log('First 10 null tier augments:', nullTiers.slice(0, 10).map(a => ({
  apiName: a.apiName,
  name: a.name,
  icon: a.icon
})));

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/shared/data/set18-raw.json'), 'utf8'));
const rawByApi = {};
(raw.items || []).forEach(item => {
  if (item.apiName) rawByApi[item.apiName] = item;
});

console.log('\nChecking raw item properties for null tier augments:');
nullTiers.slice(0, 5).forEach(a => {
  const r = rawByApi[a.apiName];
  console.log(a.apiName, '->', {
    price: r && r.price,
    icon: r && r.icon,
    tags: r && r.tags,
    name: r && r.name
  });
});
