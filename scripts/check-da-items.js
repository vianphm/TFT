'use strict';
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/shared/data/set18-raw.json'), 'utf8'));

const daItems = (raw.items || []).filter(i => String(i.apiName).startsWith('DA_'));
console.log('Total DA_ items/augments in raw:', daItems.length);

const daAugments = daItems.filter(i => i.isAugment || /augment/i.test(i.apiName || ''));
console.log('DA_ augments count:', daAugments.length);

const daRecipes = daItems.filter(i => i.composition && i.composition.length === 2);
console.log('DA_ recipe items count:', daRecipes.length);

const allRecipes = (raw.items || []).filter(i => i.composition && i.composition.length === 2);
console.log('All recipe items count in raw:', allRecipes.length);
