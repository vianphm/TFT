'use strict';
/**
 * Gom ban web cho dien thoai vao dist-mobile/ (mot thu muc phang, khong phu thuoc gi).
 * Dung cho: dua len GitHub Pages, hoac nhet vao assets cua app Android.
 *   node scripts/build-mobile.js [thu-muc-dich]
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'dist-mobile');

const SHARED = ['style.css', 'tables.js', 'calc.js', 'analyzer.js', 'cdragon.js'];
const ICONS = [['icon-192.png', 'icon-192.png'], ['icon-512.png', 'icon-512.png'], ['icon.png', 'icon.png']];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'shared'), { recursive: true });

for (const file of fs.readdirSync(path.join(root, 'src', 'mobile'))) {
  fs.copyFileSync(path.join(root, 'src', 'mobile', file), path.join(out, file));
}
for (const file of SHARED) {
  fs.copyFileSync(path.join(root, 'src', 'renderer', 'shared', file), path.join(out, 'shared', file));
}
for (const [from, to] of ICONS) {
  fs.copyFileSync(path.join(root, 'assets', from), path.join(out, to));
}

const count = walk(out).length;
console.log(`da gom ${count} file vao ${out}`);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
