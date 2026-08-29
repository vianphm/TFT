'use strict';
/**
 * Boc tach du lieu trang bi mua 18 tu 3 trang da tai ve boi CI (vntft.com):
 *   - vntft-trang-bi.txt         -> trang bi co ban/tao tac/ho tro (ten, chi so, mo ta, nhom)
 *   - vntft-ghep-an.txt          -> an (bieu tuong toc he): ten, toc he duoc cho, chi so, mo ta
 *   - vntft-trang-bi-anh-sang.txt-> ban nang cap "Anh Sang" cua tung mon, kem mon goc
 *
 * Ca ba trang co chung mot dang: sau phan menu la MOT DANH SACH TEN (muc luc),
 * roi den cac KHOI LAP LAI: <ten> [+] <cac dong chi so> <mo ta...> cho den ten tiep theo.
 * Boc bang cach cat theo danh sach ten da biet tu chinh muc luc do.
 *
 * Chay: node scripts/parse-vntft-items.js
 * Ghi: data/sources/vntft-items-parsed.json
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data', 'sources');
const OUT = path.join(DIR, 'vntft-items-parsed.json');
const BUNDLED_OUT = path.join(__dirname, '..', 'src', 'shared', 'data', 'set18-items-vi.json');

const baseItems = parseItemPage(read('vntft-trang-bi.txt'), readHtml('vntft-trang-bi.html'));
const emblems = parseEmblemPage(read('vntft-ghep-an.txt'), readHtml('vntft-ghep-an.html'));
const lightItems = parseLightPage(read('vntft-trang-bi-anh-sang.txt'));
const artifacts = parseHtmlCards(readHtml('vntft-trang-bi-tao-tac.html'), 'artifact', true);
const supportItems = parseHtmlCards(readHtml('vntft-trang-bi-ho-tro.html'), 'support', false)
  .map((item) => Object.assign(item, { active: false, inactiveReason: 'VNTFT ghi nhom Ho Tro da bi xoa tu mua 15' }));

const result = { baseItems, emblems, lightItems, artifacts, supportItems };
fs.writeFileSync(OUT, JSON.stringify(result, null, 1), 'utf8');
fs.writeFileSync(BUNDLED_OUT, JSON.stringify(result, null, 1), 'utf8');

console.log(`Trang bi co ban: ${baseItems.length}`);
baseItems.slice(0, 5).forEach((i) => console.log(`  - ${i.name} [${i.category || '?'}]: ${i.stats.join(', ')}`));
console.log(`\nAn (${emblems.length}):`);
emblems.forEach((e) => console.log(`  - ${e.name} -> toc he "${e.trait}"`));
console.log(`\nDo Anh Sang (${lightItems.length}):`);
lightItems.slice(0, 5).forEach((i) => console.log(`  - ${i.name} (tu ${i.upgradesFrom || '?'}): ${i.stats.join(', ')}`));
console.log(`\nTao Tac: ${artifacts.length}; Ho Tro tham khao: ${supportItems.length}`);
console.log(`\nGhi vao ${path.relative(process.cwd(), OUT)}`);
console.log(`Dong goi vao ${path.relative(process.cwd(), BUNDLED_OUT)}`);

// ---------------------------------------------------------------------------

function read(name) {
  return fs.readFileSync(path.join(DIR, name), 'utf8').split('\n').map((l) => decodeEntities(l.trim()));
}

function readHtml(name) {
  return fs.readFileSync(path.join(DIR, name), 'utf8');
}

/** Tim danh sach ten trong phan muc luc: nam giua "Trang bị tft"/"Trang bị..." va khoi noi dung dau tien. */
function findTocNames(lines, tocMarkerRegex, stopWhenSeenTwice) {
  const start = lines.findIndex((l) => tocMarkerRegex.test(l));
  if (start < 0) return [];
  const names = [];
  const seen = new Set();
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (stopWhenSeenTwice && seen.has(line)) break; // ten dau tien lap lai = het muc luc, sang khoi noi dung
    if (/^(Tạo Tác|Hỗ Trợ|Ánh Sáng|Ấn|Siêu Linh|Siêu Thú)$/.test(line)) continue;
    names.push(line);
    seen.add(line);
    if (names.length > 60) break;
  }
  return names;
}

function parseItemPage(lines, html) {
  const names = findTocNames(lines, /^Ánh Sáng$/, true);
  const recipes = recipeMapFromHtml(html);
  return sliceBlocks(lines, names).map(({ name, block }) => ({
    name: name,
    category: null,
    composition: recipes[name] || [],
    stats: cleanBlock(block).filter((l) => /^[+\-]/.test(l) && !/^\+$/.test(l)),
    desc: cleanBlock(block).filter((l) => !/^[+\-]/.test(l) && l !== '+').join(' ')
  }));
}

/** Cat bo phan tran vao menu/quang cao khi mon cuoi cung khong co ranh gioi ro. */
function cleanBlock(block) {
  const stop = block.findIndex((l) => l === '-->' || l === 'Dành cho bạn' || /^Advertisements$/.test(l));
  return stop >= 0 ? block.slice(0, stop) : block;
}

