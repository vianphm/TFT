/** Cua so cai dat: bat/tat tuy chon, doi phim tat, dong bo du lieu. */
(function () {
  'use strict';

  var api = window.tft;
  var config = null;
  var displays = [];

  var HOTKEY_LABELS = {
    toggleOverlay: 'Bat/tat overlay',
    toggleClickThrough: 'Khoa/mo chuot overlay',
    toggleDashboard: 'Bat/tat dashboard',
    resetTimer: 'Dem nguoc 30 giay',
    opacityUp: 'Tang do mo overlay',
    opacityDown: 'Giam do mo overlay',
    moveOverlayScreen: 'Chuyen overlay sang man hinh khac'
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    config = await api.config.get();
    displays = await api.displays.list();

    bindToggle('autoShow', 'general.autoShowWithGame');
    bindToggle('startMin', 'general.startMinimized');

    var lock = document.getElementById('clickThrough');
    lock.checked = config.overlay.clickThrough;
    lock.addEventListener('change', function () { api.overlay.setClickThrough(lock.checked); });

    var opacity = document.getElementById('opacity');
    opacity.value = Math.round(config.overlay.opacity * 100);
    document.getElementById('opacityLabel').textContent = opacity.value + '%';
    opacity.addEventListener('input', function () {
      document.getElementById('opacityLabel').textContent = opacity.value + '%';
      api.overlay.setOpacity(opacity.value / 100);
    });

    fillDisplays();
    renderHotkeys();
    renderData();
    renderAppInfo();

    document.getElementById('sync').addEventListener('click', syncData);
    document.getElementById('openDir').addEventListener('click', function () { api.app.openConfigDir(); });
    document.getElementById('reset').addEventListener('click', async function () {
      if (!confirm('Khoi phuc toan bo cai dat ve mac dinh? Doi hinh da luu se bi thay bang doi hinh mau.')) return;
      config = await api.config.reset();
      location.reload();
    });
    document.getElementById('quit').addEventListener('click', function () { api.app.quit(); });
  }

  function bindToggle(id, keyPath) {
    var el = document.getElementById(id);
    el.checked = Boolean(get(config, keyPath));
    el.addEventListener('change', function () { api.config.set(keyPath, el.checked); });
  }

  function get(obj, keyPath) {
    return keyPath.split('.').reduce(function (acc, k) { return acc == null ? acc : acc[k]; }, obj);
  }

  function fillDisplays() {
    [['overlayDisplay', config.overlay.displayId, api.overlay.moveToDisplay],
     ['dashDisplay', config.dashboard.displayId, api.dashboard.moveToDisplay]].forEach(function (entry) {
      var sel = document.getElementById(entry[0]);
      sel.innerHTML = displays.map(function (d) {
        return '<option value="' + d.id + '"' + (d.id === entry[1] ? ' selected' : '') + '>' + esc(d.label) + '</option>';
      }).join('');
      sel.addEventListener('change', function () { entry[2](Number(sel.value)); });
    });
  }

  // ---------------------------------------------------------------- hotkeys

  function renderHotkeys() {
    var host = document.getElementById('hotkeys');
    host.innerHTML = Object.keys(config.hotkeys).map(function (action) {
      return '<div class="hk">' +
        '<span>' + (HOTKEY_LABELS[action] || action) + '</span>' +
        '<input readonly data-action="' + action + '" value="' + esc(config.hotkeys[action] || '') + '" />' +
        '<button data-clear="' + action + '" class="ghost">Xoa</button>' +
        '</div>';
    }).join('');

    host.querySelectorAll('input[data-action]').forEach(function (input) {
      input.addEventListener('focus', function () { input.classList.add('capturing'); input.value = 'Nhan phim...'; });
      input.addEventListener('blur', function () {
        input.classList.remove('capturing');
        input.value = config.hotkeys[input.dataset.action] || '';
      });
      input.addEventListener('keydown', async function (event) {
        event.preventDefault();
        if (event.key === 'Escape') { input.blur(); return; }
        var accelerator = toAccelerator(event);
        if (!accelerator) return;
        await saveHotkey(input.dataset.action, accelerator);
        input.blur();
      });
    });

    host.querySelectorAll('button[data-clear]').forEach(function (btn) {
      btn.addEventListener('click', function () { saveHotkey(btn.dataset.clear, ''); });
    });
  }

  async function saveHotkey(action, accelerator) {
    config.hotkeys[action] = accelerator;
    var failed = await api.hotkeys.set(action, accelerator);
    renderHotkeys();
    var msg = document.getElementById('hotkeyMsg');
    if (failed && failed.length) {
      msg.innerHTML = '<span style="color:var(--red)">Khong dang ky duoc: ' +
        failed.map(function (f) { return esc(f.accelerator) + ' (' + esc(f.reason) + ')'; }).join(', ') + '</span>';
    } else {
      msg.innerHTML = '<span style="color:var(--green)">Da luu phim tat.</span>';
      setTimeout(function () { msg.innerHTML = ''; }, 2500);
    }
  }

  /** Doi su kien ban phim thanh chuoi accelerator cua Electron. */
  function toAccelerator(event) {
    var parts = [];
    if (event.ctrlKey) parts.push('Control');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Super');

    var key = event.key;
    if (['Control', 'Alt', 'Shift', 'Meta'].indexOf(key) >= 0) return null;
    if (key === ' ') key = 'Space';
    else if (key.length === 1) key = key.toUpperCase();
    else if (/^Arrow/.test(key)) key = key.replace('Arrow', '');
    else if (key === 'Delete' || key === 'Backspace') return '';
    parts.push(key);
    return parts.join('+');
  }

  // ------------------------------------------------------------------- data

  async function renderData() {
    var info = document.getElementById('dataInfo');
    var data = await api.data.load();
    if (data && data.champions && data.champions.length) {
      info.innerHTML = 'Dang dung: <b>' + esc(data.setName || 'Set ?') + '</b> - ' +
        data.champions.length + ' tuong, ' + (data.items || []).length + ' trang bi. ' +
        (data.syncedAt ? 'Tai luc ' + new Date(data.syncedAt).toLocaleString('vi-VN') : '');
    } else {
      info.textContent = 'Chua co du lieu tuong. Bam dong bo de tai danh sach tuong/toc he cua set dang choi.';
    }
  }

  async function syncData() {
    var btn = document.getElementById('sync');
    var msg = document.getElementById('dataMsg');
    btn.disabled = true;
    msg.innerHTML = '<span class="muted">Dang tai (file kha nang nang, doi mot chut)...</span>';
    try {
      var res = await api.data.sync();
      msg.innerHTML = '<span style="color:var(--green)">Xong: ' + esc(res.setName) + ' - ' +
        res.champions + ' tuong, ' + res.items + ' trang bi.</span>';
      renderData();
    } catch (err) {
      msg.innerHTML = '<span style="color:var(--red)">Loi: ' + esc(err.message) + '</span>';
    } finally {
      btn.disabled = false;
    }
  }

  async function renderAppInfo() {
    var info = await api.app.info();
    document.getElementById('appInfo').innerHTML =
      'Phien ban ' + esc(info.version) + ' - Electron ' + esc(info.electron) + ' - ' + esc(info.platform) +
      '<br />Cau hinh luu tai: <code>' + esc(info.userData) + '</code>';
  }

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
