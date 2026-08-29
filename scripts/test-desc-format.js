'use strict';
const fs = require('fs');
const path = require('path');

const fb = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/shared/data/set-fallback.json'), 'utf8'));

function formatDesc(desc, effects) {
  if (!desc) return '';
  return desc.replace(/@([^@]+)@/g, (match, expr) => {
    let mult = 1;
    let varName = expr;
    if (expr.includes('*')) {
      const parts = expr.split('*');
      varName = parts[0].trim();
      mult = parseFloat(parts[1].trim()) || 1;
    }
    if (effects && effects[varName] !== undefined) {
      let val = effects[varName] * mult;
      return Math.round(val * 100) / 100;
    }
    return match;
  });
}

console.log('Testing formatted descriptions:');
fb.augments.slice(1, 6).forEach(a => {
  console.log('\n[' + a.name + '] (' + a.tier + ')');
  console.log('Raw:', a.desc);
  console.log('Formatted:', formatDesc(a.desc, a.effects));
});
