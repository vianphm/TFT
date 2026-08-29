'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Cau noi duy nhat giua giao dien va main process.
 * Renderer khong co Node, chi goi duoc dung nhung ham liet ke o day.
 */
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args).then((res) => {
  if (res && res.ok === false) throw new Error(res.error || 'Loi khong ro');
  return res ? res.value : undefined;
});

const EVENTS = [
  'config:changed',
  'overlay:visibility',
  'overlay:click-through',
  'overlay:opacity',
  'overlay:display',
  'overlay:widgets',
  'displays:changed',
  'data:updated',
  'game:status',
  'comps:changed',
  'hotkey:action'
];

contextBridge.exposeInMainWorld('tft', {
  config: {
    get: () => invoke('config:get'),
    set: (keyPath, value) => invoke('config:set', keyPath, value),
    patch: (patch) => invoke('config:patch', patch),
    reset: () => invoke('config:reset')
  },
  displays: {
    list: () => invoke('displays:list')
  },
  overlay: {
    toggle: (force) => invoke('overlay:toggle', force),
    setClickThrough: (value) => invoke('overlay:click-through', value),
    setOpacity: (value) => invoke('overlay:opacity', value),
    setHover: (hovering) => invoke('overlay:hover', hovering),
    moveToDisplay: (displayId) => invoke('overlay:move-display', displayId),
    updateWidget: (name, patch) => invoke('overlay:widget', name, patch)
  },
  dashboard: {
    toggle: () => invoke('dashboard:toggle'),
    show: () => invoke('dashboard:show'),
    moveToDisplay: (displayId) => invoke('dashboard:move-display', displayId)
  },
  settings: {
    open: () => invoke('settings:open')
  },
  hotkeys: {
    set: (action, accelerator) => invoke('hotkeys:set', action, accelerator),
    status: () => invoke('hotkeys:status')
  },
  comps: {
    list: () => invoke('comps:list'),
    save: (comps) => invoke('comps:save', comps),
    importUrl: (url) => invoke('comps:import-url', url),
    importText: (text) => invoke('comps:import-text', text)
  },
  data: {
    load: () => invoke('data:load'),
    sync: () => invoke('data:sync')
  },
  game: {
    status: () => invoke('game:status')
  },
  app: {
    info: () => invoke('app:info'),
    openExternal: (url) => invoke('app:open-external', url),
    openConfigDir: () => invoke('app:open-config-dir'),
    quit: () => invoke('app:quit')
  },
  /** on('overlay:visibility', fn) -> ham huy dang ky */
  on(channel, listener) {
    if (!EVENTS.includes(channel)) throw new Error(`Kenh khong duoc phep: ${channel}`);
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  }
});
