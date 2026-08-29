'use strict';

const path = require('path');
const { BrowserWindow, screen } = require('electron');

const PRELOAD = path.join(__dirname, '..', 'preload', 'preload.js');
const RENDERER = path.join(__dirname, '..', 'renderer');

/**
 * Quan ly 3 cua so: overlay (trong suot, de tren game), dashboard (man hinh phu)
 * va settings. Tat ca deu tao lai duoc sau khi dong.
 */
class WindowManager {
  constructor(store) {
    this.store = store;
    this.overlay = null;
    this.dashboard = null;
    this.settings = null;
    this.quitting = false;
  }

  // ---------------------------------------------------------------- displays

  listDisplays() {
    const primaryId = screen.getPrimaryDisplay().id;
    return screen.getAllDisplays().map((d, index) => ({
      id: d.id,
      index,
      label: `Man hinh ${index + 1} (${d.size.width}x${d.size.height})${d.id === primaryId ? ' - chinh' : ''}`,
      bounds: d.bounds,
      workArea: d.workArea,
      scaleFactor: d.scaleFactor,
      primary: d.id === primaryId
    }));
  }

  /** Tra ve display theo id da luu, khong tim thay thi lay mac dinh. */
  resolveDisplay(displayId, { preferSecondary = false } = {}) {
    const displays = screen.getAllDisplays();
    const found = displays.find((d) => d.id === displayId);
    if (found) return found;
    const primary = screen.getPrimaryDisplay();
    if (preferSecondary) {
      const secondary = displays.find((d) => d.id !== primary.id);
      if (secondary) return secondary;
    }
    return primary;
  }

  // ---------------------------------------------------------------- overlay

  createOverlay() {
    if (this.overlay && !this.overlay.isDestroyed()) return this.overlay;

    const display = this.resolveDisplay(this.store.get('overlay.displayId'));
    const { x, y, width, height } = display.bounds;

    const win = new BrowserWindow({
      x, y, width, height,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: false,
      focusable: false,
      backgroundColor: '#00000000',
      title: 'TFT Companion Overlay',
      webPreferences: {
        preload: PRELOAD,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false
      }
    });

    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setIgnoreMouseEvents(this.store.get('overlay.clickThrough', true), { forward: true });
    win.setOpacity(clamp(this.store.get('overlay.opacity', 0.92), 0.2, 1));
    win.loadFile(path.join(RENDERER, 'overlay', 'overlay.html'));

    win.on('closed', () => { this.overlay = null; });
    this.overlay = win;
    return win;
  }

  showOverlay() {
    const win = this.createOverlay();
    if (!win.isVisible()) win.showInactive();
    win.setAlwaysOnTop(true, 'screen-saver');
    return true;
  }

  hideOverlay() {
    if (this.overlay && !this.overlay.isDestroyed()) this.overlay.hide();
    return false;
  }

  toggleOverlay(force) {
    const visible = this.overlay && !this.overlay.isDestroyed() && this.overlay.isVisible();
    const next = force === undefined ? !visible : Boolean(force);
    const result = next ? this.showOverlay() : this.hideOverlay();
    this.store.set('overlay.enabled', next);
    this.broadcast('overlay:visibility', next);
    return result;
  }

  /** Bat/tat xuyen chuot. clickThrough = true nghia la dang choi, chuot di thang vao game. */
  setClickThrough(value) {
    const next = Boolean(value);
    this.store.set('overlay.clickThrough', next);
    if (this.overlay && !this.overlay.isDestroyed()) {
      this.overlay.setIgnoreMouseEvents(next, { forward: true });
      // Khi mo khoa thi cho phep focus de go chu vao o ghi chu.
      this.overlay.setFocusable(!next);
      if (!next) this.overlay.focus();
    }
    this.broadcast('overlay:click-through', next);
    return next;
  }

  /**
   * Bat/tat tuong tac tam thoi khi chuot di vao mot widget (khong luu vao cau hinh).
   * Nho vay o che do "khoa", chuot van xuyen qua vung trong nhung bam duoc vao widget.
   */
  setHoverInteractive(hovering) {
    if (!this.overlay || this.overlay.isDestroyed()) return false;
    if (!this.store.get('overlay.clickThrough', true)) return true; // dang mo khoa: luon tuong tac
    this.overlay.setIgnoreMouseEvents(!hovering, { forward: true });
    return Boolean(hovering);
  }

  setOpacity(value) {
    const next = clamp(Number(value) || 0.92, 0.2, 1);
    this.store.set('overlay.opacity', next);
    if (this.overlay && !this.overlay.isDestroyed()) this.overlay.setOpacity(next);
    this.broadcast('overlay:opacity', next);
    return next;
  }

