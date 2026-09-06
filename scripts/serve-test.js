'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 7333;
const ROOT_DIR = path.join(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Killer script to immediately unregister legacy mobile Service Worker and purge caches
const SW_KILLER_SCRIPT = `
self.addEventListener('install', function(e) { self.skipWaiting(); });
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).then(function() {
      return self.registration.unregister();
    }).then(function() {
      return self.clients.claim();
    }).then(function() {
      return self.clients.matchAll();
    }).then(function(clients) {
      clients.forEach(function(client) {
        if (client.url && 'navigate' in client) {
          client.navigate(client.url);
        }
      });
    })
  );
});
`;

// Clean PC-only preview bar
const PC_PREVIEW_BAR_HTML = `
<!-- TFT Companion PC Pro Control Bar -->
<div id="tft-pc-control-bar" style="position:fixed;top:10px;right:18px;z-index:9999999;display:flex;align-items:center;gap:8px;background:rgba(6,9,16,0.96);padding:6px 12px;border-radius:30px;border:1px solid #c8aa6e;box-shadow:0 8px 32px rgba(0,0,0,0.85);backdrop-filter:blur(16px);font-family:system-ui,-apple-system,sans-serif;font-size:12px;user-select:none;">
  <span style="color:#c8aa6e;font-weight:800;font-size:11px;letter-spacing:0.8px;display:flex;align-items:center;gap:6px">
    <span style="width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;display:inline-block"></span>
    TFT PC DESKTOP (BLITZ PRO)
  </span>
  <a href="/" style="text-decoration:none;color:#f8fafc;font-weight:700;padding:5px 12px;border-radius:20px;background:rgba(200,170,110,0.25);border:1px solid #c8aa6e;transition:all 0.2s">🖥️ Dashboard</a>
  <a href="/overlay" target="_blank" style="text-decoration:none;color:#38bdf8;font-weight:700;padding:5px 14px;border-radius:20px;background:rgba(56,189,248,0.18);border:1px solid #38bdf8;box-shadow:0 0 10px rgba(56,189,248,0.25);transition:all 0.2s" title="Bật Overlay trong cửa sổ mới">⚡ Bật Overlay (F2)</a>
</div>
`;

function resolveLocalPath(reqPath) {
  // Direct PC App mappings
  if (reqPath === '/' || reqPath === '/index.html' || reqPath === '/dashboard' || reqPath === '/dashboard/' || reqPath === '/dashboard/dashboard.html') {
    return path.join(ROOT_DIR, 'src', 'renderer', 'dashboard', 'dashboard.html');
  }
  if (reqPath === '/overlay' || reqPath === '/overlay/' || reqPath === '/overlay/overlay.html') {
    return path.join(ROOT_DIR, 'src', 'renderer', 'overlay', 'overlay.html');
  }

  // Dashboard root relative fallbacks
  if (reqPath === '/dashboard.css') {
    return path.join(ROOT_DIR, 'src', 'renderer', 'dashboard', 'dashboard.css');
  }
  if (reqPath === '/dashboard.js') {
    return path.join(ROOT_DIR, 'src', 'renderer', 'dashboard', 'dashboard.js');
  }
  if (reqPath === '/overlay.css') {
    return path.join(ROOT_DIR, 'src', 'renderer', 'overlay', 'overlay.css');
  }
  if (reqPath === '/overlay.js') {
    return path.join(ROOT_DIR, 'src', 'renderer', 'overlay', 'overlay.js');
  }

  // Folders
  if (reqPath.startsWith('/dashboard/')) {
    return path.join(ROOT_DIR, 'src', 'renderer', reqPath);
  }
  if (reqPath.startsWith('/overlay/')) {
    return path.join(ROOT_DIR, 'src', 'renderer', reqPath);
  }
  if (reqPath.startsWith('/settings/')) {
    return path.join(ROOT_DIR, 'src', 'renderer', reqPath);
  }
  if (reqPath.startsWith('/shared/data/')) {
    return path.join(ROOT_DIR, 'src', 'shared', 'data', reqPath.replace('/shared/data/', ''));
  }
  if (reqPath.startsWith('/shared/')) {
    return path.join(ROOT_DIR, 'src', 'renderer', reqPath);
  }
  if (reqPath.startsWith('/data/')) {
    return path.join(ROOT_DIR, 'src', 'shared', reqPath);
  }
  if (reqPath.startsWith('/assets/')) {
    return path.join(ROOT_DIR, reqPath);
  }

  // Fallback checks
  const candidates = [
    path.join(ROOT_DIR, 'src', 'renderer', 'dashboard', reqPath),
    path.join(ROOT_DIR, 'src', 'renderer', reqPath),
    path.join(ROOT_DIR, 'src', reqPath),
    path.join(ROOT_DIR, 'assets', reqPath)
  ];
  for (let i = 0; i < candidates.length; i++) {
    if (fs.existsSync(candidates[i]) && fs.statSync(candidates[i]).isFile()) {
      return candidates[i];
    }
  }
  return path.join(ROOT_DIR, 'src', 'renderer', 'dashboard', 'dashboard.html');
}

const { exec } = require('child_process');

const GAME_PROCESSES = [
  'tftclient-win64-shipping.exe',
  'tftclient.exe',
  'league of legends.exe',
  'tft.exe'
];
const CLIENT_PROCESSES = [
  'leagueclient.exe',
  'leagueclientux.exe',
  'leagueclientuxrender.exe',
  'riot client.exe',
  'riotclientservices.exe'
];

let cachedGameStatus = { gameRunning: false, clientRunning: false, lastCheck: 0 };

function checkGameProcesses() {
  return new Promise((resolve) => {
    const now = Date.now();
    if (now - cachedGameStatus.lastCheck < 1500) {
      return resolve(cachedGameStatus);
    }
    const cmd = process.platform === 'win32' ? 'tasklist /fo csv /nh' : 'ps -Ao comm=';
    exec(cmd, { windowsHide: true, maxBuffer: 6 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve(cachedGameStatus);
      const str = (stdout || '').toLowerCase();
      let matchedGame = null;
      let matchedClient = null;
      const gameRunning = GAME_PROCESSES.some(name => {
        if (str.includes(name)) {
          matchedGame = name;
          return true;
        }
        return false;
      });
      const clientRunning = CLIENT_PROCESSES.some(name => {
        if (str.includes(name)) {
          matchedClient = name;
          return true;
        }
        return false;
      });
      cachedGameStatus = {
        gameRunning: Boolean(gameRunning),
        clientRunning: Boolean(clientRunning || gameRunning),
        matchedProcess: matchedGame || matchedClient || null,
        lastCheck: now
      };
      resolve(cachedGameStatus);
    });
  });
}

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];

  // Intercept any Service Worker request to instantly self-destruct legacy mobile SW
  if (reqPath === '/sw.js' || reqPath.endsWith('/sw.js')) {
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Clear-Site-Data': '"cache", "storage"'
    });
    return res.end(SW_KILLER_SCRIPT);
  }

  // Real-time Game Process detection API
  if (reqPath === '/api/game/status' || reqPath === '/api/game-status') {
    checkGameProcesses().then((status) => {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(status));
    });
    return;
  }

  const filePath = resolveLocalPath(reqPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found: ' + reqPath);
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Inject control bar and clear old caches in HTML responses
    if (ext === '.html') {
      fs.readFile(filePath, 'utf8', (readErr, content) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('Error reading HTML');
        }
        let output = content;

        // Unregister any old mobile service worker in browser
        const killerTag = `
        <script>
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(regs) {
              regs.forEach(function(r) { r.unregister(); });
            });
          }
          if ('caches' in window) {
            caches.keys().then(function(keys) {
              keys.forEach(function(k) { caches.delete(k); });
            });
          }
        </script>
        `;

        if (output.includes('</head>')) {
          output = output.replace('</head>', killerTag + '</head>');
        }
        if (!reqPath.includes('overlay')) {
          if (output.includes('</body>')) {
            output = output.replace('</body>', PC_PREVIEW_BAR_HTML + '</body>');
          } else {
            output += PC_PREVIEW_BAR_HTML;
          }
        }

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': Buffer.byteLength(output),
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Clear-Site-Data': '"cache", "storage"'
        });
        res.end(output);
      });
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('\n======================================================');
  console.log('⚡ TFT COMPANION PC (BLITZ PRO) - 100% PC DESKTOP & OVERLAY');
  console.log('======================================================');
  console.log(`🖥️ PC Dashboard:    http://localhost:${PORT}/`);
  console.log(`⚡ In-Game Overlay: http://localhost:${PORT}/overlay`);
  console.log('======================================================\n');
});
