'use strict';
const fs = require('fs');
const path = require('path');

const sampleCompsPath = path.join(__dirname, '../src/shared/data/sample-comps.js');
const blitzStatsPath = path.join(__dirname, '../src/shared/data/set18-champion-stats-blitz.json');
const setFallbackPath = path.join(__dirname, '../src/shared/data/set-fallback.json');
const analyzer = require('../src/renderer/shared/analyzer.js');

const blitz = JSON.parse(fs.readFileSync(blitzStatsPath, 'utf8'));
const fb = JSON.parse(fs.readFileSync(setFallbackPath, 'utf8'));

// Build champion lookup
const champByName = {};
const champByApi = {};
(fb.champions || []).forEach(c => {
  champByName[c.name.toLowerCase()] = c;
  if (c.variantGroup) champByName[c.variantGroup.toLowerCase()] = c;
  champByApi[c.apiName.toLowerCase()] = c;
});

const blitzByChamp = {};
(blitz.champions || []).forEach(c => {
  blitzByChamp[c.name.toLowerCase()] = c;
  if (c.apiName) blitzByChamp[c.apiName.toLowerCase()] = c;
});

// Load existing comps
let rawFile = fs.readFileSync(sampleCompsPath, 'utf8');
const compsMatch = rawFile.match(/const SAMPLE_COMPS = (\[[\s\S]*\]);/);
if (!compsMatch) {
  console.error('Could not find SAMPLE_COMPS array');
  process.exit(1);
}

const comps = eval('(' + compsMatch[1] + ')');

comps.forEach(comp => {
  // 1. Calculate traits
  const breakdown = analyzer.traitBreakdown(comp.units, fb);
  comp.traits = breakdown.active.map(t => ({
    name: t.name,
    tier: t.tier,
    count: t.count
  }));

  // 2. Separate frontline and backline
  let frontCol = 0;
  let backCol = 0;

  comp.units.forEach((unit, idx) => {
    const champ = champByName[unit.name.toLowerCase()];
    const role = (champ && (champ.role || (champ.datatft && champ.datatft.role))) || '';
    const isTank = /tank|vanguard|defender|brawler|bruiser|guardian|frontline/i.test(role) ||
                   (champ && (champ.stats && champ.stats.range === 1));

    // Items
    const blitzData = blitzByChamp[unit.name.toLowerCase()];
    if (unit.carry) {
      if (blitzData && blitzData.recommendedItems) {
        unit.items = blitzData.recommendedItems.slice(0, 3).map(i => i.name);
      }
      unit.row = isTank ? 0 : 3;
      unit.col = isTank ? (frontCol++) : (backCol++);
    } else {
      // Main tank (first non-carry tank)
      if (isTank && frontCol === 0 && blitzData && blitzData.recommendedItems) {
        unit.items = blitzData.recommendedItems.slice(0, 3).map(i => i.name);
      } else {
        unit.items = [];
      }
      unit.row = isTank ? 0 : 3;
      unit.col = isTank ? (frontCol++) : (backCol++);
    }

    if (champ) {
      unit.cost = champ.cost;
    }
  });

  // 3. Recommended augments for this comp
  const state = {
    board: comp.units,
    hp: 80,
    gold: 50,
    stage: '3-2'
  };
  const rankedAugs = analyzer.rankAugments(fb.augments || [], state, fb);
  comp.recommendedAugments = rankedAugs.slice(0, 6).map(r => ({
    name: r.augment.name,
    tier: r.tier,
    score: r.score,
    reason: r.reason
  }));
});

const header = `'use strict';

/**
 * Doi hinh meta mua 18 (Dai Ngan Ky Bi), phien ban 18.1.
 * Tu dong tong hop tu Doihinhtft va Blitz.gg.
 * Gom day du: vi tri ban co, trang bi goi y, toc he va loi khuyen dung.
 */
const SAMPLE_COMPS = `;

const footer = `;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SAMPLE_COMPS;
}
`;

fs.writeFileSync(sampleCompsPath, header + JSON.stringify(comps, null, 2) + footer, 'utf8');
console.log('Enriched', comps.length, 'sample comps successfully.');
