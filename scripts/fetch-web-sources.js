'use strict';
/**
 * Tai cac trang web ve repo (chay tren may CI - noi khong bi chan mang).
 *
 * Voi trang tinh thi tai thang; voi trang dung JavaScript de dung noi dung
 * (metatft, vntft) thi mo bang trinh duyet that roi luu HTML sau khi da dung xong.
 *
 * Ket qua: data/sources/<ten>.html (nguyen ban) + <ten>.txt (chi con chu)
 * kem bao cao cho biet trang do co that su chua danh sach tuong hay khong.
 *
 *   node scripts/fetch-web-sources.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sources.json'), 'utf8'));
const OUT_DIR = path.join(ROOT, 'data', 'sources');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

let known = { champions: [], traits: [] };
try {
  const set = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'shared', 'data', 'set-fallback.json'), 'utf8'));
  known.champions = (set.champions || []).map((c) => c.name);
  known.traits = (set.traits || []).map((t) => t.name);
} catch (err) {
  console.warn('Chua co du lieu set de doi chieu:', err.message);
}

main().catch((err) => {
  console.error('Loi:', err.message);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = [];

  for (const source of SOURCES) {
    process.stdout.write(`\n[${source.name}] ${source.url}\n`);
    try {
      const html = source.render ? await renderPage(source.url) : await fetchPage(source.url);
      const text = toText(html);
      fs.writeFileSync(path.join(OUT_DIR, `${source.name}.html`), html, 'utf8');
      fs.writeFileSync(path.join(OUT_DIR, `${source.name}.txt`), text, 'utf8');

      const hits = countHits(text);
      report.push({ name: source.name, url: source.url, bytes: html.length, textBytes: text.length, ...hits });
      console.log(`  ${(html.length / 1024).toFixed(0)} KB html, ${(text.length / 1024).toFixed(0)} KB chu` +
        ` | nhan ra ${hits.champions} ten tuong, ${hits.traits} toc he` +
        (hits.champions < 10 ? '  <-- trang nay khong chua danh sach tuong o dang doc duoc' : ''));
    } catch (err) {
      console.error(`  that bai: ${err.message}`);
      report.push({ name: source.name, url: source.url, error: err.message });
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, '_bao-cao.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log('\nBao cao: data/sources/_bao-cao.json');
}

function fetchPage(url) {
  return fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'vi,en;q=0.8' } })
    .then((res) => {
      if (!res.ok) throw new Error('may chu tra ve ' + res.status);
      return res.text();
    });
}

/** Mo bang Chromium that de trang kip dung noi dung bang JavaScript. */
async function renderPage(url) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ userAgent: UA, viewport: { width: 1440, height: 2200 } });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    // Cuon xuong cho phan tai dan (lazy load) kip hien
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(700);
    }
    return await page.content();
  } finally {
    await browser.close();
  }
}

function toText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .split('\n').map((line) => line.trim()).filter(Boolean)
    .join('\n');
}

function countHits(text) {
  const lower = text.toLowerCase();
  const hit = (list) => list.filter((name) => name && lower.includes(name.toLowerCase())).length;
  return { champions: hit(known.champions), traits: hit(known.traits) };
}
