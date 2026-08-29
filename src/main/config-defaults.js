'use strict';

/** Cau hinh mac dinh cua app. Moi khoa deu sua duoc trong tab "Cai dat". */
const DEFAULT_CONFIG = {
  version: 1,

  general: {
    autoShowWithGame: true,   // tu hien overlay khi phat hien game dang chay
    startMinimized: false,    // chi hien tray khi mo app
    checkDataOnStart: true    // thu dong bo du lieu set moi khi khoi dong
  },

  overlay: {
    enabled: true,
    displayId: null,          // null = man hinh chinh
    opacity: 0.92,
    scale: 1,
    clickThrough: true,       // true = chuot xuyen qua overlay (dang choi)
    widgets: {
      odds:  { visible: true,  x: 24,   y: 70,  collapsed: false },
      econ:  { visible: true,  x: 24,   y: 470, collapsed: false },
      timer: { visible: true,  x: 350,  y: 70,  collapsed: false },
      items: { visible: false, x: 680,  y: 70,  collapsed: false },
      comp:  { visible: false, x: 350,  y: 330, collapsed: false },
      notes: { visible: false, x: 680,  y: 470, collapsed: false }
    }
  },

  dashboard: {
    displayId: null,          // null = man hinh phu dau tien neu co, khong thi man chinh
    preferSecondary: true,
    maximized: false,
    bounds: null,
    lastTab: 'comps'
  },

  hotkeys: {
    toggleOverlay:     'Control+Shift+T',
    toggleClickThrough:'Control+Shift+E',
    toggleDashboard:   'Control+Shift+D',
    resetTimer:        'Control+Shift+R',
    opacityUp:         'Control+Shift+Up',
    opacityDown:       'Control+Shift+Down',
    moveOverlayScreen: 'Control+Shift+M'
  },

  // Trang thai cuoi cua cac may tinh, de mo lai khong phai nhap lai
  state: {
    level: 8,
    gold: 50,
    xp: 0,
    targetLevel: 9,
    round: '2-1',
    rolls: 10,
    champCost: 4,
    copiesOwned: 2,
    copiesTakenByOthers: 0,
    champsOutOfPool: 0,
    notes: ''
  },

  comps: null,                // null = nap comp mau lan dau chay
  dataVersion: null
};

module.exports = { DEFAULT_CONFIG };
