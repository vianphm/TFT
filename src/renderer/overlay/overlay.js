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
  var api = window.tft;

  var config = null;
  var comps = [];
  var countdownTimer = null;
  var countdownLeft = 0;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    config = await api.config.get();
    comps = await api.comps.list();

    buildRecipeGrid();
    applyWidgetState();
    bindDragging();
    bindHitAreas();
    bindOddsWidget();
    bindEconWidget();
    bindRoundWidget();
    bindCompWidget();
    bindNotesWidget();
    bindHud();
    setLockUi(config.overlay.clickThrough);

    api.on('overlay:click-through', setLockUi);
    api.on('overlay:widgets', function (widgets) {
      config.overlay.widgets = widgets;
      applyWidgetState();
    });
    api.on('comps:changed', function (next) {
      comps = next;
      fillCompPicker();
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
  }

  function setLockUi(clickThrough) {
    config.overlay.clickThrough = clickThrough;
    var hud = document.getElementById('hud');
    hud.classList.toggle('unlocked', !clickThrough);
    document.getElementById('hudState').textContent = clickThrough ? 'Da khoa' : 'Dang mo khoa';
    document.getElementById('hudHint').textContent = clickThrough
      ? 'Ctrl+Shift+E de mo khoa chuot'
      : 'Dang chan chuot vao game - Ctrl+Shift+E de khoa lai';
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
    var comps9 = tables.COMPONENTS;
    var html = '<tr><td class="cell head"></td>' + comps9.map(function (c) {
      return '<td class="cell head" title="' + c.name + '">' + shortName(c) + '</td>';
    }).join('') + '</tr>';

    grid.forEach(function (row) {
      html += '<tr><td class="cell head" title="' + row.component.name + '">' + shortName(row.component) + '</td>' +
        row.cells.map(function (cell) {
          return '<td class="cell" data-item="' + escapeHtml(cell.item || '') + '">' + escapeHtml(shortItem(cell.item)) + '</td>';
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
        '<b class="cost-5">' + escapeHtml(name) + '</b>' + (note ? ' &mdash; ' + escapeHtml(note) : '');
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

  function renderComp() {
    var pick = document.getElementById('compPick');
    var comp = comps.find(function (c) { return c.id === pick.value; }) || comps[0];
    var body = document.getElementById('compBody');
    if (!comp) {
      body.innerHTML = '<span class="muted">Chua co doi hinh nao. Mo dashboard de them.</span>';
      return;
    }
    body.innerHTML = comp.units.map(function (u) {
      return '<div class="unit-line ' + (u.carry ? 'carry' : '') + '">' +
        '<span class="cost-' + u.cost + '">' + escapeHtml(u.name) + '</span>' +
        '<span class="star">' + '*'.repeat(u.star || 2) + '</span>' +
        '<span class="items">' + escapeHtml((u.items || []).join(', ')) + '</span>' +
        '</div>';
    }).join('') +
    (comp.notes ? '<div class="small muted" style="margin-top:6px">' + escapeHtml(comp.notes) + '</div>' : '');
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
