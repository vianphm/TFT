/**
 * Logic cua lop phu trong game.
 * - Keo tha widget, nho vi tri vao config
 * - Khi khoa: chuot xuyen qua vung trong, chi bat lai khi ro vao widget
 * - Cac o tinh toan dung chung module TFT.calc
 */
(function () {
  'use strict';

  var calc = window.TFT.calc;
  var tables = window.TFT.tables;
  var analyzer = window.TFT.analyzer;
  var db = window.TFT.db;
  var api = window.tft;

  var config = null;
  var comps = [];
  var dataset = { champions: [], traits: [], augments: [] };
  var countdownTimer = null;
  var countdownLeft = 0;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    config = await api.config.get();
    comps = await api.comps.list();
    dataset = await api.data.load();

    buildRecipeGrid();
    applyWidgetState();
    bindDragging();
    bindHitAreas();
    bindOddsWidget();
    bindEconWidget();
    bindRoundWidget();
    bindAugmentsWidget();
    bindAdvisorWidget();
    bindNotesWidget();
    bindHud();
    initBlitzModules();
    setLockUi(config.overlay.clickThrough);

    api.on('overlay:click-through', setLockUi);
    api.on('overlay:widgets', function (widgets) {
      config.overlay.widgets = widgets;
      applyWidgetState();
    });
    api.on('data:updated', async function () {
      dataset = await api.data.load();
      renderAugmentDatalist();
      populateBlitzChampList();
    });
    api.on('comps:changed', function (next) {
      comps = next;
      fillCompPicker();
      populateBlitzShopComps();
    });
    api.on('live:game-data', function (liveData) {
      if (!liveData) return;
      if (liveData.round) {
        var rInput = document.getElementById('roundNow');
        if (rInput && rInput.value !== liveData.round) {
          rInput.value = liveData.round;
          renderRound();
        }
      }
      if (liveData.level) {
        var oLevel = document.getElementById('oddsLevel');
        if (oLevel && parseInt(oLevel.value, 10) !== liveData.level) {
          oLevel.value = liveData.level;
          renderOdds();
        }
      }
      if (liveData.gold !== null && liveData.gold !== undefined) {
        var eGold = document.getElementById('econGold');
        if (eGold && parseInt(eGold.value, 10) !== liveData.gold) {
          eGold.value = liveData.gold;
          renderEcon();
        }
      }
      updateBlitzLive(liveData);
    });
    api.on('live:status', function (status) {
      var stateText = document.getElementById('hudState');
      if (stateText && status.liveApiActive) {
        stateText.textContent = 'Live Riot (2999)';
      }
    });
    api.on('hotkey:action', function (action) {
      if (action === 'resetTimer') startCountdown(tables.ROUND_INFO.planningSeconds);
    });
  }

  // ------------------------------------------------------------- widget khung

  function widgetEl(name) {
    return document.querySelector('[data-widget="' + name + '"]');
  }

  function applyWidgetState() {
    Object.keys(config.overlay.widgets).forEach(function (name) {
      var state = config.overlay.widgets[name];
      var el = widgetEl(name);
      if (!el) return;
      el.style.left = (state.x || 20) + 'px';
      el.style.top = (state.y || 20) + 'px';
      el.classList.toggle('hidden', !state.visible);
      el.classList.toggle('collapsed', Boolean(state.collapsed));
      var btn = document.querySelector('[data-widget-toggle="' + name + '"]');
      if (btn) btn.setAttribute('aria-pressed', String(Boolean(state.visible)));
    });
  }

  function saveWidget(name, patch) {
    config.overlay.widgets[name] = Object.assign({}, config.overlay.widgets[name], patch);
    api.overlay.updateWidget(name, patch);
  }

  var isAnyDragging = false;
  var lastHoverInteractive = null;

  function setInteractiveHover(hovering) {
    if (!api || !api.overlay || !api.overlay.setHover) return;
    if (hovering !== lastHoverInteractive) {
      lastHoverInteractive = hovering;
      api.overlay.setHover(hovering);
    }
  }

  function bindDragging() {
    window.addEventListener('mousemove', function (event) {
      if (isAnyDragging) {
        setInteractiveHover(true);
        return;
      }
      var target = event.target;
      var hit = target && target.closest && target.closest('[data-hit], .widget, .hud, .blitz-card, .modal-card, #blitzSettingsModal, button, input, select, textarea');
      setInteractiveHover(Boolean(hit));
    });

    document.querySelectorAll('.widget').forEach(function (el) {
      var head = el.querySelector('.widget-head');
      var name = el.dataset.widget;
      var startX = 0, startY = 0, originX = 0, originY = 0, dragging = false;

      head.addEventListener('mousedown', function (event) {
        if (event.target.closest('button')) return;
        bringToFront(el);
        dragging = true;
        isAnyDragging = true;
        setInteractiveHover(true);
        startX = event.screenX;
        startY = event.screenY;
        originX = parseInt(el.style.left, 10) || 0;
        originY = parseInt(el.style.top, 10) || 0;
        event.preventDefault();
      });
      window.addEventListener('mousemove', function (event) {
        if (!dragging) return;
        var x = Math.max(0, originX + (event.screenX - startX));
        var y = Math.max(0, originY + (event.screenY - startY));
        el.style.left = x + 'px';
        el.style.top = y + 'px';
      });
      window.addEventListener('mouseup', function () {
        if (!dragging) return;
        dragging = false;
        isAnyDragging = false;
        saveWidget(name, { x: parseInt(el.style.left, 10), y: parseInt(el.style.top, 10) });
      });
    });
  }

  // ------------------------------------------------------------------ econ

  function bindEconWidget() {
    var gold = document.getElementById('econGold');
    var streak = document.getElementById('econStreak');
    var level = document.getElementById('econLevel');
    var xp = document.getElementById('econXp');

    gold.value = config.state.gold;
    streak.value = 0;
    level.value = config.state.level;
    xp.value = config.state.xp;

    function render() {
      var g = +gold.value;
      var income = calc.incomeNextRound({ gold: g, streak: +streak.value, win: false });
      var next = calc.levelCost(+level.value, +xp.value, +level.value + 1);
      var toNextInterest = (Math.floor(g / 10) + 1) * 10 - g;

      document.getElementById('econResult').innerHTML =
        '<div class="kv"><span>Lai</span><b>+' + income.interest + 'v</b></div>' +
        '<div class="kv"><span>Chuoi</span><b>+' + income.streak + 'v</b></div>' +
        '<div class="kv"><span>Thu nhap vong sau</span><b class="big">' + income.total + 'v</b></div>' +
        '<div class="kv"><span>Con ' + (income.interest >= tables.MAX_INTEREST ? 0 : toNextInterest) + 'v nua la them 1 lai</span><b>' +
          (income.interest >= tables.MAX_INTEREST ? 'da toi da' : 'moc ' + ((Math.floor(g / 10) + 1) * 10) + 'v') + '</b></div>' +
        '<div class="kv"><span>Len cap ' + (+level.value + 1) + '</span><b>' + next.gold + 'v (' + next.xp + ' XP)</b></div>';

      var rows = calc.projectGold({ gold: g, streak: +streak.value, win: false, rounds: 3, spendPerRound: 0 });
      document.getElementById('econPlan').innerHTML =
        '<span class="muted">Khong tieu gi: </span>' + rows.map(function (r) {
          return 'vong +' + r.round + ': <b>' + r.gold + 'v</b>';
        }).join(' &middot; ');

      api.config.patch({ state: { gold: g, level: +level.value, xp: +xp.value } });
    }

    [gold, streak, level, xp].forEach(function (el) {
      el.addEventListener('input', debounce(render, 80));
    });
    render();
  }

  // ------------------------------------------------------------------ rounds

  function bindRoundWidget() {
    var input = document.getElementById('roundNow');
    input.value = config.state.round || '2-1';

    function render() {
      var parsed = calc.parseRound(input.value);
      if (!parsed) {
        document.getElementById('roundResult').innerHTML = '<span class="muted">Nhap dang 3-2</span>';
        return;
      }
      var list = calc.upcomingRounds(input.value, 7);
      var far = calc.upcomingRounds(input.value, 21);   // tim xa hon de luon co moc ke tiep
      var nextAugment = far.find(function (r) { return r.augment; });
      var nextCarousel = far.find(function (r) { return r.carousel; });
      var roadmap = tables.LEVEL_ROADMAP.filter(function (r) { return r.round >= input.value; })[0];

      document.getElementById('roundResult').innerHTML =
        '<div class="round-tags">' + list.map(function (r) {
          var cls = r.augment ? 'augment' : r.carousel ? 'carousel' : r.pve ? 'pve' : '';
          return '<span class="tag ' + cls + '">' + r.label + (r.augment ? ' lo bai' : r.carousel ? ' chon do' : r.pve ? ' quai' : '') + '</span>';
        }).join('') + '</div>' +
        '<div class="kv"><span>Lo bai tang ke tiep</span><b>' + (nextAugment ? nextAugment.label : '-') + '</b></div>' +
        '<div class="kv"><span>Vong chon do ke tiep</span><b>' + (nextCarousel ? nextCarousel.label : '-') + '</b></div>' +
        (roadmap ? '<div class="kv"><span>Moc cap ' + roadmap.round + '</span><b>cap ' + roadmap.level + '</b></div>' +
          '<div class="small muted">' + roadmap.note + '</div>' : '');

      api.config.patch({ state: { round: input.value } });
    }

    input.addEventListener('input', debounce(render, 120));
    document.getElementById('roundPrev').addEventListener('click', function () { step(-1); });
    document.getElementById('roundNext').addEventListener('click', function () { step(1); });
    document.getElementById('roundTimer').addEventListener('click', function () {
      startCountdown(tables.ROUND_INFO.planningSeconds);
    });

    function step(delta) {
      var parsed = calc.parseRound(input.value) || { stage: 2, round: 1 };
      var round = parsed.round + delta;
      var stage = parsed.stage;
      if (round > tables.ROUND_INFO.roundsPerStage) { round = 1; stage++; }
      if (round < 1) { stage = Math.max(1, stage - 1); round = tables.ROUND_INFO.roundsPerStage; }
      input.value = stage + '-' + round;
      render();
      if (delta > 0) startCountdown(tables.ROUND_INFO.planningSeconds);
    }

    render();
  }

  function startCountdown(seconds) {
    countdownLeft = seconds;
    var el = document.getElementById('countdown');
    if (countdownTimer) clearInterval(countdownTimer);
    el.textContent = countdownLeft + 's';
    countdownTimer = setInterval(function () {
      countdownLeft--;
      el.textContent = countdownLeft > 0 ? countdownLeft + 's' : 'het!';
      if (countdownLeft <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        setTimeout(function () { el.textContent = ''; }, 3000);
      }
    }, 1000);
  }

  // ------------------------------------------------------------------- items

  function buildRecipeGrid() {
    var grid = calc.recipeGrid();
    var components = tables.COMPONENTS;
    var html = '<tr><td class="cell head"></td>' + components.map(function (c) {
      return '<td class="cell head" title="' + c.name + '">' + shortName(c) + '</td>';
    }).join('') + '</tr>';

    grid.forEach(function (row) {
      html += '<tr><td class="cell head" title="' + row.component.name + '">' + shortName(row.component) + '</td>' +
        row.cells.map(function (cell) {
          return '<td class="cell" data-item="' + escapeHtml(cell.item || '') + '">' +
            escapeHtml(shortItem(cell.itemVi || cell.item)) + '</td>';
        }).join('') + '</tr>';
    });

    var table = document.getElementById('recipeGrid');
    table.innerHTML = html;
    table.addEventListener('mouseover', function (event) {
      var td = event.target.closest('td[data-item]');
      if (!td) return;
      var name = td.dataset.item;
      var note = tables.ITEM_NOTES[name];
      document.getElementById('recipeHint').innerHTML =
        '<b class="cost-5">' + escapeHtml((tables.ITEM_NAMES_VI && tables.ITEM_NAMES_VI[name]) || name) + '</b>' +
        (note ? ' &mdash; ' + escapeHtml(note) : '');
    });
  }

  function shortName(component) {
    return component.vi.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 3);
  }

  function shortItem(name) {
    if (!name) return '';
    return name.replace(/'s\b/, '').split(' ').map(function (w) { return w.slice(0, 4); }).join(' ').slice(0, 12);
  }

  // -------------------------------------------------------------------- comp

  function bindCompWidget() {
    fillCompPicker();
    document.getElementById('compPick').addEventListener('change', renderComp);
    renderComp();
  }

  function fillCompPicker() {
    var pick = document.getElementById('compPick');
    var current = pick.value;
    pick.innerHTML = comps.map(function (c) {
      return '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>';
    }).join('');
    if (current) pick.value = current;
    renderComp();
  }

  var overlayOwnedMap = {};

  function renderComp() {
    var pick = document.getElementById('compPick');
    var comp = comps.find(function (c) { return c.id === pick.value; }) || comps[0];
    var body = document.getElementById('compBody');
    if (!comp) {
      body.innerHTML = '<span class="muted">Chua co doi hinh nao. Mo dashboard de them.</span>';
      return;
    }

    var plan = calc.buildCompRerollPlan(comp, overlayOwnedMap, {
      level: config.state.level || 7,
      gold: config.state.gold || 50
    });

    var headerHtml = '<div style="margin-bottom:6px;padding:4px;background:rgba(234,179,8,0.1);border-left:2px solid var(--gold);font-size:11px">' +
      '<b>' + escapeHtml(plan.rollStrategy) + '</b>' +
      '<div class="muted">Vang mua tuong con thieu: <b style="color:var(--gold)">' + plan.totalBuyGold + 'v</b></div>' +
    '</div>';

    var unitsHtml = (plan.shoppingList || []).map(function (item) {
      var isCarry = item.carry;
      return '<div class="unit-line ' + (isCarry ? 'carry' : '') + '" style="display:flex;justify-content:space-between;align-items:center">' +
        '<div><span class="cost-' + item.cost + '">' + escapeHtml(item.name) + '</span> ' + (isCarry ? '<span style="color:var(--gold);font-size:10px">★Carry</span>' : '') + '</div>' +
        '<div style="display:flex;align-items:center;gap:4px">' +
          '<button class="mini overlay-dec" data-champ="' + escapeHtml(item.name.toLowerCase()) + '" style="padding:1px 4px">-</button>' +
          '<span style="font-weight:bold;min-width:28px;text-align:center;font-size:11px">' + item.progress + '</span>' +
          '<button class="mini overlay-inc" data-champ="' + escapeHtml(item.name.toLowerCase()) + '" style="padding:1px 4px">+</button>' +
        '</div>' +
      '</div>';
    }).join('');

    body.innerHTML = headerHtml + unitsHtml +
      (comp.notes ? '<div class="small muted" style="margin-top:6px">' + escapeHtml(comp.notes) + '</div>' : '');

    body.querySelectorAll('.overlay-inc').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.dataset.champ;
        var cur = overlayOwnedMap[name] !== undefined ? overlayOwnedMap[name] : 1;
        overlayOwnedMap[name] = Math.min(9, cur + 1);
        renderComp();
      });
    });

    body.querySelectorAll('.overlay-dec').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.dataset.champ;
        var cur = overlayOwnedMap[name] !== undefined ? overlayOwnedMap[name] : 1;
        overlayOwnedMap[name] = Math.max(0, cur - 1);
        renderComp();
      });
    });
  }

  // ---------------------------------------------------------------- augments

  function bindAugmentsWidget() {
    var evalBtn = document.getElementById('overlayAugEval');
    if (evalBtn) evalBtn.addEventListener('click', evaluateOverlayAugments);
    renderAugmentDatalist();
  }

  function renderAugmentDatalist() {
    var dl = document.getElementById('overlayAugList');
    if (!dl || !dataset || !dataset.augments) return;
    dl.innerHTML = dataset.augments.map(function (a) {
      return '<option value="' + escapeHtml(a.name) + '">';
    }).join('');
  }

  function evaluateOverlayAugments() {
    var a1 = (document.getElementById('overlayAug1') && document.getElementById('overlayAug1').value || '').trim();
    var a2 = (document.getElementById('overlayAug2') && document.getElementById('overlayAug2').value || '').trim();
    var a3 = (document.getElementById('overlayAug3') && document.getElementById('overlayAug3').value || '').trim();
    var resultEl = document.getElementById('overlayAugResult');
    if (!resultEl || !dataset || !dataset.augments) return;

    var picks = [a1, a2, a3].filter(Boolean);
    if (!picks.length) {
      resultEl.innerHTML = '<span class="muted">Chon it nhat 1 loi.</span>';
      return;
    }

    var augs = picks.map(function (name) {
      return (dataset.augments || []).find(function (a) {
        return a.name.toLowerCase() === name.toLowerCase() ||
               a.name.toLowerCase().indexOf(name.toLowerCase()) >= 0;
      });
    }).filter(Boolean);

    var pickEl = document.getElementById('compPick');
    var comp = comps.find(function (c) { return c.id === (pickEl && pickEl.value); }) || comps[0];
    var state = {
      stage: config.state.round || '2-1',
      hp: 100,
      gold: config.state.gold || 50,
      board: (comp && comp.units) || []
    };

    var ranked = analyzer.rankAugments(augs, state, dataset);
    resultEl.innerHTML = ranked.map(function (r, idx) {
      var color = r.recommendation === 'must_pick' ? 'var(--green)' : r.recommendation === 'avoid' ? 'var(--red)' : 'var(--gold)';
      return '<div style="margin-top:4px;padding:4px;border-left:2px solid ' + color + ';background:rgba(0,0,0,.3)">' +
        '<b>#' + (idx + 1) + ' ' + escapeHtml(r.augment.name) + ' (' + r.score + 'd)</b>' +
        '<div class="small muted">' + escapeHtml(r.reason) + '</div>' +
      '</div>';
    }).join('');
  }

  // ---------------------------------------------------------------- advisor

  function bindAdvisorWidget() {
    var btn = document.getElementById('overlayAdviceBtn');
    if (btn) btn.addEventListener('click', renderOverlayAdvice);
    renderOverlayAdvice();
  }

  function renderOverlayAdvice() {
    var resultEl = document.getElementById('overlayAdviceResult');
    if (!resultEl) return;

    var pickEl = document.getElementById('compPick');
    var activeComp = comps.find(function (c) { return c.id === (pickEl && pickEl.value); }) || comps[0];

    var state = {
      board: (activeComp && activeComp.units) || [],
      bench: [],
      shop: [],
      components: [],
      hp: config.state.hp || 100,
      gold: config.state.gold || 50,
      level: config.state.level || 8,
      round: config.state.round || '3-2'
    };

    var advice = analyzer.generateComprehensiveAdvice(state, dataset, comps);
    var carryUnit = activeComp && (activeComp.units || []).find(function (u) { return u.carry; });
    var carouselItems = calc.carouselPriorities(activeComp, config.state.components || []);

    var carouselHtml = '';
    if (carouselItems.length) {
      carouselHtml = '<div style="background:rgba(59,130,246,0.1);color:#93c5fd;padding:4px 6px;border-radius:4px">' +
        '<b>🎪 Ưu tiên nhặt chợ:</b> ' + carouselItems.slice(0, 3).map(function (c) {
          return '<span class="tag" style="background:rgba(59,130,246,0.2);margin-right:2px">' + escapeHtml(c.name) + '</span>';
        }).join('') +
      '</div>';
    }

    resultEl.innerHTML = '<div style="font-size:11px;display:flex;flex-direction:column;gap:5px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<span style="color:var(--gold);font-weight:bold">🎯 ' + escapeHtml(advice.targetComp ? advice.targetComp.name : 'Chưa rõ') + '</span>' +
        '<span class="badge" style="background:var(--gold-dim);color:var(--gold)">' + escapeHtml(activeComp ? activeComp.tier || 'A' : 'A') + ' Tier</span>' +
      '</div>' +
      '<div style="background:rgba(255,255,255,0.03);padding:4px 6px;border-radius:4px">' +
        '<b>👑 Carry chính:</b> ' + escapeHtml(carryUnit ? carryUnit.name : 'Đa dụng') +
        (carryUnit && carryUnit.items ? ' • Đồ chuẩn: <span style="color:var(--gold)">' + carryUnit.items.map(function(it) { return escapeHtml((tables.ITEM_NAMES_VI && tables.ITEM_NAMES_VI[it]) || it); }).join(', ') + '</span>' : '') +
      '</div>' +
      carouselHtml +
      '<div style="color:#68d391;background:rgba(104,211,145,0.1);padding:4px 6px;border-radius:4px">' +
        '<b>💡 Hành động vòng này:</b> ' + escapeHtml(advice.econDecision.message) +
      '</div>' +
    '</div>';
  }

  // ------------------------------------------------------------------- notes

  function bindNotesWidget() {
    var el = document.getElementById('notes');
    if (!el) return;
    el.value = config.state.notes || '';
    el.addEventListener('input', debounce(function () {
      api.config.patch({ state: { notes: el.value } });
    }, 400));
  }

  // --------------------------------------------------------------------- hud
  function bindHud() {
    // Widget toggles
    document.querySelectorAll('[data-widget-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.dataset.widgetToggle;
        var current = (config.overlay && config.overlay.widgets && config.overlay.widgets[name]) || {};
        var nextVisible = !current.visible;
        saveWidget(name, { visible: nextVisible });
        applyWidgetState();
      });
    });

    // Blitz HUD button
    var blitzBtn = document.getElementById('hudBlitzBtn');
    if (blitzBtn) {
      blitzBtn.addEventListener('click', function () {
        var modal = document.getElementById('blitzSettingsModal');
        if (modal) modal.classList.toggle('hidden');
      });
    }

    // Lock button (click-through)
    var lockBtn = document.getElementById('hudLockBtn');
    if (lockBtn) {
      lockBtn.addEventListener('click', function () {
        var next = !config.overlay.clickThrough;
        api.overlay.setClickThrough(next);
      });
    }

    // Timer 30s button
    var timerBtn = document.getElementById('hudTimerBtn');
    if (timerBtn) {
      timerBtn.addEventListener('click', function () {
        startCountdown((tables.ROUND_INFO && tables.ROUND_INFO.planningSeconds) || 30);
      });
    }

    // Opacity toggle button
    var opacityBtn = document.getElementById('hudOpacityBtn');
    if (opacityBtn) {
      var opacities = [0.95, 0.8, 0.6, 0.4, 1.0];
      var opIndex = 0;
      opacityBtn.addEventListener('click', function () {
        opIndex = (opIndex + 1) % opacities.length;
        var op = opacities[opIndex];
        document.body.style.opacity = op;
        api.overlay.setOpacity(Math.round(op * 100));
      });
    }

    // Screen move button
    var screenBtn = document.getElementById('hudScreenBtn');
    if (screenBtn) {
      screenBtn.addEventListener('click', async function () {
        var list = await api.displays.list();
        if (list && list.length > 1) {
          var cur = config.overlay.displayId;
          var curIdx = list.findIndex(function (d) { return d.id === cur; });
          var nextDisplay = list[(curIdx + 1) % list.length];
          api.overlay.moveDisplay(nextDisplay.id);
        }
      });
    }

    // Open dashboard button
    var dashBtn = document.getElementById('hudDashBtn');
    if (dashBtn) {
      dashBtn.addEventListener('click', function () {
        api.dashboard.show();
      });
    }

    // Hide overlay button
    var hideBtn = document.getElementById('hudHideBtn');
    if (hideBtn) {
      hideBtn.addEventListener('click', function () {
        api.overlay.toggle(false);
      });
    }
  }

  function setLockUi(locked) {
    if (!config || !config.overlay) return;
    config.overlay.clickThrough = Boolean(locked);
    var hud = document.getElementById('hud');
    var dot = document.getElementById('hudDot');
    var state = document.getElementById('hudState');
    var lockLabel = document.getElementById('hudLockLabel');
    if (hud) hud.classList.toggle('unlocked', !locked);
    if (dot) {
      dot.style.background = locked ? 'var(--red)' : 'var(--green)';
    }
    if (state) {
      state.textContent = locked ? 'Đã khóa chuột (Xuyên game)' : 'Mở khóa (Tương tác HUD)';
    }
    if (lockLabel) {
      lockLabel.textContent = locked ? 'Khóa chuột: BẬT' : 'Khóa chuột: TẮT';
    }
  }

  // ===================================================================
  // 6 MODULES HUDS CHUẨN BLITZ / METATFT & MODAL CÀI ĐẶT
  // ===================================================================

  var blitzModules = {
    augmentInfo: false, // Chi bat khi den vong chon loi (2-1, 3-2, 4-2) hoac bam nut Loi
    championInfo: false, // Chi bat khi can xem do tuong
    compositions: true, // Goi y doi hinh o goc tren trai (gon gang)
    levelingBreakpoints: false, // An bot de tranh roi man hinh
    matchupTracking: false, // An bot
    shopHighlights: false // An bot
  };

  var blitzMatchHistory = [];
  var currentLobbyPlayers = [];
  var mySummoner = '';

  function initBlitzModules() {
    if (config.overlay && config.overlay.blitzModules) {
      blitzModules = Object.assign(blitzModules, config.overlay.blitzModules);
    } else if (config.blitzModules) {
      blitzModules = Object.assign(blitzModules, config.blitzModules);
    }

    applyBlitzModulesVisibility();
    bindBlitzModal();
    initBlitzUpdater();
    populateBlitzChampList();
    populateBlitzShopComps();

    // Khởi tạo hiển thị mặc định (dùng state đã lưu hoặc data demo)
    var initialLevel = (config.state && config.state.level) || 5;
    var initialGold = (config.state && config.state.gold) || 47;
    var initialXp = (config.state && config.state.xp) || 8;
    renderBlitzLeveling(initialLevel, initialGold, initialXp);
    renderBlitzShop();
    renderBlitzMatchup(generateDefaultLobby(), mySummoner);
    renderBlitzAugments(config.state.round || '2-1');
    renderBlitzChampInfo();
    renderBlitzCompositions();

    // Nút đóng các widget phụ
    var closeAug = document.getElementById('blitzAugCloseBtn');
    if (closeAug) closeAug.addEventListener('click', function () {
      document.getElementById('hudAugmentInfo').classList.add('hidden');
    });

    var closeChamp = document.getElementById('blitzChampCloseBtn');
    if (closeChamp) closeChamp.addEventListener('click', function () {
      document.getElementById('hudChampInfo').classList.add('hidden');
    });

    var closeComps = document.getElementById('blitzCompsCloseBtn');
    if (closeComps) closeComps.addEventListener('click', function () {
      document.getElementById('hudCompositions').classList.add('hidden');
    });
  }

  function applyBlitzModulesVisibility() {
    toggleAnchor('hudLeveling', blitzModules.levelingBreakpoints);
    toggleAnchor('hudShopHighlights', blitzModules.shopHighlights);
    toggleAnchor('hudMatchupTracker', blitzModules.matchupTracking);
    toggleAnchor('hudAugmentInfo', blitzModules.augmentInfo);
    toggleAnchor('hudChampInfo', blitzModules.championInfo);
    toggleAnchor('hudCompositions', blitzModules.compositions);

    // Cập nhật trạng thái nút trong Modal Cài đặt
    document.querySelectorAll('.blitz-toggle-btn').forEach(function (btn) {
      var mod = btn.getAttribute('data-mod');
      if (!mod) return;
      var isActive = Boolean(blitzModules[mod]);
      btn.classList.toggle('active', isActive);
      btn.classList.toggle('inactive', !isActive);
      btn.textContent = isActive ? 'Đã Bật' : 'Tắt';
    });
  }

  function toggleAnchor(elementId, isVisible) {
    var el = document.getElementById(elementId);
    if (!el) return;
    el.classList.toggle('hidden', !isVisible);
  }

  function bindBlitzModal() {
    var hudBtn = document.getElementById('hudBlitzBtn');
    var modal = document.getElementById('blitzSettingsModal');
    var closeBtn = document.getElementById('blitzSettingsClose');

    if (hudBtn && modal) {
      hudBtn.addEventListener('click', function () {
        modal.classList.toggle('hidden');
      });
    }

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', function () {
        modal.classList.add('hidden');
      });
    }

    // Xử lý bấm nút toggle trên từng card
    document.querySelectorAll('.blitz-toggle-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var mod = btn.getAttribute('data-mod');
        if (!mod) return;
        blitzModules[mod] = !blitzModules[mod];
        applyBlitzModulesVisibility();

        // Lưu config
        api.config.patch({
          overlay: { blitzModules: blitzModules }
        });
      });
    });
  }

  var currentUpdateInfo = null;

  function initBlitzUpdater() {
    var hudUpdateBtn = document.getElementById('hudUpdateBtn');
    var checkBtn = document.getElementById('blitzCheckUpdateBtn');
    var currentVerEl = document.getElementById('blitzCurrentVersion');
    var alertBox = document.getElementById('blitzUpdateAlert');
    var alertVerEl = document.getElementById('blitzAlertVer');
    var downloadBtn = document.getElementById('blitzDownloadUpdateBtn');
    var descEl = document.getElementById('blitzUpdateDesc');

    if (api && api.app && api.app.info) {
      api.app.info().then(function (info) {
        if (info && info.version && currentVerEl) {
          currentVerEl.textContent = 'v' + info.version;
        }
      }).catch(function () {});
    }

    function onUpdateFound(info) {
      currentUpdateInfo = info;
      var newVer = info.latestVersion || 'Mới';
      if (hudUpdateBtn) {
        hudUpdateBtn.style.display = 'inline-block';
        hudUpdateBtn.textContent = '🚀 Cập nhật v' + newVer;
      }
      if (alertBox) alertBox.classList.remove('hidden');
      if (alertVerEl) alertVerEl.textContent = 'v' + newVer;
      if (descEl) descEl.textContent = '🎉 Phiên bản mới v' + newVer + ' đã sẵn sàng! Bấm nút bên dưới để cập nhật ngay.';
    }

    if (api && api.on) {
      api.on('app:update-available', function (info) {
        if (info && info.hasUpdate) {
          onUpdateFound(info);
        }
      });
    }

    if (hudUpdateBtn) {
      hudUpdateBtn.addEventListener('click', function () {
        if (currentUpdateInfo && currentUpdateInfo.downloadUrl) {
          api.updater.openDownload(currentUpdateInfo.downloadUrl);
        } else if (api && api.updater) {
          api.updater.openDownload('https://github.com/vianphm/TFT/releases');
        }
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', function () {
        if (currentUpdateInfo && currentUpdateInfo.downloadUrl) {
          api.updater.openDownload(currentUpdateInfo.downloadUrl);
        } else if (api && api.updater) {
          api.updater.openDownload('https://github.com/vianphm/TFT/releases');
        }
      });
    }

    if (checkBtn) {
      checkBtn.addEventListener('click', async function () {
        checkBtn.disabled = true;
        checkBtn.textContent = '⏳ Đang kiểm tra...';
        if (descEl) descEl.textContent = 'Đang kiểm tra phiên bản mới từ GitHub...';

        try {
          if (api && api.updater && api.updater.check) {
            var res = await api.updater.check();
            if (res && res.hasUpdate) {
              onUpdateFound(res);
            } else {
              if (descEl) descEl.textContent = '✓ Bạn đang ở phiên bản mới nhất (' + (res.currentVersion || 'v0.1.0') + ').';
              if (currentVerEl && res.currentVersion) currentVerEl.textContent = 'v' + res.currentVersion;
            }
          }
        } catch (err) {
          if (descEl) descEl.textContent = 'Lỗi kiểm tra cập nhật: ' + err.message;
        } finally {
          checkBtn.disabled = false;
          checkBtn.textContent = '🔍 Kiểm tra cập nhật ngay';
        }
      });
    }

    // Tự động kiểm tra sau 3 giây khi vừa vào game
    if (api && api.updater && api.updater.check) {
      setTimeout(function () {
        api.updater.check().then(function (res) {
          if (res && res.hasUpdate) onUpdateFound(res);
        }).catch(function () {});
      }, 3000);
    }
  }

  function populateBlitzChampList() {
    var datalist = document.getElementById('blitzChampList');
    if (!datalist || !dataset.champions || !dataset.champions.length) return;
    datalist.innerHTML = dataset.champions.map(function (c) {
      return '<option value="' + escapeHtml(c.name) + '">' + c.cost + ' vàng (' + (c.traits || []).join(', ') + ')</option>';
    }).join('');
  }

  function populateBlitzShopComps() {
    var select = document.getElementById('blitzShopCompSelect');
    if (!select || !comps.length) return;
    select.innerHTML = comps.map(function (c, idx) {
      return '<option value="' + idx + '">' + escapeHtml(c.name) + ' (' + (c.tier || 'S') + ' Tier)</option>';
    }).join('');
    select.addEventListener('change', function () {
      renderBlitzShop();
      renderBlitzCompositions();
      renderBlitzAugments();
    });
  }

  function updateBlitzLive(liveData) {
    if (!liveData) return;
    if (liveData.summonerName) mySummoner = liveData.summonerName;

    // 1. Cập nhật Leveling Breakpoints
    var curLvl = liveData.level || (config.state && config.state.level) || 5;
    var curGold = liveData.gold !== null && liveData.gold !== undefined ? liveData.gold : ((config.state && config.state.gold) || 47);
    var curXp = liveData.xp !== null && liveData.xp !== undefined ? liveData.xp : ((config.state && config.state.xp) || 8);
    renderBlitzLeveling(curLvl, curGold, curXp);

    // 2. Cập nhật Matchup Tracking & Máu người chơi
    if (liveData.allPlayers && liveData.allPlayers.length) {
      currentLobbyPlayers = liveData.allPlayers;
      renderBlitzMatchup(currentLobbyPlayers, mySummoner);

      var me = currentLobbyPlayers.find(function (p) {
        return p.summonerName && mySummoner && p.summonerName.toLowerCase() === mySummoner.toLowerCase();
      });
      if (me && typeof me.health === 'number') {
        config.state = config.state || {};
        config.state.hp = me.health;
      }
    }
    if (typeof liveData.health === 'number') {
      config.state = config.state || {};
      config.state.hp = liveData.health;
    }

    // 3. Tự hiện bảng Augments khi đến vòng chọn lõi
    if (liveData.round) {
      var r = liveData.round;
      document.getElementById('blitzAugRound').textContent = r;
      if (blitzModules.augmentInfo && (r === '2-1' || r === '3-2' || r === '4-2')) {
        document.getElementById('hudAugmentInfo').classList.remove('hidden');
        renderBlitzAugments(r);
      }
    }
  }

  // 1. Render Leveling Breakpoints
  function renderBlitzLeveling(level, gold, xp) {
    var bp = calc.calcLevelBreakpoints(level, gold, xp);
    var xpEl = document.getElementById('blitzXpText');
    var affordEl = document.getElementById('blitzAffordText');

    if (xpEl) {
      xpEl.textContent = bp.xpRemaining + ' / ' + bp.targetXp + ' để lên cấp';
    }

    if (affordEl) {
      if (!bp.canLevelNow) {
        affordEl.className = 'blitz-afford-text afford-no';
        affordEl.textContent = 'Không đủ (' + gold + ' / ' + bp.goldCost + ')';
      } else {
        affordEl.className = 'blitz-afford-text afford-yes';
        affordEl.innerHTML = gold + ' &rsaquo; ' + bp.goldAfter + ' vàng <span class="blitz-interest-tag">+' + bp.interestAfter + 'g lãi</span>';
      }
    }
  }

  // 2. Render Shop Highlights
  function renderBlitzShop() {
    var select = document.getElementById('blitzShopCompSelect');
    var compIdx = select ? parseInt(select.value, 10) || 0 : 0;
    var targetComp = comps[compIdx] || comps[0];

    var compUnits = (targetComp && targetComp.units) || [];
    var compNames = compUnits.map(function (u) { return (u.name || '').toLowerCase(); });
    var carryNames = compUnits.filter(function (u) { return u.carry; }).map(function (u) { return (u.name || '').toLowerCase(); });

    var countEl = document.getElementById('blitzShopCompCount');
    if (countEl) countEl.textContent = compUnits.length + ' tướng trong bài';

    // Đánh giá 5 ô shop
    for (var i = 0; i < 5; i++) {
      var slotEl = document.querySelector('.blitz-slot[data-slot="' + i + '"]');
      var inputEl = document.getElementById('blitzSlotInput' + i);
      var tagEl = document.getElementById('blitzSlotTag' + i);
      if (!slotEl || !inputEl) continue;

      var champVal = (inputEl.value || '').trim().toLowerCase();
      var isMatched = champVal && compNames.indexOf(champVal) !== -1;
      var isCarry = champVal && carryNames.indexOf(champVal) !== -1;

      slotEl.classList.toggle('highlight', Boolean(isMatched));
      slotEl.classList.toggle('carry', Boolean(isCarry));

      if (tagEl) {
        tagEl.textContent = isCarry ? '👑 Carry' : '⭐ Comp';
      }
    }

    // Sự kiện nhập và nút test
    for (var j = 0; j < 5; j++) {
      var inp = document.getElementById('blitzSlotInput' + j);
      if (inp && !inp.dataset.bound) {
        inp.dataset.bound = '1';
        inp.addEventListener('input', renderBlitzShop);
      }
    }

    var testBtn = document.getElementById('blitzShopTestBtn');
    if (testBtn && !testBtn.dataset.bound) {
      testBtn.dataset.bound = '1';
      testBtn.addEventListener('click', function () {
        if (!dataset.champions || !dataset.champions.length) return;
        for (var k = 0; k < 5; k++) {
          var randomChamp = dataset.champions[Math.floor(Math.random() * dataset.champions.length)];
          // Thử lấy 1-2 con trùng comp để thấy hiệu ứng
          if (k === 0 && compUnits.length) randomChamp = compUnits[0];
          if (k === 2 && compUnits.length > 1) randomChamp = compUnits[1];
          var el = document.getElementById('blitzSlotInput' + k);
          if (el) el.value = randomChamp.name;
        }
        renderBlitzShop();
      });
    }
  }

  // 3. Render Matchup Tracking
  function generateDefaultLobby() {
    return [
      { summonerName: 'Sobermann', health: 43, isDead: false, level: 8 },
      { summonerName: 'DragonSlayer', health: 68, isDead: false, level: 8 },
      { summonerName: 'FakerTFT', health: 82, isDead: false, level: 9 },
      { summonerName: 'GamerVN99', health: 29, isDead: false, level: 7 },
      { summonerName: 'CloudWalker', health: 51, isDead: false, level: 8 },
      { summonerName: 'NightWolf', health: 14, isDead: false, level: 7 },
      { summonerName: 'SilentBlade', health: 0, isDead: true, level: 6 }
    ];
  }

  function renderBlitzMatchup(allPlayers, myName) {
    var pool = calc.calcMatchupPool(allPlayers, myName, blitzMatchHistory);
    var subEl = document.getElementById('blitzMatchupSub');
    var listEl = document.getElementById('blitzMatchupList');
    if (!listEl) return;

    if (subEl) subEl.textContent = 'Pool: ' + pool.possibleOpponents.length + ' nhà';

    listEl.innerHTML = pool.opponents.map(function (op) {
      var cls = 'blitz-matchup-item ' + op.status.replace('_', '-');
      var badgeHtml = '';
      if (op.status === 'last_played') badgeHtml = '<span class="badge-last">Last Played</span>';
      else if (op.status === 'possible') badgeHtml = '<span class="badge-possible">⚔️ Có thể gặp</span>';
      else if (op.status === 'dead') badgeHtml = '<span class="muted" style="font-size:9px">Đã loại</span>';

      return '<div class="' + cls + '" data-name="' + escapeHtml(op.summonerName) + '">' +
        '<span class="blitz-matchup-name" title="' + escapeHtml(op.summonerName) + '">' + escapeHtml(op.summonerName) + '</span>' +
        '<span style="font-size:10px;color:#38bdf8">' + op.health + ' HP</span>' +
        badgeHtml +
      '</div>';
    }).join('');

    // Click vào đối thủ để đánh dấu "Last Played"
    listEl.querySelectorAll('.blitz-matchup-item').forEach(function (row) {
      row.addEventListener('click', function () {
        var name = row.getAttribute('data-name');
        if (!name) return;
        blitzMatchHistory.unshift(name);
        if (blitzMatchHistory.length > 5) blitzMatchHistory.pop();
        renderBlitzMatchup(currentLobbyPlayers.length ? currentLobbyPlayers : generateDefaultLobby(), mySummoner);
      });
    });
  }

  // 4. Render Augment Info (Đề xuất chọn Lõi Nâng Cấp)
  function renderBlitzAugments(round) {
    var augList = dataset.augments || [];
    var select = document.getElementById('blitzShopCompSelect');
    var compIdx = select ? parseInt(select.value, 10) || 0 : 0;
    var targetComp = comps[compIdx] || comps[0];

    // Lấy trạng thái máu, vàng, vòng đấu hiện tại
    var curHp = (config.state && typeof config.state.hp === 'number') ? config.state.hp : 85;
    var curGold = (config.state && typeof config.state.gold === 'number') ? config.state.gold : 50;
    var curRound = round || (config.state && config.state.round) || '2-1';

    var roundEl = document.getElementById('blitzAugRound');
    if (roundEl) roundEl.textContent = curRound;

    var compBadgeEl = document.getElementById('blitzAugCompBadge');
    if (compBadgeEl && targetComp) {
      compBadgeEl.textContent = 'Đang chơi: 🛡️ ' + targetComp.name;
    }

    // 1. Phân tích chiến lược chọn Lõi Nâng Cấp dựa trên Bài & Sức mạnh đội hình / Máu
    var strategy = analyzer.getCompAugmentStrategy ? analyzer.getCompAugmentStrategy(targetComp, {
      hp: curHp,
      gold: curGold,
      stage: curRound
    }, dataset) : {
      hpStatus: 'safe',
      playstyleLabel: targetComp && targetComp.style ? targetComp.style : 'Tiêu chuẩn',
      advice: 'Cân bằng giữa giao tranh và kinh tế.'
    };

    var hpEl = document.getElementById('blitzAugHpStatus');
    var styleEl = document.getElementById('blitzAugStyleStatus');
    var adviceEl = document.getElementById('blitzAugAdviceText');

    if (hpEl) {
      var hpDesc = strategy.hpStatus === 'critical' ? 'Máu Thấp / Nguy Hiểm' : (strategy.hpStatus === 'safe' ? 'Máu Dồi Dào' : 'Máu Ổn Định');
      hpEl.textContent = 'Máu: ' + curHp + ' HP (' + hpDesc + ')';
      hpEl.className = 'blitz-strategy-hp ' + strategy.hpStatus;
    }
    if (styleEl) {
      styleEl.textContent = 'Lối chơi: ' + strategy.playstyleLabel;
    }
    if (adviceEl) {
      adviceEl.textContent = strategy.advice;
    }

    // 2. Chuẩn bị dữ liệu và gắn sự kiện input cho 3 thẻ lõi
    for (var i = 0; i < 3; i++) {
      var inp = document.getElementById('blitzAugInput' + i);
      if (!inp) continue;

      if (!inp.dataset.bound) {
        inp.dataset.bound = '1';
        inp.addEventListener('input', function () {
          renderBlitzAugments(curRound);
        });
      }

      if (!inp.value && augList.length > i) {
        inp.value = augList[i * 7 + 2] ? augList[i * 7 + 2].name : (augList[i] ? augList[i].name : '');
      }
    }

    // 3. Đánh giá và so sánh cả 3 lõi nâng cấp cùng lúc
    evaluateAllThreeAugments(targetComp, curHp, curGold, curRound);
  }

  function evaluateAllThreeAugments(targetComp, curHp, curGold, curRound) {
    var cardsData = [];

    for (var i = 0; i < 3; i++) {
      var inp = document.getElementById('blitzAugInput' + i);
      var val = (inp && inp.value ? inp.value : '').trim();

      var found = (dataset.augments || []).find(function (a) {
        return a.name && a.name.toLowerCase() === val.toLowerCase();
      });
      if (!found && val) {
        found = (dataset.augments || []).find(function (a) {
          return a.name && a.name.toLowerCase().indexOf(val.toLowerCase()) >= 0;
        });
      }

      var augData = found || {
        name: val || 'Lõi ' + (i + 1),
        tier: 'gold',
        tags: ['combat'],
        top4Rate: 50.0,
        winRate: 12.0,
        desc: 'Chọn hoặc gõ tên lõi nâng cấp từ danh sách để xem phân tích chi tiết.'
      };

      var rankedList = analyzer.rankAugments([augData], {
        targetComp: targetComp,
        hp: curHp,
        gold: curGold,
        stage: curRound
      }, dataset);

      var r = (rankedList && rankedList[0]) || {
        category: 'combat',
        categoryLabel: '⚔️ Lõi Combat',
        recommendation: 'situational',
        recommendationLabel: '⚠️ Cân Nhắc',
        score: 50,
        reason: 'Lõi cân bằng chỉ số tổng thể.'
      };

      cardsData.push({ idx: i, augData: augData, evalResult: r });
    }

    // Xác định thứ hạng điểm số giữa 3 lõi để đưa ra Action chuẩn xác
    var maxScore = Math.max.apply(Math, cardsData.map(function (c) { return c.evalResult.score; }));
    var minScore = Math.min.apply(Math, cardsData.map(function (c) { return c.evalResult.score; }));

    cardsData.forEach(function (c) {
      var idx = c.idx;
      var augData = c.augData;
      var r = c.evalResult;

      var cardEl = document.getElementById('blitzAugCard' + idx);
      var actionEl = document.getElementById('blitzAugAction' + idx);
      var catEl = document.getElementById('blitzAugCat' + idx);
      var recEl = document.getElementById('blitzAugRec' + idx);
      var tierEl = document.getElementById('blitzAugTier' + idx);
      var nameEl = document.getElementById('blitzAugName' + idx);
      var statsEl = document.getElementById('blitzAugStats' + idx);
      var descEl = document.getElementById('blitzAugDesc' + idx);
      var reasonEl = document.getElementById('blitzAugReason' + idx);
      if (!cardEl) return;

      // 1. Phán quyết hành động cho người chơi
      if (actionEl) {
        if (r.score === maxScore && r.score >= 60) {
          actionEl.textContent = '👑 NÊN CHỌN NGAY (TỐT NHẤT)';
          actionEl.className = 'blitz-aug-action action-pick';
        } else if (r.score < 45 || r.recommendation === 'avoid' || (r.score === minScore && r.score <= 55)) {
          actionEl.textContent = '🎲 NÊN ĐỔI LẠI (REROLL)';
          actionEl.className = 'blitz-aug-action action-reroll';
        } else {
          actionEl.textContent = '✓ CÂN NHẮC (PHƯƠNG ÁN 2)';
          actionEl.className = 'blitz-aug-action action-consider';
        }
      }

      // 2. Nội dung chi tiết của lõi
      if (nameEl) nameEl.textContent = augData.name;
      if (tierEl) {
        var tierText = String(augData.tier || 'gold').toUpperCase();
        tierEl.textContent = 'Tier ' + tierText.charAt(0);
        tierEl.style.background = tierText.indexOf('PRISMATIC') >= 0 || tierText === 'S'
          ? 'linear-gradient(135deg, #ec4899, #8b5cf6)'
          : (tierText.indexOf('GOLD') >= 0 || tierText === 'A'
            ? 'linear-gradient(135deg, #f59e0b, #d97706)'
            : 'linear-gradient(135deg, #94a3b8, #64748b)');
        tierEl.style.color = '#fff';
      }

      if (catEl) {
        catEl.textContent = r.categoryLabel || '⚔️ Combat';
        catEl.className = 'blitz-aug-cat cat-' + (r.category || 'combat');
      }

      if (recEl) {
        recEl.textContent = r.recommendationLabel + ' (' + r.score + '/100)';
        recEl.className = 'blitz-aug-rec rec-' + (r.recommendation ? r.recommendation.replace('_', '-') : 'situational');
      }

      if (statsEl) {
        statsEl.textContent = (augData.top4Rate || 52.4) + '% Top 4 • ' + (augData.winRate || 13.8) + '% Win';
      }

      if (descEl) {
        descEl.textContent = augData.desc || augData.effects || 'Tăng cường sức mạnh đội hình.';
      }

      if (reasonEl) {
        reasonEl.textContent = '💡 ' + r.reason;
      }

      cardEl.classList.toggle('highlight-must', r.score === maxScore && r.score >= 60);
      cardEl.classList.toggle('highlight-avoid', r.recommendation === 'avoid' || r.score < 45);
    });
  }

  // 5. Render Champion Info & BiS Items
  function renderBlitzChampInfo() {
    var preview = document.getElementById('blitzOddsPreview');
    var lvl = (config.state && config.state.level) || 8;
    var odds = calc.shopOdds(lvl);

    if (preview) {
      preview.innerHTML = [
        '<span style="color:#94a3b8">1v: <b>' + Math.round(odds[0] * 100) + '%</b></span>',
        '<span style="color:#22c55e">2v: <b>' + Math.round(odds[1] * 100) + '%</b></span>',
        '<span style="color:#3b82f6">3v: <b>' + Math.round(odds[2] * 100) + '%</b></span>',
        '<span style="color:#a855f7">4v: <b>' + Math.round(odds[3] * 100) + '%</b></span>',
        '<span style="color:#f59e0b">5v: <b>' + Math.round(odds[4] * 100) + '%</b></span>'
      ].join('');
    }

    var searchInput = document.getElementById('blitzChampSearchInput');
    var resultEl = document.getElementById('blitzChampBisResult');
    if (!searchInput || !resultEl) return;

    function renderBis() {
      var val = (searchInput.value || '').trim();
      if (!val) {
        resultEl.innerHTML = '<span class="muted">Gõ tên tướng để xem 3 đồ chuẩn trấn phái (BiS).</span>';
        return;
      }
      var champ = (dataset.champions || []).find(function (c) {
        return c.name && c.name.toLowerCase().includes(val.toLowerCase());
      });
      if (!champ) {
        resultEl.innerHTML = '<span class="muted">Không tìm thấy tướng.</span>';
        return;
      }

      var items = champ.items || ['Infinity Edge', 'Last Whisper', 'Giant Slayer'];
      resultEl.innerHTML = '<div style="background:rgba(255,255,255,0.05);padding:6px;border-radius:6px">' +
        '<div style="font-weight:700;color:var(--gold);margin-bottom:4px">' + escapeHtml(champ.name) + ' (' + champ.cost + ' vàng)</div>' +
        '<div style="font-size:10px;color:#94a3b8;margin-bottom:4px">Tộc/Hệ: ' + (champ.traits || []).join(', ') + '</div>' +
        '<div style="font-size:11px"><b>3 Đồ Chuẩn (BiS):</b></div>' +
        '<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">' +
          items.map(function (it) {
            return '<span class="tag" style="background:rgba(245,158,11,0.2);color:#f59e0b">' + escapeHtml(it) + '</span>';
          }).join('') +
        '</div>' +
      '</div>';
    }

    searchInput.addEventListener('input', debounce(renderBis, 150));
    renderBis();
  }

  // 6. Render Top-Left Suggestion Panel (Đang gợi ý đội hình như Blitz)
  var blitzActiveCompTab = 'early';

  function renderBlitzCompositions() {
    var select = document.getElementById('blitzShopCompSelect');
    var compIdx = select ? parseInt(select.value, 10) || 0 : 0;
    var targetComp = comps[compIdx] || comps[0];
    if (!targetComp) return;

    var badgeEl = document.getElementById('blitzCompBadge');
    if (badgeEl) badgeEl.textContent = '🛡️ ' + targetComp.name;

    var unitsEl = document.getElementById('blitzSuggestUnits');
    if (unitsEl) {
      var allUnits = targetComp.units || [];
      var earlyUnit = allUnits[0] || { name: 'Xayah', cost: 1 };
      var targetUnits = blitzActiveCompTab === 'early' ? allUnits.slice(1, 10) : allUnits;

      var earlyHtml = '<div class="blitz-unit-item" title="' + escapeHtml(earlyUnit.name) + ' (' + earlyUnit.cost + 'v)">' +
        '<div class="blitz-unit-box cost-' + (earlyUnit.cost || 1) + '">' + escapeHtml(earlyUnit.name.slice(0, 3)) + '</div>' +
        '<div class="blitz-unit-name">' + escapeHtml(earlyUnit.name) + '</div>' +
      '</div>' +
      '<div class="blitz-arrow-sep">&#10140;</div>';

      var restHtml = targetUnits.map(function (u) {
        var cost = u.cost || 1;
        var shortN = (u.name || '').slice(0, 3);
        return '<div class="blitz-unit-item" title="' + escapeHtml(u.name) + ' (' + cost + 'v)">' +
          '<div class="blitz-unit-box cost-' + cost + '">' + escapeHtml(shortN) + '</div>' +
          '<div class="blitz-unit-name">' + escapeHtml(u.name) + '</div>' +
        '</div>';
      }).join('');

      unitsEl.innerHTML = earlyHtml + restHtml;
    }

    // Bind tab clicks
    var tabEarly = document.getElementById('blitzTabEarly');
    var tabFinal = document.getElementById('blitzTabFinal');
    if (tabEarly && !tabEarly.dataset.bound) {
      tabEarly.dataset.bound = '1';
      tabEarly.addEventListener('click', function () {
        blitzActiveCompTab = 'early';
        tabEarly.classList.add('active');
        if (tabFinal) tabFinal.classList.remove('active');
        renderBlitzCompositions();
      });
    }
    if (tabFinal && !tabFinal.dataset.bound) {
      tabFinal.dataset.bound = '1';
      tabFinal.addEventListener('click', function () {
        blitzActiveCompTab = 'final';
        tabFinal.classList.add('active');
        if (tabEarly) tabEarly.classList.remove('active');
        renderBlitzCompositions();
      });
    }

    // Bind action buttons
    var useBtn = document.getElementById('blitzUseCompBtn');
    if (useBtn && !useBtn.dataset.bound) {
      useBtn.dataset.bound = '1';
      useBtn.addEventListener('click', function () {
        renderBlitzShop();
        useBtn.textContent = '✓ Đã kích hoạt highlight Shop';
        setTimeout(function () { useBtn.textContent = '★ Sử dụng đội hình này'; }, 2000);
      });
    }

    var allBtn = document.getElementById('blitzAllCompsBtn');
    if (allBtn && !allBtn.dataset.bound) {
      allBtn.dataset.bound = '1';
      allBtn.addEventListener('click', function () {
        openAllCompsModal();
      });
    }
  }

  // ===================================================================
  // MODAL XEM TẤT CẢ ĐỘI HÌNH (CHUẨN BLITZ TRONG ẢNH)
  // ===================================================================

  var allCompsModalBound = false;

  function openAllCompsModal() {
    var modal = document.getElementById('blitzAllCompsModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    if (!allCompsModalBound) {
      allCompsModalBound = true;
      var closeBtn = document.getElementById('blitzAllCompsClose');
      if (closeBtn) closeBtn.addEventListener('click', function () {
        modal.classList.add('hidden');
      });

      var searchInp = document.getElementById('blitzCompSearchInput');
      var traitFilter = document.getElementById('blitzCompTraitFilter');
      var sortSelect = document.getElementById('blitzCompSort');

      if (searchInp) searchInp.addEventListener('input', debounce(renderAllCompsList, 150));
      if (traitFilter) traitFilter.addEventListener('change', renderAllCompsList);
      if (sortSelect) sortSelect.addEventListener('change', renderAllCompsList);

      // Nạp danh sách tộc hệ vào dropdown
      if (traitFilter && dataset.traits && dataset.traits.length) {
        traitFilter.innerHTML = '<option value="">✳ Tất Cả Tộc Hệ</option>' +
          dataset.traits.map(function (t) {
            return '<option value="' + escapeHtml(t.name) + '">' + escapeHtml(t.name) + '</option>';
          }).join('');
      }
    }

    renderAllCompsList();
  }

  function renderAllCompsList() {
    var listEl = document.getElementById('blitzAllCompsList');
    if (!listEl) return;

    var searchVal = (document.getElementById('blitzCompSearchInput').value || '').trim().toLowerCase();
    var traitVal = (document.getElementById('blitzCompTraitFilter').value || '').trim().toLowerCase();
    var sortVal = document.getElementById('blitzCompSort').value || 'tier';

    var filtered = (comps || []).filter(function (c) {
      if (!c) return false;
      var nameMatch = !searchVal || (c.name || '').toLowerCase().includes(searchVal);
      var champMatch = !searchVal || (c.units || []).some(function (u) {
        return (u.name || '').toLowerCase().includes(searchVal);
      });
      var traitMatch = !traitVal || (c.traits || []).some(function (t) {
        return (t || '').toLowerCase().includes(traitVal);
      });
      return (nameMatch || champMatch) && traitMatch;
    });

    // Sắp xếp
    filtered.sort(function (a, b) {
      if (sortVal === 'avg') {
        var avgA = a.avgPlace || 4.0;
        var avgB = b.avgPlace || 4.0;
        return avgA - avgB;
      }
      if (sortVal === 'pick') {
        var pickA = parseFloat(String(a.pickRate || '10').replace(',', '.'));
        var pickB = parseFloat(String(b.pickRate || '10').replace(',', '.'));
        return pickB - pickA;
      }
      if (sortVal === 'win') {
        var winA = parseFloat(String(a.winRate || '15').replace(',', '.'));
        var winB = parseFloat(String(b.winRate || '15').replace(',', '.'));
        return winB - winA;
      }
      if (sortVal === 'top4') {
        var topA = parseFloat(String(a.top4 || '50').replace(',', '.'));
        var topB = parseFloat(String(b.top4 || '50').replace(',', '.'));
        return topB - topA;
      }
      // Mặc định: theo Bậc (Tier S > A > B)
      var tierOrder = { 'S': 1, 'A': 2, 'B': 3, 'C': 4 };
      return (tierOrder[a.tier] || 9) - (tierOrder[b.tier] || 9);
    });

    if (!filtered.length) {
      listEl.innerHTML = '<div class="muted" style="text-align:center;padding:30px">Không tìm thấy đội hình phù hợp.</div>';
      return;
    }

    listEl.innerHTML = filtered.map(function (c) {
      var compIdx = comps.indexOf(c);
      var units = c.units || [];
      var flexUnits = c.flexUnits || [];
      var avgPlace = c.avgPlace ? c.avgPlace.toFixed(2).replace('.', ',') : '3,97';
      var pickRate = c.pickRate || '15,4%';
      var winRate = c.winRate || '15,3%';
      var top4Rate = c.top4 || '60,1%';

      var unitsHtml = units.map(function (u) {
        var cost = u.cost || 1;
        var starHtml = u.star === 3 ? '<span class="blitz-star-badge">⭐⭐⭐</span>' : '';
        var itemsHtml = (u.items || []).slice(0, 3).map(function (it) {
          var shortIt = it.split(' ').map(function(w){return w[0];}).join('');
          return '<span class="blitz-mini-item" title="' + escapeHtml(it) + '">' + escapeHtml(shortIt) + '</span>';
        }).join('');

        return '<div class="blitz-champ-slot">' +
          starHtml +
          '<div class="blitz-champ-img cost-' + cost + '" title="' + escapeHtml(u.name) + ' (' + cost + 'v)">' +
            escapeHtml(u.name.slice(0, 2)) +
          '</div>' +
          '<span class="blitz-champ-name-sub">' + escapeHtml(u.name) + '</span>' +
          (itemsHtml ? '<div class="blitz-champ-items-row">' + itemsHtml + '</div>' : '') +
        '</div>';
      }).join('');

      var flexHtml = '';
      if (flexUnits.length) {
        flexHtml = '<div class="blitz-units-section">' +
          '<span class="blitz-section-label">Linh Hoạt</span>' +
          '<div class="blitz-section-row">' +
            flexUnits.map(function (u) {
              var cost = u.cost || 1;
              var starHtml = u.star === 3 ? '<span class="blitz-star-badge">⭐⭐⭐</span>' : '';
              var itemsHtml = (u.items || []).slice(0, 3).map(function (it) {
                var shortIt = it.split(' ').map(function(w){return w[0];}).join('');
                return '<span class="blitz-mini-item" title="' + escapeHtml(it) + '">' + escapeHtml(shortIt) + '</span>';
              }).join('');
              return '<div class="blitz-champ-slot">' +
                starHtml +
                '<div class="blitz-champ-img cost-' + cost + '">' + escapeHtml(u.name.slice(0, 2)) + '</div>' +
                '<span class="blitz-champ-name-sub">' + escapeHtml(u.name) + '</span>' +
                (itemsHtml ? '<div class="blitz-champ-items-row">' + itemsHtml + '</div>' : '') +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>';
      }

      return '<div class="blitz-comp-card">' +
        '<div class="blitz-comp-card-head">' +
          '<div class="blitz-comp-title-group">' +
            '<span class="blitz-tier-shield">' + escapeHtml(c.tier || 'S') + '</span>' +
            '<span class="blitz-comp-card-name">' + escapeHtml(c.name) + '</span>' +
          '</div>' +
          '<span class="blitz-playstyle-pill">' + escapeHtml(c.style || 'Fast 8') + '</span>' +
        '</div>' +
        '<div class="blitz-comp-card-body">' +
          '<div class="blitz-comp-units-group">' +
            '<div class="blitz-units-section">' +
              '<span class="blitz-section-label">Trấn Phái</span>' +
              '<div class="blitz-section-row">' + unitsHtml + '</div>' +
            '</div>' +
            flexHtml +
          '</div>' +
          '<div class="blitz-comp-stats-group">' +
            '<div class="blitz-stat-col">' +
              '<span class="blitz-stat-label">TB</span>' +
              '<span class="blitz-stat-val avg">' + avgPlace + '</span>' +
            '</div>' +
            '<div class="blitz-stat-col">' +
              '<span class="blitz-stat-label">TL Chọn</span>' +
              '<span class="blitz-stat-val">' + pickRate + '</span>' +
            '</div>' +
            '<div class="blitz-stat-col">' +
              '<span class="blitz-stat-label">Hạng 1</span>' +
              '<span class="blitz-stat-val">' + winRate + '</span>' +
            '</div>' +
            '<div class="blitz-stat-col">' +
              '<span class="blitz-stat-label">Top 4</span>' +
              '<span class="blitz-stat-val">' + top4Rate + '</span>' +
            '</div>' +
            '<button class="blitz-card-btn" data-comp-idx="' + compIdx + '">' +
              '📥 Dùng bài này' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    // Bắt sự kiện bấm nút "Dùng bài này"
    listEl.querySelectorAll('.blitz-card-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-comp-idx'), 10);
        var select = document.getElementById('blitzShopCompSelect');
        if (select) {
          select.value = idx;
        }
        renderBlitzCompositions();
        renderBlitzShop();
        renderBlitzAugments();

        // Ẩn modal và thông báo
        document.getElementById('blitzAllCompsModal').classList.add('hidden');
        var useBtn = document.getElementById('blitzUseCompBtn');
        if (useBtn) {
          useBtn.textContent = '✓ Đã kích hoạt highlight Shop';
          setTimeout(function () { useBtn.textContent = '★ Sử dụng đội hình này'; }, 2000);
        }
      });
    });
  }

  // ------------------------------------------------------------------- utils

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