  /** Chuyen overlay sang mot man hinh khac (theo id, hoac quay vong neu khong truyen). */
  moveOverlayToDisplay(displayId) {
    const displays = screen.getAllDisplays();
    let target;
    if (displayId != null) {
      target = displays.find((d) => d.id === displayId) || displays[0];
    } else {
      const currentId = this.store.get('overlay.displayId');
      const currentIndex = Math.max(0, displays.findIndex((d) => d.id === currentId));
      target = displays[(currentIndex + 1) % displays.length];
    }
    this.store.set('overlay.displayId', target.id);
    if (this.overlay && !this.overlay.isDestroyed()) {
      const { x, y, width, height } = target.bounds;
      this.overlay.setBounds({ x, y, width, height });
    }
    this.broadcast('overlay:display', target.id);
    return target.id;
  }

  // -------------------------------------------------------------- dashboard

  createDashboard() {
    if (this.dashboard && !this.dashboard.isDestroyed()) return this.dashboard;

    const display = this.resolveDisplay(this.store.get('dashboard.displayId'), {
      preferSecondary: this.store.get('dashboard.preferSecondary', true)
    });
    const saved = this.store.get('dashboard.bounds');
    const bounds = withinDisplay(saved, display) || centeredBounds(display, 1180, 780);

    const win = new BrowserWindow({
      ...bounds,
      show: false,
      minWidth: 900,
      minHeight: 600,
      backgroundColor: '#0d1117',
      title: 'TFT Companion',
      autoHideMenuBar: true,
      webPreferences: {
        preload: PRELOAD,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    win.loadFile(path.join(RENDERER, 'dashboard', 'dashboard.html'));
    if (this.store.get('dashboard.maximized')) win.maximize();

    const persist = () => {
      if (win.isDestroyed() || win.isMinimized()) return;
      this.store.set('dashboard.maximized', win.isMaximized());
      if (!win.isMaximized()) this.store.set('dashboard.bounds', win.getBounds());
      const nearest = screen.getDisplayMatching(win.getBounds());
      if (nearest) this.store.set('dashboard.displayId', nearest.id);
    };
    win.on('resize', persist);
    win.on('move', persist);
    win.on('close', (event) => {
      persist();
      // Dong dashboard chi an di, app van chay o tray.
      if (!this.quitting) {
        event.preventDefault();
        win.hide();
      }
    });
    win.on('closed', () => { this.dashboard = null; });

    this.dashboard = win;
    return win;
  }

  showDashboard() {
    const win = this.createDashboard();
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }

  toggleDashboard() {
    const visible = this.dashboard && !this.dashboard.isDestroyed() && this.dashboard.isVisible();
    if (visible) this.dashboard.hide();
    else this.showDashboard();
    return !visible;
  }

  moveDashboardToDisplay(displayId) {
    const display = this.resolveDisplay(displayId);
    this.store.set('dashboard.displayId', display.id);
    const win = this.createDashboard();
    const wasMax = win.isMaximized();
    if (wasMax) win.unmaximize();
    win.setBounds(centeredBounds(display, 1180, 780));
    if (wasMax) win.maximize();
    win.show();
    return display.id;
  }

  // --------------------------------------------------------------- settings

  showSettings() {
    if (this.settings && !this.settings.isDestroyed()) {
      this.settings.show();
      this.settings.focus();
      return this.settings;
    }
    const parentDisplay = this.resolveDisplay(this.store.get('dashboard.displayId'), {
      preferSecondary: this.store.get('dashboard.preferSecondary', true)
    });
    const win = new BrowserWindow({
      ...centeredBounds(parentDisplay, 720, 720),
      title: 'Cai dat - TFT Companion',
      backgroundColor: '#0d1117',
      autoHideMenuBar: true,
      minimizable: false,
      webPreferences: {
        preload: PRELOAD,
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    win.loadFile(path.join(RENDERER, 'settings', 'settings.html'));
    win.on('closed', () => { this.settings = null; });
    this.settings = win;
    return win;
  }

  // ------------------------------------------------------------------ utils

  /** Gui su kien toi tat ca cua so dang song. */
  broadcast(channel, payload) {
    for (const win of [this.overlay, this.dashboard, this.settings]) {
      if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
    }
  }

  destroyAll() {
    this.quitting = true;
    for (const win of [this.overlay, this.dashboard, this.settings]) {
      if (win && !win.isDestroyed()) win.destroy();
    }
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function centeredBounds(display, width, height) {
  const area = display.workArea;
  const w = Math.min(width, area.width - 40);
  const h = Math.min(height, area.height - 40);
  return {
    x: Math.round(area.x + (area.width - w) / 2),
    y: Math.round(area.y + (area.height - h) / 2),
    width: Math.round(w),
    height: Math.round(h)
  };
}

/** Chi dung lai kich thuoc cu neu no van nam trong mot man hinh dang cam. */
function withinDisplay(bounds, display) {
  if (!bounds || typeof bounds.x !== 'number') return null;
  const all = screen.getAllDisplays();
  const fits = all.some((d) => {
    const a = d.workArea;
    return bounds.x >= a.x - 50 && bounds.y >= a.y - 50 &&
      bounds.x + bounds.width <= a.x + a.width + 50 &&
      bounds.y + bounds.height <= a.y + a.height + 50;
  });
  return fits ? bounds : centeredBounds(display, bounds.width || 1180, bounds.height || 780);
}

module.exports = { WindowManager };
