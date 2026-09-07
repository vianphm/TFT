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

// Chỉ cho phép 1 instance duy nhất chạy
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let store;
let mainWindow = null;
let overlayManager = null;
let gameWatcher = null;
let liveClient = null;
let shortcuts = null;
let tray = null;

const PRELOAD_PATH = path.join(__dirname, '..', 'preload', 'preload.js');
const DATA_DIR = path.join(__dirname, '..', 'data');

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

  // Tạo System Tray
  createTray();

  // Khởi tạo phím tắt toàn cầu
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

  // Khởi động dịch vụ theo dõi trận đấu TFT
  gameWatcher = new GameWatcher({
    onChange: (status) => {
      broadcast('game:status', status);
      if (store.get('autoShowWithGame', true) && status.gameRunning) {
        overlayManager.show();
      }
    }
  });
  gameWatcher.start();

  // Khởi động dịch vụ kết nối Riot Live Client API (Port 2999)
  liveClient = new RiotLiveClient({
    onData: (liveData) => {
      broadcast('live:data', liveData);
    },
    onStatus: (status) => {
      broadcast('live:status', status);
    }
  });
  liveClient.start();

  // Khởi tạo các IPC Handlers
  registerIpc();

  // Ẩn cửa sổ chính xuống Tray khi bấm X thay vì thoát app hoàn toàn
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

function createTray() {
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');
  // Nếu chưa có icon thì dùng icon mặc định của electron
  try {
    tray = new Tray(fs.existsSync(iconPath) ? iconPath : path.join(__dirname, '..', 'renderer', 'shared', 'tray.png'));
  } catch (_) {
    // Bỏ qua lỗi icon nếu đường dẫn chưa có ảnh nhị phân
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

  // --- Game Status
  handle('game:getStatus', () => gameWatcher ? gameWatcher.getState() : { gameRunning: false });

  // --- Settings
  handle('settings:get', () => store.all());
  handle('settings:set', (key, val) => store.set(key, val));
}

app.on('will-quit', () => {
  if (shortcuts) shortcuts.unregister();
  if (gameWatcher) gameWatcher.stop();
  if (liveClient) liveClient.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Không thoát app khi đóng cửa sổ vì overlay và game watcher vẫn chạy ngầm
  }
});
