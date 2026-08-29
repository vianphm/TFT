'use strict';
const fs = require('fs');
const path = require('path');
const { parseCdragon } = require('../src/renderer/shared/cdragon.js');

const rawPath = path.join(__dirname, '../src/shared/data/set18-raw.json');
const fallbackPath = path.join(__dirname, '../src/shared/data/set-fallback.json');

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const existingFallback = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));

const parsed = parseCdragon(raw, { mutator: 'TFTSet18' });

// Update augments in fallback
existingFallback.augments = parsed.augments;

fs.writeFileSync(fallbackPath, JSON.stringify(existingFallback, null, 1), 'utf8');

console.log('Updated set-fallback.json with', existingFallback.augments.length, 'augments.');
const tiers = {};
existingFallback.augments.forEach(a => { tiers[a.tier] = (tiers[a.tier] || 0) + 1; });
console.log('Tier distribution:', tiers);
console.log('Sample augment:', existingFallback.augments[1]);
