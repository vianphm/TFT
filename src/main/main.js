'use strict';

const path = require('path');
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage, screen } = require('electron');

const { Store } = require('./store');
const { DEFAULT_CONFIG } = require('./config-defaults');
const { WindowManager } = require('./windows');
const { HotkeyManager } = require('./hotkeys');
const { GameWatcher } = require('./game-watcher');
const { LiveClientService } = require('./live-client');
const { DataService } = require('./data-service');
const importer = require('./comp-importer');
const { MobileServer } = require('./mobile-server');
const { SAMPLE_COMPS } = require('../shared/data/sample-comps');

// Chi cho phep mot ban chay - mo lan hai thi bat dashboard cua ban dang chay.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

let store;
let windows;
let hotkeys;
let watcher;
let data;
let tray;
let mobile;

app.on('second-instance', () => windows && windows.showDashboard());

app.whenReady().then(() => {
  store = new Store(path.join(app.getPath('userData'), 'config.json'), DEFAULT_CONFIG);
  if (!store.get('comps')) store.set('comps', SAMPLE_COMPS);

  data = new DataService(app.getPath('userData'));
  windows = new WindowManager(store);
  hotkeys = new HotkeyManager(store);

  mobile = new MobileServer({
    store,
    dataService: data,
    onChange: (status, comps) => {
      windows.broadcast('mobile:status', status);
      if (comps) windows.broadcast('comps:changed', comps);
    }
  });

  registerIpc();
  createTray();

  hotkeys.register({
    toggleOverlay: () => windows.toggleOverlay(),
    toggleClickThrough: () => windows.setClickThrough(!store.get('overlay.clickThrough', true)),
    toggleDashboard: () => windows.toggleDashboard(),
    resetTimer: () => windows.broadcast('hotkey:action', 'resetTimer'),
    opacityUp: () => windows.setOpacity(store.get('overlay.opacity', 0.92) + 0.05),
    opacityDown: () => windows.setOpacity(store.get('overlay.opacity', 0.92) - 0.05),
    moveOverlayScreen: () => windows.moveOverlayToDisplay()
  });

  if (store.get('mobile.autoStart', false)) {
    mobile.start(store.get('mobile.port', 7333)).catch((err) => console.error('[mobile]', err.message));
  }

  windows.createOverlay();
  if (store.get('overlay.enabled', true)) windows.showOverlay();
  if (!store.get('general.startMinimized', false)) windows.showDashboard();

  if (process.env.TFT_SMOKE) require('../../scripts/smoke.js').attach(windows);

  watcher = new GameWatcher({
    onChange: (status) => {
      windows.broadcast('game:status', status);
      if (!store.get('general.autoShowWithGame', true)) return;
      if (status.gameRunning) windows.toggleOverlay(true);
    }
  });
  watcher.start();

  liveClient = new LiveClientService({
    onData: (liveData) => {
      windows.broadcast('live:game-data', liveData);
    },
    onStatus: (status) => {
      windows.broadcast('live:status', status);
      if (status.inGame && store.get('general.autoShowWithGame', true)) {
        windows.toggleOverlay(true);
      }
    }
  });
  liveClient.start();

  // Cam/rut man hinh thi dat lai overlay cho dung cho.
  screen.on('display-added', () => refreshDisplays());
  screen.on('display-removed', () => refreshDisplays());
  screen.on('display-metrics-changed', () => refreshDisplays());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) windows.showDashboard();
    else windows.showDashboard();
  });
});

function refreshDisplays() {
  if (!windows) return;
  windows.moveOverlayToDisplay(store.get('overlay.displayId'));
  windows.broadcast('displays:changed', windows.listDisplays());
}

// Dang ky listener rong: app tiep tuc song o tray du dong het cua so.
app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  if (windows) windows.quitting = true;
  if (mobile) mobile.stop();
  if (watcher) watcher.stop();
  if (hotkeys) hotkeys.dispose();
  if (store) store.saveNow();
});

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', '..', 'assets', 'tray.png'));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('TFT Companion');
  renderTrayMenu();
  tray.on('click', () => windows.showDashboard());
}

