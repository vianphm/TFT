/**
 * Browser Bridge (Polyfill cho window.tft khi chay tren trinh duyet web nhu Chrome/Edge).
 * Cho phep Dashboard va Overlay hoat dong day du tinh nang tren web test server.
 */
(function () {
  'use strict';

  // Xoa sach moi Service Worker va Cache Storage cu cua ban mobile
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (var i = 0; i < registrations.length; i++) {
          registrations[i].unregister();
        }
      });
    }
    if (typeof window !== 'undefined' && 'caches' in window) {
      caches.keys().then(function (keys) {
        for (var i = 0; i < keys.length; i++) {
          caches.delete(keys[i]);
        }
      });
    }
  } catch (e) {
    console.warn('SW clean error:', e);
  }

  if (window.tft) return; // Da co Electron IPC

  var CONFIG_KEY = 'tft_bridge_config';
  var COMPS_KEY = 'tft_bridge_comps';

  var listeners = {};

  function emit(event, payload) {
    if (listeners[event]) {
      listeners[event].forEach(function (fn) {
        try { fn(payload); } catch (e) { console.error(e); }
      });
    }
  }

  function getStoredConfig() {
    try {
      var raw = localStorage.getItem(CONFIG_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      overlay: {
        visible: false,
        clickThrough: false,
        opacity: 92,
        displayId: 'screen-1',
        widgets: {
          odds: { visible: true, collapsed: false, x: 20, y: 60 },
          econ: { visible: true, collapsed: false, x: 340, y: 60 },
          timer: { visible: false, collapsed: false, x: 660, y: 60 },
          items: { visible: false, collapsed: false, x: 20, y: 380 },
          augments: { visible: true, collapsed: false, x: 460, y: 200 },
          advisor: { visible: false, collapsed: false, x: 660, y: 200 },
          comp: { visible: true, collapsed: false, x: 20, y: 180 },
          notes: { visible: false, collapsed: false, x: 660, y: 380 }
        }
      },
      dashboard: { lastTab: 'comps', displayId: 'screen-1' },
      state: { round: '2-1', level: 8, xp: 0, gold: 50, hp: 100, notes: '' },
      mobile: { port: 7333 }
    };
  }

  function saveStoredConfig(cfg) {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    } catch (e) {}
  }

  var currentConfig = getStoredConfig();

  // Load sample comps
  var sampleComps = (window.TFT && window.TFT.SAMPLE_COMPS) || [];
  function getStoredComps() {
    try {
      var raw = localStorage.getItem(COMPS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) {}
    return sampleComps;
  }

  var currentComps = getStoredComps();

  window.tft = {
    config: {
      get: async function () {
        return JSON.parse(JSON.stringify(currentConfig));
      },
      set: async function (keyPath, value) {
        var keys = keyPath.split('.');
        var last = keys.pop();
        var node = currentConfig;
        for (var i = 0; i < keys.length; i++) {
          if (!node[keys[i]]) node[keys[i]] = {};
          node = node[keys[i]];
        }
        node[last] = value;
        saveStoredConfig(currentConfig);
        emit('config:changed', currentConfig);
        return value;
      },
      patch: async function (patch) {
        Object.assign(currentConfig, patch);
        saveStoredConfig(currentConfig);
        emit('config:changed', currentConfig);
        return currentConfig;
      },
      reset: async function () {
        currentConfig = getStoredConfig();
        saveStoredConfig(currentConfig);
        return currentConfig;
      }
    },
    displays: {
      list: async function () {
        return [
          { id: 'screen-1', label: 'Màn hình chính (1920x1080 • Primary)' },
          { id: 'screen-2', label: 'Màn hình phụ (1920x1080)' }
        ];
      }
    },
    overlay: {
      toggle: async function (force) {
        var next = typeof force === 'boolean' ? force : !currentConfig.overlay.visible;
        currentConfig.overlay.visible = next;
        saveStoredConfig(currentConfig);
        emit('overlay:visibility', next);
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'OVERLAY_VISIBILITY', visible: next }, '*');
        }
        if (next && typeof window !== 'undefined' && !window.location.pathname.includes('overlay.html')) {
          try {
            var overlayWin = window.open('/overlay/overlay.html', 'tft_overlay_window', 'width=1366,height=768,menubar=no,toolbar=no,location=no');
            if (overlayWin) overlayWin.focus();
          } catch (e) {
            console.log('Popup blocked:', e);
          }
        }
        return next;
      },
      setClickThrough: async function (value) {
        currentConfig.overlay.clickThrough = Boolean(value);
        saveStoredConfig(currentConfig);
        emit('overlay:click-through', currentConfig.overlay.clickThrough);
        return currentConfig.overlay.clickThrough;
      },
      setOpacity: async function (value) {
        currentConfig.overlay.opacity = value;
        saveStoredConfig(currentConfig);
        emit('overlay:opacity', value);
        return value;
      },
      setHover: async function () {},
      moveDisplay: async function (id) {
        currentConfig.overlay.displayId = id;
        saveStoredConfig(currentConfig);
        return id;
      },
      updateWidget: async function (name, patch) {
        if (!currentConfig.overlay.widgets[name]) currentConfig.overlay.widgets[name] = {};
        Object.assign(currentConfig.overlay.widgets[name], patch);
        saveStoredConfig(currentConfig);
        emit('overlay:widgets', currentConfig.overlay.widgets);
        return currentConfig.overlay.widgets[name];
      }
    },
    dashboard: {
      toggle: async function () { return true; },
      show: async function () {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'SWITCH_VIEW', view: 'dashboard' }, '*');
        }
        return true;
      },
      moveDisplay: async function (id) {
        currentConfig.dashboard.displayId = id;
        saveStoredConfig(currentConfig);
        return id;
      }
    },
    settings: {
      open: async function () {
        var tabTools = document.querySelector('[data-tab="tools"]');
        if (tabTools) tabTools.click();
        return true;
      }
    },
    hotkeys: {
      set: async function () { return true; },
      status: async function () { return []; }
    },
    comps: {
      list: async function () {
        return JSON.parse(JSON.stringify(currentComps));
      },
      save: async function (newComps) {
        currentComps = newComps;
        try {
          localStorage.setItem(COMPS_KEY, JSON.stringify(newComps));
        } catch (e) {}
        emit('comps:changed', currentComps);
        return currentComps;
      },
      importUrl: async function () {
        return { ok: true, count: 0 };
      },
      importText: async function () {
        return { ok: true, count: 0 };
      }
    },
    mobile: {
      status: async function () {
        return { running: true, port: 7333, addresses: ['http://localhost:7333'] };
      },
      start: async function () { return { running: true, port: 7333 }; },
      stop: async function () { return { running: false }; }
    },
    data: {
      load: async function () {
        try {
          var res = await fetch('/data/set-fallback.json');
          if (res.ok) return await res.json();
        } catch (e) {}
        return { champions: [], traits: [], items: [], augments: [] };
      },
      sync: async function () {
        return { setNumber: 18, syncedAt: new Date().toISOString() };
      }
    },
    game: {
      status: async function () {
        try {
          var res = await fetch('/api/game/status');
          if (res.ok) {
            return await res.json();
          }
        } catch (e) {}
        return { gameRunning: false, clientRunning: false };
      }
    },
    updater: {
      check: async function () {
        return { updateAvailable: false, currentVersion: '0.1.0' };
      },
      openDownload: async function (url) {
        window.open(url, '_blank');
      }
    },
    app: {
      info: async function () { return { version: '0.1.0' }; },
      openExternal: async function (url) { window.open(url, '_blank'); },
      openConfigDir: async function () {},
      quit: async function () {}
    },
    on: function (channel, listener) {
      if (!listeners[channel]) listeners[channel] = [];
      listeners[channel].push(listener);
      return function () {
        listeners[channel] = (listeners[channel] || []).filter(function (fn) { return fn !== listener; });
      };
    }
  };

  // Tu dong kiem tra tien trinh game va cap nhat lien tuc trong che do browser
  setInterval(async function () {
    try {
      if (window.tft && window.tft.game && window.tft.game.status) {
        var st = await window.tft.game.status();
        emit('game:status', st);
      }
    } catch (e) {}
  }, 2500);

  // Lang nghe phím F2 tren trinh duyet de bat/tat overlay
  window.addEventListener('keydown', function (e) {
    if (e.key === 'F2') {
      e.preventDefault();
      window.tft.overlay.toggle();
    }
  });
})();
