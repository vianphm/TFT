'use strict';
/** Chuyen HTML da render cua DataTFT Database/Wisps thanh JSON de app su dung. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'sources', 'datatft-database-charms.html');
const OUT = path.join(ROOT, 'src', 'shared', 'data', 'set18-charms.json');

const html = fs.readFileSync(SRC, 'utf8');
const chunks = html.split(/(?=<div[^>]*class="card-item charm-item")/g).slice(1);
const charms = chunks.map(parseCard).filter((row) => row.name);

fs.writeFileSync(OUT, JSON.stringify({
  source: 'https://www.datatft.com/database#charm',
  dataVersion: '18.1',
  parsedAt: new Date().toISOString(),
  charms
}, null, 1), 'utf8');
console.log(`Da boc ${charms.length} Wisp -> ${path.relative(process.cwd(), OUT)}`);

function parseCard(card) {
  const name = field(card, 'charm-title');
  const desc = field(card, 'charm-desc');
  const roundText = field(card, 'charm-label').replace(/^回合：/, '');
  const image = attr(card, /<img[^>]*src="([^"]+)"[^>]*class="charm-type-img"/i);
  const categoryMatch = image.match(/\/([^/]+)_tier\d+\./i);
  const baseEnd = card.indexOf('class="charm-variant-list"');
  const base = baseEnd >= 0 ? card.slice(0, baseEnd) : card;
  const costMatch = base.match(/class="charm-cost"[\s\S]*?<div[^>]*>(\d+)<\/div>/i);
  const variants = [];
  const variantParts = card.split(/(?=<div[^>]*class="charm-variant charm-variant-)/g).slice(1);
  variantParts.forEach((part) => {
    const title = field(part, 'charm-variant-title');
    const variantCost = part.match(/class="charm-variant-cost"[\s\S]*?<div[^>]*>(\d+)<\/div>/i);
    variants.push({
      type: /prismatic/i.test(title) ? 'prismatic' : 'upgrade',
      cost: variantCost ? Number(variantCost[1]) : 0,
      description: field(part, 'charm-desc')
    });
  });
  return {
    name,
    category: categoryMatch ? categoryMatch[1] : 'misc',
    cost: costMatch ? Number(costMatch[1]) : 0,
    description: desc,
    rounds: roundText,
    icon: image || null,
    variants
  };
}

function field(input, className) {
  const match = input.match(new RegExp('class="[^"]*' + className + '[^"]*"[^>]*>([\\s\\S]*?)<\\/div>', 'i'));
  return strip(match ? match[1] : '');
}

function attr(input, pattern) {
  const match = input.match(pattern);
  return match ? decode(match[1]) : '';
}

function strip(value) {
  return decode(String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function decode(value) {
  return String(value).replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
