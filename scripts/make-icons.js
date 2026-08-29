'use strict';
/**
 * Tao icon PNG (tray + icon app) bang code de repo khong can file nhi phan la.
 * Chay lai: node scripts/make-icons.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const GOLD = [200, 170, 110];
const DARK = [13, 17, 23];

function hexagon(size, cx, cy, r) {
  // Tra ve ham kiem tra diem nam trong luc giac deu (dinh huong len).
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 90);
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return (x, y) => {
    let inside = false;
    for (let i = 0, j = 5; i < 6; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}

function render(size) {
  const px = Buffer.alloc(size * size * 4, 0);
  const c = size / 2;
  const outer = hexagon(size, c, c, size * 0.47);
  const inner = hexagon(size, c, c, size * 0.33);
  const barW = size * 0.30;
  const barH = size * 0.075;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px0 = (y * size + x) * 4;
      const sx = x + 0.5;
      const sy = y + 0.5;
      if (!outer(sx, sy)) continue;
      let color = GOLD;
      let alpha = 255;
      if (inner(sx, sy)) {
        color = DARK;
        // Chu "T" o giua
        const inBar = Math.abs(sx - c) <= barW / 2 && sy >= c - size * 0.15 && sy <= c - size * 0.15 + barH;
        const inStem = Math.abs(sx - c) <= barH / 2 && sy >= c - size * 0.15 && sy <= c + size * 0.16;
        if (inBar || inStem) color = GOLD;
      }
      px[px0] = color[0];
      px[px0 + 1] = color[1];
      px[px0 + 2] = color[2];
      px[px0 + 3] = alpha;
    }
  }
  return px;
}

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const chunks = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])];
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  chunks.push(chunk('IHDR', ihdr));
  chunks.push(chunk('IDAT', zlib.deflateSync(raw, { level: 9 })));
  chunks.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

let table = null;
function crc32(buf) {
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });
for (const [name, size] of [['tray.png', 32], ['icon.png', 256], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  fs.writeFileSync(path.join(outDir, name), png(size, render(size)));
  console.log('da tao', name, size + 'px');
}
