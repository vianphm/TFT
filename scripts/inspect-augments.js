'use strict';
const fs = require('fs');
const path = require('path');

const fb = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/shared/data/set-fallback.json'), 'utf8'));
console.log('Fallback augments count:', fb.augments ? fb.augments.length : 0);

const tiers = {};
(fb.augments || []).forEach(a => {
  tiers[a.tier] = (tiers[a.tier] || 0) + 1;
});
console.log('Tiers in fallback:', tiers);

console.log('\nSample augment 0:', fb.augments[0]);
console.log('\nSample augment 1:', fb.augments[1]);
console.log('\nSample augment 2:', fb.augments[2]);

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/shared/data/set18-raw.json'), 'utf8'));
console.log('Raw items count:', (raw.items || []).length);
const rawAugments = (raw.items || []).filter(i => i.isAugment || /augment/i.test(i.apiName || ''));
console.log('Raw augments matching filter:', rawAugments.length);
