/**
 * Logic cua lop phu trong game.
 * - Keo tha widget, nho vi tri vao config
 * - Khi khoa: chuot xuyen qua vung trong, chi bat lai khi ro vao widget
 * - Cac o tinh toan dung chung module TFT.calc
 * - Widget "Tu dong" (advisor) tu lam moi theo du lieu Live Client API / thao tac
 *   cua nguoi choi, khong can bam nut - cac widget con lai mac dinh an bot de
 *   gon man hinh, bat lai qua thanh HUD khi can tra cuu sau.
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
  var displays = [];

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    config = await api.config.get();
    comps = await api.comps.list();
    dataset = await api.data.load();
    displays = await api.displays.list();

    buildRecipeGrid();
    applyWidgetState();
    bindDragging();
    bindHitAreas();
    bindOddsWidget();
    bindEconWidget();
    bindRoundWidget();
    bindAugmentsWidget();
    bindAdvisorWidget();
    bindCompWidget();
    bindNotesWidget();
    bindHud();
    setLockUi(config.overlay.clickThrough);

    api.on('overlay:click-through', setLockUi);
    api.on('overlay:widgets', function (widgets) {
      config.overlay.widgets = widgets;
      applyWidgetState();
    });
    api.on('data:updated', async function () {
      dataset = await api.data.load();
      renderAugmentDatalist();
    });
    api.on('comps:changed', function (next) {
      comps = next;
      fillCompPicker();
    });
    api.on('displays:changed', async function () {
      displays = await api.displays.list();
    });
    api.on('live:game-data', function (liveData) {
      if (!liveData) return;
      // Bao nhap 'input' that de kich hoat render + luu trang thai cua tung o,
      // khong tu tien tinh toan lai tai day de tranh trung logic.
      if (liveData.round) {
        var rInput = document.getElementById('roundNow');
        if (rInput && rInput.value !== liveData.round) {
          rInput.value = liveData.round;
          rInput.dispatchEvent(new Event('input'));
        }
      }
      if (liveData.level) {
        var oLevel = document.getElementById('oddsLevel');
        if (oLevel && parseInt(oLevel.value, 10) !== liveData.level) {
          oLevel.value = liveData.level;
          oLevel.dispatchEvent(new Event('input'));
        }
        var eLevel = document.getElementById('econLevel');
        if (eLevel && parseInt(eLevel.value, 10) !== liveData.level) {
          eLevel.value = liveData.level;
          eLevel.dispatchEvent(new Event('input'));
        }
      }
      if (liveData.gold !== null && liveData.gold !== undefined) {
        var eGold = document.getElementById('econGold');
        if (eGold && parseInt(eGold.value, 10) !== liveData.gold) {
          eGold.value = liveData.gold;
          eGold.dispatchEvent(new Event('input'));
        }
      }
      renderOverlayAdvice();
    });
    api.on('live:status', function (status) {
      var stateText = document.getElementById('hudState');
      if (stateText) stateText.textContent = status.liveApiActive ? 'Live Riot (2999)' : (config.overlay.clickThrough ? 'Da khoa' : 'Dang mo khoa');
      var liveTag = document.getElementById('advisorLiveTag');
      if (liveTag) {
        liveTag.textContent = status.liveApiActive ? '🟢 Live' : '⚪ Thu cong';
        liveTag.title = status.liveApiActive
          ? 'Dang doc vang/cap/vong tu Riot Live Client API'
          : 'Chua vao tran hoac API chua san sang - nhap tay o duoi';
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

  function bindDragging() {
    document.querySelectorAll('.widget').forEach(function (el) {
      var head = el.querySelector('.widget-head');
      var name = el.dataset.widget;
      var startX = 0, startY = 0, originX = 0, originY = 0, dragging = false;

      head.addEventListener('mousedown', function (event) {
        if (event.target.closest('button')) return;
        bringToFront(el);
        dragging = true;
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
        saveWidget(name, { x: parseInt(el.style.left, 10), y: parseInt(el.style.top, 10) });
      });

      el.querySelector('[data-collapse]').addEventListener('click', function () {
        var collapsed = !el.classList.contains('collapsed');
        el.classList.toggle('collapsed', collapsed);
        saveWidget(name, { collapsed: collapsed });
      });
      el.querySelector('[data-close]').addEventListener('click', function () {
        el.classList.add('hidden');
        saveWidget(name, { visible: false });
        var btn = document.querySelector('[data-widget-toggle="' + name + '"]');
        if (btn) btn.setAttribute('aria-pressed', 'false');
      });
    });
  }

  /** Chuot vao vung [data-hit] -> mo tuong tac tam thoi, ra khoi -> tra lai xuyen chuot. */
  var topZ = 10;
  function bringToFront(el) {
    topZ += 1;
    el.style.zIndex = topZ;
  }

  function bindHitAreas() {
    var inside = false;
    document.addEventListener('mousemove', function (event) {
      var hit = Boolean(event.target.closest('[data-hit]:not(.hidden)'));
      if (hit === inside) return;
      inside = hit;
      api.overlay.setHover(hit);
    });
    document.addEventListener('mouseleave', function () {
      inside = false;
      api.overlay.setHover(false);
    });
  }

  function bindHud() {
    document.querySelectorAll('[data-widget-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.dataset.widgetToggle;
        var el = widgetEl(name);
        var visible = el.classList.contains('hidden');
        el.classList.toggle('hidden', !visible);
        btn.setAttribute('aria-pressed', String(visible));
        saveWidget(name, { visible: visible });
      });
    });

    bindHudButton('hudLockBtn', function () {
      api.overlay.setClickThrough(!config.overlay.clickThrough);
    });
    bindHudButton('hudTimerBtn', function () {
      startCountdown(tables.ROUND_INFO.planningSeconds);
    });
    bindHudButton('hudOpacityBtn', function () {
      var next = (config.overlay.opacity || 0.92) - 0.15;
      if (next < 0.35) next = 0.92;
      config.overlay.opacity = next;
      api.overlay.setOpacity(next);
    });
    bindHudButton('hudScreenBtn', function () {
      if (!displays || displays.length < 2) return;
      var currentId = config.overlay.displayId;
      var idx = displays.findIndex(function (d) { return d.id === currentId; });
      var next = displays[(idx + 1) % displays.length];
      config.overlay.displayId = next.id;
      api.overlay.moveToDisplay(next.id);
    });
    bindHudButton('hudDashBtn', function () {
      api.dashboard.show();
    });
    bindHudButton('hudHideBtn', function () {
      api.overlay.toggle(false);
    });
  }

  function bindHudButton(id, handler) {
    var btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', handler);
  }

  function setLockUi(clickThrough) {
    config.overlay.clickThrough = clickThrough;
    var hud = document.getElementById('hud');
    hud.classList.toggle('unlocked', !clickThrough);
    var stateText = document.getElementById('hudState');
    if (stateText && stateText.textContent.indexOf('Live') < 0) {
      stateText.textContent = clickThrough ? 'Da khoa' : 'Dang mo khoa';
    }
    var lockBtn = document.getElementById('hudLockBtn');
    if (lockBtn) lockBtn.textContent = clickThrough ? '🔒 Khoa chuot' : '🔓 Mo khoa';
  }

  // ------------------------------------------------------------------- odds

  function bindOddsWidget() {
    var state = config.state;
    var level = document.getElementById('oddsLevel');
    var cost = document.getElementById('oddsCost');
    var owned = document.getElementById('oddsOwned');
    var taken = document.getElementById('oddsTaken');
    var rolls = document.getElementById('oddsRolls');

    level.value = state.level;
    cost.value = state.champCost;
    owned.value = state.copiesOwned;
    taken.value = state.copiesTakenByOthers;
    rolls.value = state.rolls;

    function render() {
      var opts = {
        level: +level.value,
        cost: +cost.value,
        copiesOwnedByYou: +owned.value,
        copiesTakenByOthers: +taken.value,
        rolls: +rolls.value,
        copiesNeeded: 1
      };
      var out = calc.rollOutcome(opts);
      document.getElementById('oddsRollsLabel').textContent = rolls.value;
      document.getElementById('oddsGold').textContent = out.goldSpent;

      var need2 = calc.rollOutcome(Object.assign({}, opts, { copiesNeeded: 2 }));
      var need3 = calc.rollOutcome(Object.assign({}, opts, { copiesNeeded: 3 }));
      document.getElementById('oddsResult').innerHTML =
        '<div class="kv"><span>Trung it nhat 1 ban</span><b class="big">' + calc.percent(out.probabilityAtLeastOne, 0) + '</b></div>' +
        '<div class="bar"><i style="width:' + (out.probabilityAtLeastOne * 100).toFixed(0) + '%"></i></div>' +
        '<div class="kv"><span>Trung 2 ban / 3 ban</span><b>' + calc.percent(need2.probabilityAtLeastNeeded, 0) + ' / ' + calc.percent(need3.probabilityAtLeastNeeded, 0) + '</b></div>' +
        '<div class="kv"><span>Ky vong so ban sao</span><b>' + out.expectedCopies.toFixed(2) + '</b></div>' +
        '<div class="kv"><span>Vang trung binh de co 1 ban</span><b>' + (isFinite(out.expectedGoldForOne) ? Math.round(out.expectedGoldForOne) + 'v' : '-') + '</b></div>' +
        '<div class="kv"><span>Con lai trong kho</span><b>' + out.copiesLeftInPool + ' ban</b></div>';

      var odds = calc.shopOdds(+level.value);
      document.getElementById('oddsTable').innerHTML =
        '<tr>' + odds.map(function (p, i) {
          return '<td class="cost-' + (i + 1) + '">' + (i + 1) + 'v</td>';
        }).join('') + '</tr>' +
        '<tr>' + odds.map(function (p) {
          return '<td class="num">' + Math.round(p * 100) + '%</td>';
        }).join('') + '</tr>';

      api.config.patch({ state: {
        level: +level.value, champCost: +cost.value,
        copiesOwned: +owned.value, copiesTakenByOthers: +taken.value, rolls: +rolls.value
      } });
      renderOverlayAdvice();
    }

    [level, cost, owned, taken, rolls].forEach(function (el) {
      el.addEventListener('input', debounce(render, 80));
    });
    render();
  }

  // ------------------------------------------------------------------- econ

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
      renderOverlayAdvice();
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
      renderOverlayAdvice();
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
    document.getElementById('compPick').addEventListener('change', function () {
      renderComp();
      renderOverlayAdvice();
    });
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
  //
  // Widget duy nhat hien mac dinh: gop tom tat doi hinh muc tieu, hanh dong
  // kinh te va uu tien nhat do vong di cho vao 1 the gon. Tu lam moi khi co
  // du lieu Live Client moi hoac khi nguoi choi doi vong/vang/doi hinh - khong
  // bat buoc phai bam nut. O "Cua hang" va "Linh kien dang cam" o duoi la
  // phan nguoi choi tu quan sat va go tay (khong co API doc duoc man hinh dau
  // trong hoac vi tri ban co), rieng vong di cho van can nguoi choi tu chon
  // do tren san khau theo goi y "uu tien nhat".

  function bindAdvisorWidget() {
    var btn = document.getElementById('overlayAdviceBtn');
    if (btn) btn.addEventListener('click', renderOverlayAdvice);

    var shopInput = document.getElementById('advisorShop');
    if (shopInput) {
      shopInput.value = (config.state.shop || []).join(', ');
      shopInput.addEventListener('input', debounce(function () {
        var list = shopInput.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        api.config.patch({ state: { shop: list } });
        config.state.shop = list;
        renderOverlayAdvice();
      }, 250));
    }

    var compInput = document.getElementById('advisorComponents');
    if (compInput) {
      compInput.value = (config.state.components || []).join(', ');
      compInput.addEventListener('input', debounce(function () {
        var list = compInput.value.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
        api.config.patch({ state: { components: list } });
        config.state.components = list;
        renderOverlayAdvice();
      }, 250));
    }

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
      shop: config.state.shop || [],
      components: config.state.components || [],
      hp: config.state.hp || 100,
      gold: config.state.gold || 50,
      level: config.state.level || 8,
      round: config.state.round || '3-2'
    };

    var advice = analyzer.generateComprehensiveAdvice(state, dataset, comps);
    var carryUnit = activeComp && (activeComp.units || []).find(function (u) { return u.carry; });
    var carouselItems = calc.carouselPriorities(activeComp, state.components);

    var shopHtml = '';
    if (advice.shopAdvice && advice.shopAdvice.length) {
      shopHtml = '<div style="background:rgba(255,255,255,0.03);padding:4px 6px;border-radius:4px">' +
        '<b>🛒 Cua hang:</b> ' + advice.shopAdvice.map(function (s) {
          var color = s.action === 'buy' ? 'var(--green)' : s.action === 'hold' ? 'var(--gold)' : 'var(--muted)';
          return '<span class="tag" style="border-color:' + color + ';color:' + color + ';margin-right:2px" title="' + escapeHtml(s.reason) + '">' + escapeHtml(s.name) + '</span>';
        }).join('') +
      '</div>';
    }

    var carouselHtml = '';
    var upcomingCarousel = calc.upcomingRounds(state.round, 3).find(function (r) { return r.carousel; });
    if (carouselItems.length && upcomingCarousel) {
      carouselHtml = '<div style="background:rgba(59,130,246,0.1);color:#93c5fd;padding:4px 6px;border-radius:4px">' +
        '<b>🎪 Uu tien nhat do (' + upcomingCarousel.label + '):</b> ' + carouselItems.slice(0, 3).map(function (c) {
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
      shopHtml +
      carouselHtml +
      '<div style="color:#68d391;background:rgba(104,211,145,0.1);padding:4px 6px;border-radius:4px">' +
        '<b>💡 Hành động vòng này:</b> ' + escapeHtml(advice.econDecision.message) +
      '</div>' +
    '</div>';
  }

  // ------------------------------------------------------------------- notes

  function bindNotesWidget() {
    var el = document.getElementById('notes');
    el.value = config.state.notes || '';
    el.addEventListener('input', debounce(function () {
      api.config.patch({ state: { notes: el.value } });
    }, 400));
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
