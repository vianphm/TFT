'use strict';
const fs = require('fs');
const path = require('path');

const fb = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/shared/data/set-fallback.json'), 'utf8'));
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/shared/data/set18-raw.json'), 'utf8'));
const rawByApi = {};
(raw.items || []).forEach(item => {
  if (item.apiName) rawByApi[item.apiName] = item;
});

// Trait names in set
const traitNames = (fb.traits || []).map(t => t.name);

function detectTier(item, rawItem) {
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

  if (/emblem/i.test(str)) return 'gold'; // default emblems to gold

  return 'gold';
}

function detectTags(item) {
  const tags = [];
  const text = [
    item.name,
    item.desc,
    item.apiName
  ].filter(Boolean).join(' ').toLowerCase();

  // Emblem / Traits
  const isEmblem = /emblem|crest|crown|heart|soul|\+1 |trait/i.test(text) || (item.associatedTraits && item.associatedTraits.length > 0);
  if (isEmblem) tags.push('emblem');

  // Econ
  if (/\bgold\b|interest|streak|rich|fund|coin|gain \d+ gold|economy|tiền|vàng|lãi/i.test(text)) {
    tags.push('econ');
  }

  // XP / Leveling
  if (/\bxp\b|experience|level up|reach level|level \d+|kinh nghiệm|cấp/i.test(text)) {
    tags.push('xp');
  }

  // Reroll
  if (/reroll|refresh|free shop|roll|đổi lại/i.test(text)) {
    tags.push('reroll');
  }

  // Items
  if (/component|item|anvil|reforger|remover|glove|sword|bow|rod|tear|vest|cloak|belt|spatula|trang bị|món|đồ/i.test(text)) {
    tags.push('items');
  }

  // Combat
  if (/damage|health|armor|resist|attack speed|shield|heal|execute|combat|team gains|bonus stats|sát thương|máu|giáp|kháng/i.test(text)) {
    tags.push('combat');
  }

  if (tags.length === 0) tags.push('combat'); // default fallback

  return Array.from(new Set(tags));
}

function detectAssociatedTraits(item) {
  const text = [item.name, item.desc, item.apiName].join(' ').toLowerCase();
  const matched = [];
  traitNames.forEach(tn => {
    if (text.includes(tn.toLowerCase())) {
      matched.push(tn);
    }
  });
  return matched;
}

const enriched = (fb.augments || []).map(a => {
  const r = rawByApi[a.apiName];
  const tier = detectTier(a, r);
  const tags = detectTags(a);
  const associatedTraits = a.associatedTraits && a.associatedTraits.length > 0 
    ? a.associatedTraits 
    : detectAssociatedTraits(a);
  
  return {
    ...a,
    tier,
    tags,
    associatedTraits
  };
});

const tierCounts = {};
const tagCounts = {};
enriched.forEach(a => {
  tierCounts[a.tier] = (tierCounts[a.tier] || 0) + 1;
  a.tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
});

console.log('Tier distribution:', tierCounts);
console.log('Tag distribution:', tagCounts);
console.log('Total augments:', enriched.length);
console.log('Sample enriched augment:', enriched[1]);
