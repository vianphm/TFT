'use strict';

(async function () {
  const blitz = window.blitz || {};

  let compsData = [];
  let itemsData = { COMPONENTS: [], RECIPES: [] };
  let tablesData = {};
  let pinnedCompId = '';
  let selectedComponent = 'all';
  let currentLevel = 8;
  let activeTierFilter = 'all';
  let searchQuery = '';

  // ------------------------------------------------------------- Khởi tạo
  async function init() {
    setupTabs();
    setupHeaderActions();

    try {
      [compsData, itemsData, tablesData, pinnedCompId] = await Promise.all([
        blitz.getComps ? blitz.getComps() : [],
        blitz.getItems ? blitz.getItems() : { COMPONENTS: [], RECIPES: [] },
        blitz.getTables ? blitz.getTables() : {},
        blitz.getPinnedComp ? blitz.getPinnedComp() : ''
      ]);
    } catch (e) {
      console.error('Loi tai du lieu ban dau:', e);
    }

    renderComps();
    renderItems();
    renderOdds();
    renderEcon();
    renderRoadmap();
    setupCustomCompForm();
    setupListeners();

    // Check game status ban dau
    if (blitz.getGameStatus) {
      const status = await blitz.getGameStatus();
      updateGameStatus(status);
    }
  }

  // ------------------------------------------------------------- Tabs
  function setupTabs() {
    document.querySelectorAll('.nav-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
        document.querySelectorAll('.tab-view').forEach((v) => v.classList.remove('active'));

        tab.classList.add('active');
        const viewId = `view-${tab.dataset.tab}`;
        const view = document.getElementById(viewId);
        if (view) view.classList.add('active');
      });
    });

    // Tier filters
    document.querySelectorAll('.tier-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tier-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeTierFilter = btn.dataset.tier;
        renderComps();
      });
    });

    // Comp search
    const searchInput = document.getElementById('compSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderComps();
      });
    }
  }

  // ------------------------------------------------------------- Header Actions
  function setupHeaderActions() {
    const btnOverlay = document.getElementById('btnToggleOverlay');
    if (btnOverlay) {
      btnOverlay.addEventListener('click', () => {
        if (blitz.toggleOverlay) blitz.toggleOverlay();
      });
    }

    const btnClickThrough = document.getElementById('btnToggleClickThrough');
    let clickThroughActive = true;
    if (btnClickThrough) {
      btnClickThrough.addEventListener('click', async () => {
        clickThroughActive = !clickThroughActive;
        if (blitz.setClickThrough) await blitz.setClickThrough(clickThroughActive);
        updateClickThroughBtn(clickThroughActive);
      });
    }
  }

  function updateClickThroughBtn(enabled) {
    const label = document.getElementById('clickThroughLabel');
    if (label) {
      label.textContent = enabled ? 'Xuyên Chuột: BẬT (F3)' : 'Khóa Chuột: TẮT (F3)';
    }
  }

  // ------------------------------------------------------------- Status Realtime
  function updateGameStatus(status) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    if (!dot || !text) return;

    if (status && status.gameRunning) {
      dot.className = 'status-dot online';
      text.textContent = 'Đang trong trận TFT (Đã ghim Overlay)';
    } else if (status && status.clientRunning) {
      dot.className = 'status-dot client';
      text.textContent = 'Client Riot đang bật (Chờ vào trận)';
    } else {
      dot.className = 'status-dot offline';
      text.textContent = 'Chưa vào game (Mở TFT để tự động kích hoạt)';
    }
  }

  // ------------------------------------------------------------- Render Comps
  function renderComps() {
    const container = document.getElementById('compsList');
    if (!container) return;

    let filtered = compsData.filter((c) => {
      const matchTier = activeTierFilter === 'all' || c.tier === activeTierFilter;
      const matchSearch =
        !searchQuery ||
        c.name.toLowerCase().includes(searchQuery) ||
        (c.traits && c.traits.some((t) => t.name.toLowerCase().includes(searchQuery))) ||
        (c.units && c.units.some((u) => u.name.toLowerCase().includes(searchQuery)));
      return matchTier && matchSearch;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--text-muted)">
          Không tìm thấy đội hình phù hợp. Hãy thử tìm từ khóa khác hoặc bấm tab "Tự Tạo Đội Hình".
        </div>`;
      return;
    }

    container.innerHTML = filtered.map((c) => {
      const isPinned = c.id === pinnedCompId;
      const tierClass = c.tier === 'S' ? 'badge-s' : c.tier === 'A' ? 'badge-a' : 'badge-b';

      const traitsHtml = (c.traits || [])
        .map((t) => `<span class="trait-pill">${escapeHtml(t.name)} (${t.count})</span>`)
        .join('');

      const unitsHtml = (c.units || [])
        .map((u) => {
          const costCls = `cost-${u.cost || 1}`;
          const itemsHtml = (u.items || [])
            .map((it) => `<span class="unit-item-tag" title="${escapeHtml(it)}">${escapeHtml(it)}</span>`)
            .join('');

          return `
            <div class="unit-card ${u.carry ? 'is-carry' : ''}">
              <span class="unit-star">${'★'.repeat(u.star || 2)}</span>
              <span class="unit-name ${costCls}">${escapeHtml(u.name)}</span>
              <div class="unit-items">${itemsHtml}</div>
            </div>`;
        })
        .join('');

      return `
        <div class="comp-card" id="card-${c.id}">
          <div class="comp-card-header">
            <div class="comp-title-area">
              <span class="badge ${tierClass}">Tier ${c.tier}</span>
              <span class="comp-name">${escapeHtml(c.name)}</span>
              <span class="comp-playstyle">${escapeHtml(c.playstyle || 'Standard')}</span>
            </div>
            <button class="btn ${isPinned ? 'btn-primary' : 'btn-outline-gold'} btn-pin" data-comp-id="${c.id}">
              ${isPinned ? '★ Đang Ghim In-Game' : '📌 Ghim Vào Overlay'}
            </button>
          </div>

          <div class="comp-traits">${traitsHtml}</div>
          <div class="comp-units-row">${unitsHtml}</div>

          <div class="comp-stats-footer">
            <div class="comp-stats">
              <span>Hạng TB: <b>#${c.avgPlace || '3.9'}</b></span>
              <span>Top 4: <b>${c.top4Rate || '58%'}</b></span>
              <span>Thắng: <b>${c.winRate || '18%'}</b></span>
            </div>
            <div style="font-size:12px;color:var(--text-muted)">
              ${escapeHtml(c.notes || '')}
            </div>
          </div>
        </div>`;
    }).join('');

    // Binds pin buttons
    container.querySelectorAll('.btn-pin').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.compId;
        pinnedCompId = id;
        if (blitz.pinComp) await blitz.pinComp(id);
        renderComps();
      });
    });
  }

  // ------------------------------------------------------------- Render Items
  function renderItems() {
    const compSelector = document.getElementById('componentsSelector');
    const itemsList = document.getElementById('itemsList');
    if (!compSelector || !itemsList) return;

    const comps = itemsData.COMPONENTS || [];
    const recipes = itemsData.RECIPES || [];

    // Component Buttons
    let compBtns = `<button class="comp-btn ${selectedComponent === 'all' ? 'active' : ''}" data-comp="all">Tất Cả (${recipes.length})</button>`;
    compBtns += comps.map((c) => `
      <button class="comp-btn ${selectedComponent === c.id ? 'active' : ''}" data-comp="${c.id}" title="${escapeHtml(c.stat)}">
        ${escapeHtml(c.vi)}
      </button>
    `).join('');
    compSelector.innerHTML = compBtns;

    compSelector.querySelectorAll('.comp-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedComponent = btn.dataset.comp;
        renderItems();
      });
    });

    // Recipes List
    const filteredRecipes = recipes.filter((r) => {
      if (selectedComponent === 'all') return true;
      return r.from && r.from.includes(selectedComponent);
    });

    itemsList.innerHTML = filteredRecipes.map((r) => {
      const fromNames = (r.from || []).map((id) => {
        const found = comps.find((c) => c.id === id);
        return found ? found.vi : id;
      }).join(' + ');

      return `
        <div class="item-card">
          <div class="item-card-head">
            <span class="item-name">${escapeHtml(r.vi)}</span>
            <span class="item-recipe-formula">${escapeHtml(fromNames)}</span>
          </div>
          <div style="font-size:11px;font-weight:700;color:var(--gold)">Role: ${escapeHtml(r.role || 'Đa dụng')}</div>
          <div class="item-desc">${escapeHtml(r.desc)}</div>
        </div>`;
    }).join('');
  }

  // ------------------------------------------------------------- Render Odds
  function renderOdds() {
    const btnContainer = document.getElementById('levelButtons');
    const displayGrid = document.getElementById('oddsDisplay');
    if (!btnContainer || !displayGrid) return;

    const oddsMap = (tablesData && tablesData.SHOP_ODDS) || {};

    let btns = '';
    for (let lv = 1; lv <= 11; lv++) {
      btns += `<button class="level-btn ${currentLevel === lv ? 'active' : ''}" data-lv="${lv}">C${lv}</button>`;
    }
    btnContainer.innerHTML = btns;

    btnContainer.querySelectorAll('.level-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentLevel = parseInt(btn.dataset.lv, 10);
        renderOdds();
      });
    });

    const currentOdds = oddsMap[String(currentLevel)] || [0, 0, 0, 0, 0];
    const costs = [
      { cost: 1, label: 'Tướng 1 Vàng', cls: 'cost-1' },
      { cost: 2, label: 'Tướng 2 Vàng', cls: 'cost-2' },
      { cost: 3, label: 'Tướng 3 Vàng', cls: 'cost-3' },
      { cost: 4, label: 'Tướng 4 Vàng', cls: 'cost-4' },
      { cost: 5, label: 'Tướng 5 Vàng', cls: 'cost-5' }
    ];

    displayGrid.innerHTML = costs.map((c, idx) => {
      const pct = Math.round((currentOdds[idx] || 0) * 100);
      return `
        <div class="odds-col">
          <div class="odds-cost-label ${c.cls}">${c.label}</div>
          <div class="odds-val ${c.cls}">${pct}%</div>
        </div>`;
    }).join('');
  }

  // ------------------------------------------------------------- Econ Simulator
  function renderEcon() {
    const goldInput = document.getElementById('calcGold');
    const streakSelect = document.getElementById('calcStreak');
    const resBox = document.getElementById('econResult');
    if (!goldInput || !streakSelect || !resBox) return;

    const update = () => {
      const gold = Math.max(0, parseInt(goldInput.value, 10) || 0);
      const streakGold = parseInt(streakSelect.value, 10) || 0;
      const interest = Math.min(5, Math.floor(gold / 10));
      const baseIncome = 5;
      const totalNextRound = baseIncome + interest + streakGold;
      const nextInterestGold = interest < 5 ? (interest + 1) * 10 - gold : 0;

      resBox.innerHTML = `
        <div class="econ-res-box">
          <span>Lợi tức vòng sau:</span>
          <b>+${interest} Vàng</b>
        </div>
        <div class="econ-res-box">
          <span>Tổng thu nhập vòng tới:</span>
          <b>+${totalNextRound} Vàng</b>
        </div>
        <div class="econ-res-box">
          <span>Cần thêm để lên mốc lãi:</span>
          <b>${interest >= 5 ? 'Đã đạt tối đa' : `${nextInterestGold} vàng nữa (+${interest + 1})`}</b>
        </div>`;
    };

    goldInput.addEventListener('input', update);
    streakSelect.addEventListener('change', update);
    update();
  }

  // ------------------------------------------------------------- Roadmap
  function renderRoadmap() {
    const container = document.getElementById('roadmapList');
    if (!container) return;

    const list = (tablesData && tablesData.ROUND_ROADMAP) || [];
    container.innerHTML = list.map((r) => `
      <div class="roadmap-item">
        <span class="roadmap-round">${r.round}</span>
        <span class="roadmap-level">Mốc Cấp: ${r.level}</span>
        <span class="roadmap-event">${escapeHtml(r.event)}</span>
      </div>
    `).join('');
  }

  // ------------------------------------------------------------- Custom Comp Form
  function setupCustomCompForm() {
    const form = document.getElementById('customCompForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newCompName').value.trim();
      const tier = document.getElementById('newCompTier').value;
      const playstyle = document.getElementById('newCompPlaystyle').value.trim();
      const rawUnits = document.getElementById('newCompUnits').value.trim();
      const notes = document.getElementById('newCompNotes').value.trim();

      if (!name || !rawUnits) return;

      // Parse units: "Caitlyn (IE, Shojin), Vi"
      const units = rawUnits.split(',').map((part) => {
        part = part.trim();
        const match = part.match(/^([^(]+)(?:\(([^)]+)\))?/);
        if (!match) return { name: part, cost: 3, star: 2, items: [] };
        const uName = match[1].trim();
        const items = match[2] ? match[2].split(',').map((it) => it.trim()) : [];
        return {
          name: uName,
          cost: items.length > 0 ? 4 : 2,
          star: 2,
          carry: items.length > 0,
          items
        };
      });

      const newComp = {
        id: `custom-${Date.now()}`,
        name,
        tier,
        playstyle,
        avgPlace: 3.5,
        winRate: '20%',
        top4Rate: '60%',
        traits: [{ name: 'Tự Tạo', count: units.length }],
        units,
        notes
      };

      compsData.unshift(newComp);
      pinnedCompId = newComp.id;

      if (blitz.saveComps) await blitz.saveComps(compsData);
      if (blitz.pinComp) await blitz.pinComp(newComp.id);

      renderComps();

      // Switch back to comps tab
      const compsTab = document.querySelector('[data-tab="comps"]');
      if (compsTab) compsTab.click();

      form.reset();
      alert(`Đã lưu và ghim đội hình "${name}" vào In-Game Overlay thành công!`);
    });
  }

  // ------------------------------------------------------------- Listeners
  function setupListeners() {
    if (!blitz.on) return;

    blitz.on('game:status', (status) => {
      updateGameStatus(status);
    });

    blitz.on('live:data', (liveData) => {
      if (liveData && liveData.round) {
        const text = document.getElementById('statusText');
        if (text) text.textContent = `Đang trong trận: Vòng ${liveData.round} (Cấp ${liveData.level})`;
      }
    });

    blitz.on('overlay:clickThrough', (enabled) => {
      updateClickThroughBtn(enabled);
    });

    blitz.on('comp:pinned', (id) => {
      pinnedCompId = id;
      renderComps();
    });

    blitz.on('comps:updated', (comps) => {
      compsData = comps;
      renderComps();
    });
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Bắt đầu
  init();
})();
