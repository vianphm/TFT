'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const invoke = async (channel, ...args) => {
  const res = await ipcRenderer.invoke(channel, ...args);
  if (res && res.ok === false) {
    throw new Error(res.error || 'Loi khong xac dinh');
  }
  return res ? res.data : undefined;
};

contextBridge.exposeInMainWorld('blitz', {
  // Dữ liệu Đội hình, Trang bị & Bảng tính
  getComps: () => invoke('data:getComps'),
  saveComps: (comps) => invoke('data:saveComps', comps),
  getItems: () => invoke('data:getItems'),
  getTables: () => invoke('data:getTables'),

  // Ghim đội hình vào Overlay
  pinComp: (compId) => invoke('comp:pin', compId),
  getPinnedComp: () => invoke('comp:getPinned'),

  // Điều khiển Overlay
  toggleOverlay: (force) => invoke('overlay:toggle', force),
  setHover: (hovering) => invoke('overlay:setHover', hovering),
  setClickThrough: (enabled) => invoke('overlay:setClickThrough', enabled),

  // Trạng thái trận đấu & Riot Live Client API
  getGameStatus: () => invoke('game:getStatus'),

  // Cài đặt
  getSettings: () => invoke('settings:get'),
  setSetting: (key, val) => invoke('settings:set', key, val),

  // Lắng nghe sự kiện thời gian thực từ main process
  on: (channel, callback) => {
    const validChannels = [
      'game:status',
      'live:data',
      'live:status',
      'overlay:visibility',
      'overlay:clickThrough',
      'comp:pinned',
      'comps:updated'
    ];
    if (validChannels.includes(channel)) {
      const subscription = (_event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  }
});
