'use strict';
const fs = require('fs');
const path = require('path');

const fb = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/shared/data/set-fallback.json'), 'utf8'));
console.log('Total augments:', fb.augments.length);

const augmentsWithDesc = fb.augments.filter(a => a.desc && a.desc.length > 0);
console.log('Augments with desc:', augmentsWithDesc.length);

const augmentsWithoutDesc = fb.augments.filter(a => !a.desc || a.desc.length === 0);
console.log('Augments without desc:', augmentsWithoutDesc.length);
if (augmentsWithoutDesc.length > 0) {
  console.log('Sample without desc:', augmentsWithoutDesc.slice(0, 5));
}
