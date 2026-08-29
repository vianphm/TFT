'use strict';
const fs = require('fs');
const path = require('path');
const { parseCdragon, listSetCandidates } = require('../src/renderer/shared/cdragon.js');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/shared/data/set18-raw.json'), 'utf8'));
const candidates = listSetCandidates(raw);
console.log('Candidates count:', candidates.length);
console.log('First candidate:', { source: candidates[0].source, mutator: candidates[0].mutator, number: candidates[0].number, champCount: candidates[0].champions });

const chosen = candidates.find(c => c.mutator === 'TFTSet18') || candidates[0];
console.log('Chosen champ sample apiNames:', chosen.entry.champions.slice(0, 5).map(c => c.apiName));

function itemsForSet(items, champions) {
  var counts = {};
  (champions || []).forEach(function (champ) {
    var match = /^([^_]+)_/.exec(champ.apiName || '');
    if (match) counts[match[1]] = (counts[match[1]] || 0) + 1;
  });
  console.log('Namespace counts:', counts);
  var namespace = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
  console.log('Top namespace:', namespace);
  if (!namespace) return items;
  var prefix = namespace + '_';
  var scoped = items.filter(function (item) { return String(item.apiName || '').indexOf(prefix) === 0; });
  console.log('Scoped items count:', scoped.length);
  var scopedRecipes = scoped.filter(function (i) { return i.composition && i.composition.length === 2; }).length;
  console.log('Scoped recipes count:', scopedRecipes);
  return scopedRecipes >= 30 ? scoped : items;
}

itemsForSet(raw.items, chosen.entry.champions);
