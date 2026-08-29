'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 7890;
const ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json'
};

function startServer() {
  const server = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') reqPath = '/src/mobile/index.html';
    if (!reqPath.startsWith('/src') && !reqPath.startsWith('/assets') && !reqPath.startsWith('/data') && !reqPath.startsWith('/api')) {
      reqPath = '/src' + reqPath;
    }
    const fullPath = path.join(ROOT, reqPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(fullPath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + reqPath);
    }
  });

  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`Test HTTP server started at http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

function findBrowser() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  return candidates.find((c) => fs.existsSync(c)) || null;
}

function runHeadlessCheck(browserPath, url) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-extensions',
      '--dump-dom',
      url
    ];
    const proc = spawn(browserPath, args);
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { err += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0 && out.length > 100) {
        resolve({ html: out, stderr: err });
      } else {
        reject(new Error(`Headless check failed with code ${code}: ${err}`));
      }
    });
  });
}

async function main() {
  console.log('=== KHOI CHAY E2E HEADLESS BROWSER TESTING ===\n');
  const server = await startServer();
  const browser = findBrowser();
  if (!browser) {
    console.error('Khong tim thay Chrome hoac Edge tren may.');
    server.close();
    process.exit(1);
  }
  console.log('Su dung trinh duyet:', browser);

  let passed = 0;
  let failed = 0;

  async function testPage(name, url, expectedSnippets) {
    try {
      const res = await runHeadlessCheck(browser, url);
      for (const snippet of expectedSnippets) {
        if (!res.html.includes(snippet)) {
          throw new Error(`Thieu noi dung mong doi: "${snippet}"`);
        }
      }
      passed++;
      console.log(`  ok  [E2E] ${name}`);
    } catch (err) {
      failed++;
      console.error(`  LOI [E2E] ${name}: ${err.message}`);
      process.exitCode = 1;
    }
  }

  // 1. Mobile Web App
  await testPage('Mobile Web App - Giao dien Touch 7 Tab & Reroll Planner', `http://127.0.0.1:${PORT}/src/mobile/index.html`, [
    'TFT Companion',
    'id="mRerollCompSelect"',
    'id="mRerollStrategy"',
    'id="mRerollList"',
    'id="mOpponentsList"',
    'id="mFreeCompsResult"',
    'id="mCounterAdviceResult"'
  ]);

  // 2. In-Game Overlay
  await testPage('In-Game Overlay - HUD Controls & Auto-Pilot Advisor', `http://127.0.0.1:${PORT}/src/renderer/overlay/overlay.html`, [
    'hud',
    'overlayAdviceResult',
    'data-widget="odds"',
    'data-widget="econ"',
    'data-widget="augments"',
    'data-widget="advisor"'
  ]);

  // 3. PC Dashboard
  await testPage('PC Dashboard - Comps, Scout & Auto-Updater', `http://127.0.0.1:${PORT}/src/renderer/dashboard/dashboard.html`, [
    'updateBanner',
    'checkUpdateBtn',
    'data-page="scout"',
    'freeCompsResult',
    'counterAdviceResult'
  ]);

  // 4. Settings Window
  await testPage('Settings Window - Tu dong nhan dien & Phim tat', `http://127.0.0.1:${PORT}/src/renderer/settings/settings.html`, [
    'autoShow',
    'clickThrough',
    'opacity',
    'hotkeys'
  ]);

  console.log(`\nKet qua E2E: ${passed} trang kiem thu thanh cong, ${failed} trang loi.\n`);
  server.close();

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Loi E2E fatal:', err);
  process.exit(1);
});
