'use strict';

(async function () {
  const blitz = window.blitz || {};

  let compsData = [];
  let tablesData = {};
  let itemsData = { COMPONENTS: [], RECIPES: [] };
  let pinnedCompId = '';
  let currentLevel = 8;
  let timerInterval = null;
  let timerSeconds = 30;

  // ------------------------------------------------------------- Khởi tạo
  async function init() {
    setupMouseHover();
    setupDragging();
    setupHudButtons();

    try {
      [compsData, tablesData, itemsData, pinnedCompId] = await Promise.all([
        blitz.getComps ? blitz.getComps() : [],
        blitz.getTables ? blitz.getTables() : {},
        blitz.getItems ? blitz.getItems() : { COMPONENTS: [], RECIPES: [] },
        blitz.getPinnedComp ? blitz.getPinnedComp() : ''
      ]);
    } catch (e) {
      console.error('Loi tai du lieu overlay:', e);
    }

    renderPinnedComp();
    renderOdds();
    renderQuickItems();
    setupListeners();
  }

  // ------------------------------------------------------------- Widget Bounds & Dragging
  function syncWidgetBounds() {
    const bounds = [];
    const elements = document.querySelectorAll('.widget:not(.hidden), .hud-bar');
    elements.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        bounds.push({
          x: Math.round(r.left),
          y: Math.round(r.top),
          width: Math.round(r.width),
          height: Math.round(r.height)
        });
      }
    });
    if (blitz.updateOverlayBounds) {
      blitz.updateOverlayBounds(bounds);
    }
  }

  function savePositions() {
    const positions = {};
    document.querySelectorAll('.widget, .hud-bar').forEach((el) => {
      if (el.id && el.style.left && el.style.top) {
        positions[el.id] = {
          left: el.style.left,
          top: el.style.top
        };
      }
    });
    try {
      localStorage.setItem('blitz_overlay_positions', JSON.stringify(positions));
    } catch (_) {}
    syncWidgetBounds();
  }

  function restorePositions() {
    try {
      const raw = localStorage.getItem('blitz_overlay_positions');
      if (!raw) return;
      const positions = JSON.parse(raw);
      for (const [id, pos] of Object.entries(positions)) {
        const el = document.getElementById(id);
        if (el && pos.left && pos.top) {
          el.style.bottom = 'auto';
          el.style.right = 'auto';
          el.style.left = pos.left;
          el.style.top = pos.top;
          if (id === 'hudBar') {
            el.style.transform = 'none';
          }
        }
      }
    } catch (_) {}
  }

  function makeDraggable(element, handle) {
    if (!element || !handle) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let origLeft = 0, origTop = 0;

    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, input, select')) return;
      isDragging = true;
      if (blitz.setDragging) blitz.setDragging(true);

      try {
        handle.setPointerCapture(e.pointerId);
      } catch (_) {}

      startX = e.clientX;
      startY = e.clientY;

      const rect = element.getBoundingClientRect();
      origLeft = rect.left;
      origTop = rect.top;

      element.style.bottom = 'auto';
      element.style.right = 'auto';
      element.style.left = `${origLeft}px`;
      element.style.top = `${origTop}px`;
      if (element.id === 'hudBar') {
        element.style.transform = 'none';
      }

      e.preventDefault();
    });

    handle.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const maxLeft = Math.max(0, window.innerWidth - element.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - element.offsetHeight);

      const newLeft = Math.max(0, Math.min(maxLeft, origLeft + dx));
      const newTop = Math.max(0, Math.min(maxTop, origTop + dy));

      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;
    });

    const stopDrag = (e) => {
      if (!isDragging) return;
      isDragging = false;
      try {
        if (e && e.pointerId) handle.releasePointerCapture(e.pointerId);
      } catch (_) {}
      if (blitz.setDragging) blitz.setDragging(false);
      savePositions();
    };

    handle.addEventListener('pointerup', stopDrag);
    handle.addEventListener('pointercancel', stopDrag);
  }

  function setupDragging() {
    restorePositions();

    // Kéo thả các widget
    document.querySelectorAll('.widget').forEach((widget) => {
      const header = widget.querySelector('.widget-header') || widget;
      makeDraggable(widget, header);
    });

    // Kéo thả thanh HUD bar
    const hudBar = document.getElementById('hudBar');
    if (hudBar) {
      const hudBrand = hudBar.querySelector('.hud-brand') || hudBar;
      hudBrand.style.cursor = 'move';
      makeDraggable(hudBar, hudBrand);
    }

    // Cập nhật vị trí bounds ban đầu
    setTimeout(syncWidgetBounds, 100);
    window.addEventListener('resize', syncWidgetBounds);
  }

  // ------------------------------------------------------------- HUD Controls
  function setupHudButtons() {
    // Toggle Comp Widget
    const btnComp = document.getElementById('toggleCompWidget');
    const widgetComp = document.getElementById('widgetComp');
    if (btnComp && widgetComp) {
      btnComp.addEventListener('click', () => {
        const isHidden = widgetComp.classList.toggle('hidden');
        btnComp.classList.toggle('active', !isHidden);
        setTimeout(syncWidgetBounds, 50);
      });
    }

    // Toggle Odds Widget
    const btnOdds = document.getElementById('toggleOddsWidget');
    const widgetOdds = document.getElementById('widgetOdds');
    if (btnOdds && widgetOdds) {
      btnOdds.addEventListener('click', () => {
        const isHidden = widgetOdds.classList.toggle('hidden');
        btnOdds.classList.toggle('active', !isHidden);
        setTimeout(syncWidgetBounds, 50);
      });
    }

    // Toggle Items Widget
    const btnItems = document.getElementById('toggleItemsWidget');
    const widgetItems = document.getElementById('widgetItems');
    if (btnItems && widgetItems) {
      btnItems.addEventListener('click', () => {
        const isHidden = widgetItems.classList.toggle('hidden');
        btnItems.classList.toggle('active', !isHidden);
        setTimeout(syncWidgetBounds, 50);
      });
    }

    // 30s Timer
    const btnTimer = document.getElementById('btnTimer30');
    if (btnTimer) {
      btnTimer.addEventListener('click', () => {
        startCountdown(30);
      });
    }

    // Lock / Click-Through Button
    const btnLock = document.getElementById('btnLock');
    let locked = true;
    if (btnLock) {
      btnLock.addEventListener('click', async () => {
        locked = !locked;
        if (blitz.setClickThrough) await blitz.setClickThrough(locked);
        updateLockLabel(locked);
      });
    }

    // Hide Overlay (F2)
    const btnClose = document.getElementById('btnCloseOverlay');
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        if (blitz.toggleOverlay) blitz.toggleOverlay(false);
      });
    }
  }

  function updateLockLabel(isLocked) {
    const el = document.getElementById('lockStatus');
    if (el) {
      el.textContent = isLocked ? '🔒 Xuyên Game (F3)' : '🔓 Mở Chuột (F3)';
    }
  }

  function startCountdown(sec) {
    if (timerInterval) clearInterval(timerInterval);
    timerSeconds = sec;
    const textEl = document.getElementById('timerText');
    if (textEl) textEl.textContent = `⏱️ ${timerSeconds}s`;

    timerInterval = setInterval(() => {
      timerSeconds--;
      if (textEl) {
        textEl.textContent = timerSeconds > 0 ? `⏱️ ${timerSeconds}s` : '⏱️ Hết giờ!';
      }
      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        setTimeout(() => {
          if (textEl) textEl.textContent = '⏱️ 30s';
        }, 3000);
      }
    }, 1000);
  }

  // ------------------------------------------------------------- Render Pinned Comp
  function renderPinnedComp() {
    const nameEl = document.getElementById('overlayCompName');
    const tierEl = document.getElementById('overlayCompTier');
    const listEl = document.getElementById('overlayUnitsList');
    if (!nameEl || !listEl) return;

    const comp = compsData.find((c) => c.id === pinnedCompId) || compsData[0];
    if (!comp) {
      nameEl.textContent = 'Chưa chọn đội hình';
      listEl.innerHTML = '<span style="font-size:11px;color:#94a3b8">Mở Blitz Client để ghim bài.</span>';
      return;
    }

    nameEl.textContent = comp.name;
    if (tierEl) tierEl.textContent = comp.tier || 'S';

    listEl.innerHTML = (comp.units || []).map((u) => {
      const costCls = `cost-${u.cost || 1}`;
      const itemsHtml = (u.items || []).map((it) => `<span class="widget-item-pill">${escapeHtml(it)}</span>`).join('');
      return `
        <div class="widget-unit-row">
          <span class="widget-unit-name ${costCls}">
            <span style="color:#facc15;font-size:10px">${'★'.repeat(u.star || 2)}</span>
            ${escapeHtml(u.name)}
          </span>
          <div class="widget-unit-items">${itemsHtml}</div>
        </div>`;
    }).join('');
  }

  // ------------------------------------------------------------- Render Odds
  function renderOdds() {
    const lvEl = document.getElementById('overlayCurrentLevel');
    const gridEl = document.getElementById('overlayOddsGrid');
    if (!gridEl) return;

    if (lvEl) lvEl.textContent = currentLevel;

    const oddsMap = (tablesData && tablesData.SHOP_ODDS) || {};
    const odds = oddsMap[String(currentLevel)] || [0, 0, 0, 0, 0];

    const costs = [
      { cost: '1v', cls: 'cost-1' },
      { cost: '2v', cls: 'cost-2' },
      { cost: '3v', cls: 'cost-3' },
      { cost: '4v', cls: 'cost-4' },
      { cost: '5v', cls: 'cost-5' }
    ];

    gridEl.innerHTML = costs.map((c, i) => `
      <div class="overlay-odd-box">
        <div class="overlay-odd-cost ${c.cls}">${c.cost}</div>
        <div class="overlay-odd-val ${c.cls}">${Math.round((odds[i] || 0) * 100)}%</div>
      </div>
    `).join('');
  }

  // ------------------------------------------------------------- Render Quick Items
  function renderQuickItems() {
    const listEl = document.getElementById('overlayItemsList');
    if (!listEl) return;

    const comps = itemsData.COMPONENTS || [];
    const recipes = itemsData.RECIPES || [];

    listEl.innerHTML = recipes.slice(0, 16).map((r) => {
      const fromNames = (r.from || []).map((id) => {
        const found = comps.find((c) => c.id === id);
        return found ? found.vi.replace(' ', '') : id;
      }).join('+');

      return `
        <div class="overlay-item-row">
          <span class="overlay-item-name">${escapeHtml(r.vi)}</span>
          <span class="overlay-item-from">${escapeHtml(fromNames)}</span>
        </div>`;
    }).join('');
  }

  // ------------------------------------------------------------- Listeners
  function setupListeners() {
    if (!blitz.on) return;

    blitz.on('comp:pinned', (id) => {
      pinnedCompId = id;
      renderPinnedComp();
    });

    blitz.on('comps:updated', (comps) => {
      compsData = comps;
      renderPinnedComp();
    });

    blitz.on('live:data', (liveData) => {
      if (!liveData) return;
      if (liveData.round) {
        const badge = document.getElementById('hudRoundBadge');
        if (badge) badge.textContent = `Vòng ${liveData.round}`;
      }
      if (liveData.level && liveData.level !== currentLevel) {
        currentLevel = liveData.level;
        renderOdds();
      }
    });

    blitz.on('overlay:clickThrough', (enabled) => {
      updateLockLabel(enabled);
    });
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  init();
})();
