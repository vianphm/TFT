'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');

const { Store } = require('./services/store');
const { GameWatcher } = require('./services/gameWatcher');
const { RiotLiveClient } = require('./services/riotLiveClient');
const { createMainWindow } = require('./windows/mainWindow');
const { OverlayManager } = require('./windows/overlayWindow');
const { ShortcutManager } = require('./shortcuts');

const logPath = path.join(app.getPath('userData'), 'main.log');
function log(msg) {
  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (_) {}
}

process.on('uncaughtException', (err) => {
  log(`UNCAUGHT EXCEPTION: ${err.stack || err.message}`);
});

process.on('unhandledRejection', (reason) => {
  log(`UNHANDLED REJECTION: ${reason && reason.stack ? reason.stack : reason}`);
});

process.on('exit', (code) => {
  log(`PROCESS EXIT EVENT: code=${code}`);
});

log('App starting...');

let store;
let mainWindow = null;
let overlayManager = null;
let gameWatcher = null;
let liveClient = null;
let shortcuts = null;
let tray = null;

const PRELOAD_PATH = path.join(__dirname, '..', 'preload', 'preload.js');
const DATA_DIR = path.join(__dirname, '..', 'data');

// Đăng ký second-instance ở cấp ứng dụng cao nhất
app.on('second-instance', () => {
  log('second-instance triggered by user');
  if (!mainWindow || mainWindow.isDestroyed()) {
    if (store) mainWindow = createMainWindow(store, PRELOAD_PATH);
  } else {
    mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(true);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(false);
      }
    }, 600);
  }
});

// Chỉ cho phép 1 instance duy nhất chạy
const gotLock = app.requestSingleInstanceLock();
log(`SingleInstanceLock result: ${gotLock}`);
if (!gotLock) {
  log('Could not get single instance lock, exiting duplicate.');
  app.quit();
  process.exit(0);
}

