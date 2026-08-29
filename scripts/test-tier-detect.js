'use strict';
const fs = require('fs');
const path = require('path');

const fb = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/shared/data/set-fallback.json'), 'utf8'));
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/shared/data/set18-raw.json'), 'utf8'));
const rawByApi = {};
(raw.items || []).forEach(item => {
  if (item.apiName) rawByApi[item.apiName] = item;
});

function detectTier(item, rawItem) {
  // Check CDragon tags first if available
  const tags = (rawItem && rawItem.tags) || (item && item.tags) || [];
  if (tags.includes('{cf1fd3af}')) return 'prismatic';
  if (tags.includes('{ce1fd21c}')) return 'gold';
  if (tags.includes('{d11fd6d5}')) return 'silver';

  const str = [
    item && item.apiName,
    item && item.name,
    item && item.icon,
    rawItem && rawItem.icon
  ].filter(Boolean).join(' ');

  if (/(?:_iii\b|-iii\b|\biii\b|tier3|prismatic|-t3\b|3\.png|3\.tex|_3\b)/i.test(str)) return 'prismatic';
  if (/(?:_ii\b|-ii\b|\bii\b|tier2|gold|-t2\b|2\.png|2\.tex|_2\b)/i.test(str)) return 'gold';
  if (/(?:_i\b|-i\b|\bi\b|tier1|silver|-t1\b|1\.png|1\.tex|_1\b)/i.test(str)) return 'silver';

  return null;
}

let counts = { silver: 0, gold: 0, prismatic: 0, unknown: 0 };
let unknowns = [];

fb.augments.forEach(a => {
  const r = rawByApi[a.apiName];
  const tier = detectTier(a, r);
  if (tier) counts[tier]++;
  else {
    counts.unknown++;
    unknowns.push({ apiName: a.apiName, name: a.name, icon: a.icon, tags: r && r.tags });
  }
});

console.log('Tier distribution with improved detection:', counts);
if (unknowns.length > 0) {
  console.log('Remaining unknowns (' + unknowns.length + '):', unknowns);
}