function renderTrayMenu() {
  if (!tray) return;
  const clickThrough = store.get('overlay.clickThrough', true);
  const menu = Menu.buildFromTemplate([
    { label: 'Mo dashboard', click: () => windows.showDashboard() },
    { label: 'Bat/tat overlay', click: () => { windows.toggleOverlay(); renderTrayMenu(); } },
    {
      label: clickThrough ? 'Mo khoa overlay (dung duoc chuot)' : 'Khoa overlay (chuot xuyen qua)',
      click: () => { windows.setClickThrough(!clickThrough); renderTrayMenu(); }
    },
    { label: 'Chuyen overlay sang man hinh khac', click: () => windows.moveOverlayToDisplay() },
    { type: 'separator' },
    { label: 'Cai dat', click: () => windows.showSettings() },
    { type: 'separator' },
    { label: 'Thoat', click: () => { windows.quitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
}

function registerIpc() {
  const handle = (channel, fn) => ipcMain.handle(channel, async (event, ...args) => {
    try {
      return { ok: true, value: await fn(...args) };
    } catch (err) {
      console.error(`[ipc] ${channel}:`, err);
      return { ok: false, error: err.message };
    }
  });

  // --- cau hinh
  handle('config:get', () => store.all());
  handle('config:set', (keyPath, value) => {
    store.set(keyPath, value);
    windows.broadcast('config:changed', { keyPath, value });
    return store.all();
  });
  handle('config:patch', (patch) => {
    const next = store.merge(patch);
    windows.broadcast('config:changed', { patch });
    return next;
  });
  handle('config:reset', () => {
    const next = store.reset();
    store.set('comps', SAMPLE_COMPS);
    hotkeys.apply();
    windows.setOpacity(store.get('overlay.opacity'));
    windows.setClickThrough(store.get('overlay.clickThrough'));
    windows.broadcast('config:changed', { reset: true });
    return next;
  });

  // --- man hinh
  handle('displays:list', () => windows.listDisplays());

  // --- overlay
  handle('overlay:toggle', (force) => windows.toggleOverlay(force));
  handle('overlay:click-through', (value) => {
    const next = windows.setClickThrough(value);
    renderTrayMenu();
    return next;
  });
  handle('overlay:hover', (hovering) => windows.setHoverInteractive(hovering));
  handle('overlay:opacity', (value) => windows.setOpacity(value));
  handle('overlay:move-display', (displayId) => windows.moveOverlayToDisplay(displayId));
  handle('overlay:widget', (name, patch) => {
    const current = store.get(`overlay.widgets.${name}`, {});
    const next = { ...current, ...patch };
    store.set(`overlay.widgets.${name}`, next);
    windows.broadcast('overlay:widgets', store.get('overlay.widgets'));
    return next;
  });

  // --- dashboard / settings
  handle('dashboard:toggle', () => windows.toggleDashboard());
  handle('dashboard:show', () => { windows.showDashboard(); return true; });
  handle('dashboard:move-display', (displayId) => windows.moveDashboardToDisplay(displayId));
  handle('settings:open', () => { windows.showSettings(); return true; });

  // --- phim tat
  handle('hotkeys:set', (action, accelerator) => hotkeys.update(action, accelerator));
  handle('hotkeys:status', () => hotkeys.failed);

  // --- du lieu set
  handle('data:load', () => data.load());
  handle('data:sync', async () => {
    const result = await data.sync();
    store.set('dataVersion', { setNumber: result.setNumber, syncedAt: result.syncedAt });
    windows.broadcast('data:updated', result);
    return result;
  });

  // --- doi hinh
  handle('comps:list', () => store.get('comps', []));
  handle('comps:save', (comps) => {
    const clean = (Array.isArray(comps) ? comps : []).map(importer.normalizeComp).filter(Boolean);
    store.set('comps', clean);
    windows.broadcast('comps:changed', clean);
    return clean;
  });
  handle('comps:import-url', (url) => importer.importFromUrl(url, data.load()));
  handle('comps:import-text', (text) => importer.importFromText(text, data.load()));

  // --- may chu cho dien thoai
  handle('mobile:status', () => mobile.status());
  handle('mobile:start', async (port) => {
    const status = await mobile.start(port || store.get('mobile.port', 7333));
    store.set('mobile.port', status.port);
    return status;
  });
  handle('mobile:stop', () => mobile.stop());

  // --- linh tinh
  handle('game:status', () => (watcher ? watcher.snapshot : { gameRunning: false, clientRunning: false }));
  handle('app:info', () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    platform: process.platform,
    userData: app.getPath('userData')
  }));
  handle('app:open-external', (url) => {
    if (!/^https?:\/\//i.test(url)) throw new Error('Chi mo duoc lien ket http/https');
    return shell.openExternal(url);
  });
  handle('app:open-config-dir', () => shell.openPath(app.getPath('userData')));
  handle('app:quit', () => { windows.quitting = true; app.quit(); return true; });
}
