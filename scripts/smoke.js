'use strict';
/**
 * Kiem tra nhanh giao dien: mo overlay/dashboard/settings, ghi lai moi loi console
 * cua renderer va chup anh man hinh. Chi dung khi phat trien:
 *   TFT_SMOKE=1 npm start          (hoac: npm run smoke)
 * Duoc nap tu main.js khi co bien moi truong TFT_SMOKE.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const LEVELS = ['log', 'warn', 'error'];

function attach(windows) {
  const problems = [];
  const outDir = path.join(app.getPath('userData'), 'smoke');
  fs.mkdirSync(outDir, { recursive: true });

  const watch = (name, win) => {
    if (!win || win.isDestroyed()) return;
    win.webContents.on('console-message', (event, level, message, line, source) => {
      const label = LEVELS[level] || level;
      console.log(`[${name}] ${label}: ${message} (${source}:${line})`);
      if (label === 'error' || label === 'warn') problems.push(`${name}: ${message}`);
    });
    win.webContents.on('render-process-gone', (event, details) => {
      problems.push(`${name}: renderer chet (${details.reason})`);
    });
    win.webContents.on('did-fail-load', (event, code, desc) => {
      problems.push(`${name}: khong nap duoc trang (${desc})`);
    });
  };

  setTimeout(async () => {
    windows.showDashboard();
    windows.showSettings();
    windows.showOverlay();
    watch('overlay', windows.overlay);
    watch('dashboard', windows.dashboard);
    watch('settings', windows.settings);

    setTimeout(async () => {
      for (const [name, win] of [['overlay', windows.overlay], ['dashboard', windows.dashboard], ['settings', windows.settings]]) {
        if (!win || win.isDestroyed()) continue;
        try {
          const image = await win.webContents.capturePage();
          fs.writeFileSync(path.join(outDir, `${name}.png`), image.toPNG());
          // Chup them phan duoi cua dashboard (khung phan tich nam duoi man hinh dau)
          if (name === 'dashboard') {
            await win.webContents.executeJavaScript(
              "document.querySelector('.main').scrollTop = 99999; true"
            );
            await new Promise((resolve) => setTimeout(resolve, 400));
            const bottom = await win.webContents.capturePage();
            fs.writeFileSync(path.join(outDir, 'dashboard-bottom.png'), bottom.toPNG());
          }
        } catch (err) {
          problems.push(`${name}: khong chup duoc anh (${err.message})`);
        }
      }
      console.log('\nAnh chup luu tai:', outDir);
      if (problems.length) {
        console.error('\nCO VAN DE:\n - ' + problems.join('\n - '));
        app.exit(1);
      } else {
        console.log('\nKhong co loi console. OK.');
        app.exit(0);
      }
    }, 2500);
  }, 800);
}

module.exports = { attach };
