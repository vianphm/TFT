'use strict';
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/shared/data/set18-raw.json'), 'utf8'));
console.log('Top level keys in set18-raw.json:', Object.keys(raw));
if (raw.setData) console.log('setData count:', raw.setData.length, raw.setData.map(s => ({ mutator: s.mutator, name: s.name })));
if (raw.sets) console.log('sets keys:', Object.keys(raw.sets));
