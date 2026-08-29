'use strict';
/**
 * Boc tach danh sach doi hinh tu data/sources/doihinhtft-doi-hinh.txt (da tai ve boi
 * fetch-web-sources.js) thanh JSON dung duoc trong app.
 *
 * Cau truc lap lai tren trang (xac dinh duoc bang mat khi doc file .txt):
 *   "Chép mã đội hình"
 *   <tier: S/A/B>
 *   <ten doi hinh>
 *   "Cấp N" hoac "Fast N"
 *   <do kho: De/Trung Binh/Kho>
 *   { "★★★"? , <ma tat 2 chu>, <ten tuong> } x N   (★★★ dung truoc nghia la tuong nay len 3 sao)
 *   <so>%  "Win Rate"
 *   <so>%  "Top 4"
 *
 * Chay: node scripts/parse-doihinhtft-comps.js
 * Ghi ra: data/sources/doihinhtft-comps.json (danh sach tho, xem lai truoc khi dung)
 *         và in thang dang JSON de dan vao sample-comps.js neu ung y.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'data', 'sources', 'doihinhtft-doi-hinh.txt');
const OUT = path.join(__dirname, '..', 'data', 'sources', 'doihinhtft-comps.json');

const lines = fs.readFileSync(SRC, 'utf8').split('\n').map((l) => decodeEntities(l.trim()));

const comps = [];
let i = 0;
while (i < lines.length) {
  if (lines[i] !== 'Chép mã đội hình') { i++; continue; }
  i++; // bo dong danh dau

  if (!/^[SAB]$/.test(lines[i])) { continue; } // khong dung dinh dang, bo qua khoi nay
  const tier = lines[i]; i++;

  const name = lines[i]; i++;

  const styleLine = lines[i]; i++;
  const style = /^Fast \d+$/.test(styleLine) ? styleLine
    : /^Cấp \d+$/.test(styleLine) ? styleLine.replace('Cấp', 'Lên cấp')
    : styleLine;

  const difficulty = lines[i]; i++;

  const units = [];
  while (i < lines.length && lines[i] !== 'Win Rate' && !/^\d+[,.]?\d*%$/.test(lines[i] + '%') ) {
    let star = 2;
    if (lines[i] === '★★★') { star = 3; i++; }
    else if (lines[i] === '★★') { star = 2; i++; }

    const code = lines[i]; i++;
    // Ma tat luon 2 chu; neu dong tiep theo khong giong ten day du thi day khong phai khoi tuong nua
    if (!code || code.length > 3) { i -= star === 3 || star === 2 ? 0 : 0; break; }
    const fullName = lines[i]; i++;
    if (!fullName) break;
    units.push({ name: fullName, star, carry: units.length === 0 });
  }

  // Bo qua toi khi gap "Win Rate" / "Top 4" de dong bo cho khoi tiep theo
  let winRate = null, top4 = null;
  while (i < lines.length && lines[i] !== 'Chép mã đội hình') {
    if (lines[i] === 'Win Rate' && i > 0) winRate = lines[i - 1];
    if (lines[i] === 'Top 4' && i > 0) top4 = lines[i - 1];
    if (lines[i] === '▼') { i++; break; }
    i++;
  }

  if (name && units.length >= 4) {
    comps.push({
      id: 'dhtft-' + comps.length,
      name,
      tier,
      style,
      difficulty,
      winRate,
      top4,
      traits: [],
      econ: { levelAt: {}, rollDownAt: '', keepGold: 50 },
      notes: `Nguồn: doihinhtft.vn, tự động bóc từ trang.${winRate ? ' Win rate ' + winRate + ', Top 4 ' + top4 + '.' : ''}`,
      units: units.map((u, idx) => ({ ...u, cost: null, row: null, col: null, items: [] }))
    });
  }
}

fs.writeFileSync(OUT, JSON.stringify(comps, null, 1), 'utf8');
console.log(`Boc tach duoc ${comps.length} doi hinh -> ${path.relative(process.cwd(), OUT)}`);
comps.forEach((c) => {
  console.log(`  [${c.tier}] ${c.name} (${c.style}) - ${c.units.length} tuong` +
    (c.winRate ? ` - WR ${c.winRate}` : ''));
});

function decodeEntities(text) {
  return text.replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
}