function parseEmblemPage(lines, html) {
  const names = findTocNames(lines, /^Ấn Tiên Hắc Ám$/, true).filter((n) => n.startsWith('Ấn '));
  const recipes = recipeMapFromHtml(html);
  return sliceBlocks(lines, names).map(({ name, block }) => {
    const traitLine = block.find((l) => /nhận(?: được| thêm)?\s*(?:tộc\/hệ|hệ|tộc)\s/i.test(l));
    const traitMatch = traitLine
      ? /(?:tộc\/hệ|hệ|tộc)\s+([^.]+?)\s*\.?\s*(?:Nếu|$)/i.exec(traitLine)
      : null;
    const trait = traitMatch ? traitMatch[1].trim() : null;
    const clean = cleanBlock(block);
    return {
      name,
      trait: trait || null,
      composition: recipes[name] || [],
      stats: clean.filter((l) => /^[+\-]/.test(l) && !/^\+$/.test(l)),
      desc: clean.filter((l) => !/^[+\-]/.test(l) && l !== '+').join(' ')
    };
  });
}

/** Doc hai nguyen lieu ngay trong h4 cua tung cong thuc VNTFT. */
function recipeMapFromHtml(html) {
  const out = {};
  const card = /<h4[^>]*>([\s\S]*?)<\/h4>/gi;
  let match;
  while ((match = card.exec(html))) {
    const nameMatch = /<a[^>]*>([^<]+)<\/a>/i.exec(match[1]);
    if (!nameMatch) continue;
    const ingredients = [];
    const image = /<img[^>]+(?:alt|title)="([^"]+)"[^>]*>/gi;
    let imageMatch;
    while ((imageMatch = image.exec(match[1]))) {
      const id = componentId(decodeEntities(imageMatch[1].trim()));
      if (id) ingredients.push(id);
    }
    if (ingredients.length === 2) out[decodeEntities(nameMatch[1].trim())] = ingredients;
  }
  return out;
}

function componentId(name) {
  const ids = {
    'Kiếm BF': 'bf', 'Cung Gỗ': 'bow', 'Gậy Quá Khổ': 'rod',
    'Nước Mắt Nữ Thần': 'tear', 'Giáp Lưới': 'vest', 'Áo Choàng Bạc': 'cloak',
    'Đai Khổng Lồ': 'belt', 'Găng Đấu Tập': 'glove',
    'Xẻng Vàng': 'spat', 'Chảo Vàng': 'pan'
  };
  return ids[name] || null;
}

/** Boc cac the chi tiet Tạo Tác/Hỗ Trợ từ HTML, giu ca icon va goi y tuong. */
function parseHtmlCards(html, category, active) {
  const out = [];
  const card = /<li class="list_search[^>]*>([\s\S]*?)(?=<li class="list_search|<\/ul>\s*<\/div>)/gi;
  let match;
  while ((match = card.exec(html))) {
    const block = match[1];
    const heading = /<h4[^>]*>([\s\S]*?)<\/h4>/i.exec(block);
    if (!heading) continue;
    const name = decodeEntities(stripHtml(heading[1]));
    if (!name || out.some((item) => item.name === name)) continue;
    const iconMatch = /<img[^>]+src="([^"]+)"/i.exec(block);
    const stats = [];
    const statList = /<ul[^>]*>([\s\S]*?)<\/ul>/i.exec(block);
    if (statList) {
      const li = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let stat;
      while ((stat = li.exec(statList[1]))) stats.push(decodeEntities(stripHtml(stat[1])));
    }
    const descriptionParts = [];
    const paragraph = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let p;
    while ((p = paragraph.exec(block))) {
      if (/class="pt5"/i.test(p[0])) continue;
      const text = decodeEntities(stripHtml(p[1]));
      if (text && !stats.includes(text)) descriptionParts.push(text);
    }
    const recommendedMatch = /<p class="pt5"[^>]*>([\s\S]*?)<\/p>/i.exec(block);
    const recommended = recommendedMatch
      ? decodeEntities(stripHtml(recommendedMatch[1])).split(',').map((x) => x.trim()).filter(Boolean)
      : [];
    out.push({
      name: name,
      category: category,
      active: active,
      icon: iconMatch ? iconMatch[1] : null,
      stats: stats,
      desc: descriptionParts.join(' '),
      recommendedChampions: recommended
    });
  }
  return out;
}

function stripHtml(html) {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseLightPage(lines) {
  const names = findTocNames(lines, /^Ấn$/, true).filter((n) => / Ánh Sáng$/.test(n));
  return sliceBlocks(lines, names).map(({ name, block }) => {
    const upgradeLine = block.find((l) => l.includes('->') || l.includes('→'));
    const upgradesFrom = upgradeLine ? upgradeLine.split(/->|→/)[0].trim() : null;
    const clean = cleanBlock(block);
    return {
      name,
      upgradesFrom: upgradesFrom || null,
      stats: clean.filter((l) => /^[+\-]/.test(l) && !/^\+$/.test(l)),
      desc: clean.filter((l) => !/^[+\-]/.test(l) && l !== '+' && l !== upgradeLine).join(' ')
    };
  });
}

/** Voi moi ten trong danh sach, lay toan bo noi dung tu vi tri (2) cua ten do den truoc ten ke tiep. */
function sliceBlocks(lines, names) {
  if (!names.length) return [];
  const positions = names.map((name) => {
    // Bo qua lan xuat hien dau (trong muc luc) - tim lan thu hai tro di
    const first = lines.indexOf(name);
    const second = lines.indexOf(name, first + 1);
    return { name, at: second >= 0 ? second : -1 };
  }).filter((p) => p.at >= 0)
    // Thu tu trong muc luc khac thu tu xuat hien trong noi dung - phai sap theo VI TRI
    // moi tinh dung ranh gioi "tu day den ten tiep theo".
    .sort((a, b) => a.at - b.at);

  const out = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].at + 1;
    const end = i + 1 < positions.length ? positions[i + 1].at : Math.min(lines.length, start + 30);
    out.push({ name: positions[i].name, block: lines.slice(start, end) });
  }
  return out;
}

function decodeEntities(text) {
  return text.replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"');
}
