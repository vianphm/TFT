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
    api.on('live:game-data', function (liveData) {
      if (liveData && liveData.round) {
        var rInput = document.getElementById('roundNow');
        if (rInput && rInput.value !== liveData.round) {
          rInput.value = liveData.round;
          renderRound();
        }
      }
      if (liveData && liveData.level) {
        var oLevel = document.getElementById('oddsLevel');
        if (oLevel && parseInt(oLevel.value, 10) !== liveData.level) {
          oLevel.value = liveData.level;
          renderOdds();
        }
      }
      if (liveData && liveData.gold !== null && liveData.gold !== undefined) {
        var eGold = document.getElementById('econGold');
        if (eGold && parseInt(eGold.value, 10) !== liveData.gold) {
          eGold.value = liveData.gold;
          renderEcon();
        }
      }
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