// Load static initial data
function loadJsonData(fileName, fallback) {
  try {
    const p = path.join(DATA_DIR, fileName);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (e) {
    console.error(`[main] Loi doc file ${fileName}:`, e.message);
  }
  return fallback;
}

app.whenReady().then(() => {
  log('app.whenReady fired');
  const configPath = path.join(app.getPath('userData'), 'config.json');
  store = new Store(configPath, {
    overlay: {
      visible: true,
      clickThrough: true,
      opacity: 0.95
    },
    pinnedCompId: 'comp-caitlyn-enforcer',
    autoShowWithGame: true
  });

  overlayManager = new OverlayManager(store, PRELOAD_PATH);
  mainWindow = createMainWindow(store, PRELOAD_PATH);
  log('mainWindow created');

  mainWindow.on('show', () => log('mainWindow emitted show'));
  mainWindow.on('hide', () => log('mainWindow emitted hide'));
  mainWindow.on('close', (e) => {
    log('mainWindow emitted close');
    if (!app.isQuitting) {
      if (!tray || tray.isDestroyed()) {
        app.isQuitting = true;
        app.quit();
        return;
      }
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => {
    log('mainWindow emitted closed');
    mainWindow = null;
  });

  log('creating tray...');
  try {
    createTray();
    log('createTray done');
  } catch (e) {
    log('createTray error: ' + e.message);
  }

  // Khởi tạo phím tắt toàn cầu
  log('registering shortcuts...');
  shortcuts = new ShortcutManager({
    onToggleOverlay: () => {
      const isVisible = overlayManager.toggle();
      broadcast('overlay:visibility', isVisible);
    },
    onToggleClickThrough: () => {
      const cur = store.get('overlay.clickThrough', true);
      const next = overlayManager.setClickThrough(!cur);
      broadcast('overlay:clickThrough', next);
    },
    onToggleMain: () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        mainWindow = createMainWindow(store, PRELOAD_PATH);
      } else if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  shortcuts.register();
  log('shortcuts registered');

  // Khởi động dịch vụ theo dõi trận đấu TFT
  log('starting gameWatcher...');
  gameWatcher = new GameWatcher({
    onChange: (status) => {
      broadcast('game:status', status);
      if (store.get('autoShowWithGame', true) && status.gameRunning) {
        overlayManager.show();
      }
    }
  });
  gameWatcher.start();
  log('gameWatcher started');

  // Khởi động dịch vụ kết nối Riot Live Client API (Port 2999)
  log('starting liveClient...');
  liveClient = new RiotLiveClient({
    onData: (liveData) => {
      broadcast('live:data', liveData);
    },
    onStatus: (status) => {
      broadcast('live:status', status);
    }
  });
  liveClient.start();
  log('liveClient started');

  // Khởi tạo các IPC Handlers
  log('registering IPC...');
  registerIpc();
  log('registerIpc completed successfully!');
});

function createTray() {
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');
  if (!fs.existsSync(iconPath)) return;
  try {
    tray = new Tray(iconPath);
  } catch (err) {
    console.warn('[tray] Loi khoi tao tray:', err.message);
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Mở Blitz Client', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { label: 'Bật / Tắt Overlay (F2)', click: () => overlayManager.toggle() },
    { label: 'Khóa / Mở Chuột (F3)', click: () => {
      const cur = store.get('overlay.clickThrough', true);
      overlayManager.setClickThrough(!cur);
    }},
    { type: 'separator' },
    { label: 'Thoát Hoàn Toàn', click: () => {
      app.isQuitting = true;
      app.quit();
    }}
  ]);

  if (tray) {
    tray.setToolTip('Blitz TFT Companion');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }
}

function broadcast(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
  if (overlayManager) {
    overlayManager.broadcast(channel, data);
  }
}

function registerIpc() {
  const handle = (channel, fn) => {
    ipcMain.handle(channel, async (_event, ...args) => {
      try {
        const val = await fn(...args);
        return { ok: true, data: val };
      } catch (err) {
        console.error(`[ipc] ${channel} error:`, err);
        return { ok: false, error: err.message };
      }
    });
  };

  // --- Dữ liệu (Comps, Items, Tables)
  handle('data:getComps', () => {
    const custom = store.get('comps');
    if (custom && Array.isArray(custom) && custom.length > 0) return custom;
    return loadJsonData('comps.json', []);
  });

  handle('data:saveComps', (comps) => {
    store.set('comps', comps);
    broadcast('comps:updated', comps);
    return true;
  });

  handle('data:getItems', () => loadJsonData('items.json', { COMPONENTS: [], RECIPES: [] }));
  handle('data:getTables', () => loadJsonData('tables.json', {}));

  // --- Ghim đội hình vào Overlay
  handle('comp:pin', (compId) => {
    store.set('pinnedCompId', compId);
    broadcast('comp:pinned', compId);
    return compId;
  });

  handle('comp:getPinned', () => store.get('pinnedCompId', 'comp-caitlyn-enforcer'));

  // --- Overlay controls
  handle('overlay:toggle', (force) => overlayManager.toggle(force));
  handle('overlay:setHover', (hovering) => overlayManager.setHover(hovering));
  handle('overlay:setClickThrough', (enabled) => overlayManager.setClickThrough(enabled));
  handle('overlay:updateBounds', (bounds) => {
    overlayManager.updateBounds(bounds);
    return true;
  });
  handle('overlay:setDragging', (dragging) => {
    overlayManager.setDragging(dragging);
    return true;
  });

  // --- Game Status
  handle('game:getStatus', () => gameWatcher ? gameWatcher.getState() : { gameRunning: false });

  // --- Settings
  handle('settings:get', () => store.all());
  handle('settings:set', (key, val) => store.set(key, val));
}

app.on('before-quit', () => {
  log('app before-quit');
});

app.on('will-quit', () => {
  log('app will-quit');
  if (shortcuts) shortcuts.unregister();
  if (gameWatcher) gameWatcher.stop();
  if (liveClient) liveClient.stop();
});

app.on('window-all-closed', () => {
  log('app window-all-closed');
  if (process.platform !== 'darwin') {
    // Không thoát app khi đóng cửa sổ vì overlay và game watcher vẫn chạy ngầm
  }
});
