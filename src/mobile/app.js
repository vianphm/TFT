/**
 * TFT Companion - ban chay tren dien thoai (PWA).
 *
 * Dung chung tables.js / calc.js / analyzer.js voi ban PC. Khac biet:
 *  - Luu trang thai vao localStorage thay vi file cau hinh
 *  - Lay doi hinh + du lieu set tu app PC qua wifi, hoac tu Community Dragon, hoac dan JSON
 *  - Giao dien mot cot, nut to, thanh tab duoi cung
 */
(function () {
  'use strict';

  var calc = window.TFT.calc;
  var tables = window.TFT.tables;
  var analyzer = window.TFT.analyzer;
  var cdragon = window.TFT.cdragon;
  var db = window.TFT.db;

  var KEYS = { state: 'tft.state', comps: 'tft.comps', data: 'tft.data', pc: 'tft.pcUrl' };

  var state = load(KEYS.state, {
    level: 8, cost: 4, owned: 0, taken: 0, gold: 40, need: 1,
    money: 50, streak: 0, win: false, lvl: 7, xp: 0,
    round: '2-1', notes: '', bag: {}, tab: 'roll', compId: null
  });
  var comps = load(KEYS.comps, []);
  var dataset = load(KEYS.data, { champions: [], traits: [], setName: null });
  var pcUrl = load(KEYS.pc, '');

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    // App Android mo trang nay trong cua so noi voi ?compact=1
    if (/[?&]compact=1/.test(location.search)) document.body.classList.add('compact');
    applyRealPool();
    bindTabs();
    bindSteppers();
    bindRoll();
    bindEcon();
    bindItems();
    bindComps();
    bindRound();
    bindAugments();
    bindMobileReroll();
    bindMobileScout();
    bindSync();
    renderTop();
    showTab(state.tab || 'roll');
    registerServiceWorker();
    checkMobileUpdates();
    if (pcUrl) pullFromPc(pcUrl).catch(function () { /* PC chua bat, khong sao */ });
    // Lan dau mo tren web: tu lay database cua set, khong bat nguoi dung phai bam
    if (!dataset.champions.length) fetchSet(false).catch(function () { /* offline thi thoi */ });
  }

  // -------------------------------------------------------------- khung suon

  function bindTabs() {
    document.querySelectorAll('.tabbar .tab').forEach(function (btn) {
      btn.addEventListener('click', function () { showTab(btn.dataset.tab); });
    });
  }

  function showTab(name) {
    state.tab = name;
    save(KEYS.state, state);
    document.querySelectorAll('.tabbar .tab').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tab === name);
    });
    document.querySelectorAll('.page').forEach(function (p) {
      p.classList.toggle('hidden', p.dataset.page !== name);
    });
    window.scrollTo(0, 0);
  }

  /** Nut +/- cho moi o so. */
  function bindSteppers() {
    document.querySelectorAll('.stepper').forEach(function (box) {
      var input = document.getElementById(box.dataset.for);
      box.querySelectorAll('button[data-step]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var step = Number(btn.dataset.step);
          var min = input.min === '' ? -99 : Number(input.min);
          var max = input.max === '' ? 999 : Number(input.max);
          input.value = Math.max(min, Math.min(max, (Number(input.value) || 0) + step));
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
      });
    });
  }

  /** Ti le roll tinh theo so tuong that cua set dang choi. */
  function applyRealPool() {
    if (dataset && dataset.champions && dataset.champions.length) calc.setPool(db.poolFromDataset(dataset));
    else calc.resetPool();
  }

  function renderTop() {
    var sub = document.getElementById('topSub');
    var bits = [];
    bits.push(dataset.champions.length ? (dataset.setName || 'Set') + ' - ' + dataset.champions.length + ' tuong' : 'Chua co du lieu set');
    if (comps.length) bits.push(comps.length + ' doi hinh');
    sub.textContent = bits.join(' | ');
  }

  // --------------------------------------------------------------------- roll

  function bindRoll() {
    var el = ids(['mLevel', 'mCost', 'mOwned', 'mTaken', 'mGold', 'mDvGold', 'mDvXp']);
    el.mLevel.value = state.level;
    el.mCost.value = state.cost;
    el.mOwned.value = state.owned;
    el.mTaken.value = state.taken;
    el.mGold.value = state.gold;
    el.mDvGold.value = state.dvGold === undefined ? 50 : state.dvGold;
    el.mDvXp.value = state.dvXp === undefined ? 0 : state.dvXp;

    document.getElementById('mNeed').addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      state.need = Number(btn.dataset.v);
      document.querySelectorAll('#mNeed button').forEach(function (b) {
        b.classList.toggle('on', b === btn);
      });
      render();
    });

    function render() {
      state.level = +el.mLevel.value;
      state.cost = +el.mCost.value;
      state.owned = +el.mOwned.value;
      state.taken = +el.mTaken.value;
      state.gold = +el.mGold.value;
      save(KEYS.state, state);

      var opts = {
        level: state.level, cost: state.cost,
        copiesOwnedByYou: state.owned, copiesTakenByOthers: state.taken,
        rolls: Math.floor(state.gold / 2), copiesNeeded: state.need
      };
      var out = calc.rollOutcome(opts);

      document.getElementById('mGoldLabel').textContent = state.gold;
      document.getElementById('mRollsLabel').textContent = Math.floor(state.gold / 2);
      document.getElementById('mNeedLabel').textContent = state.need;

      document.getElementById('mRollHero').innerHTML =
        '<div class="num">' + calc.percent(out.probabilityAtLeastNeeded, 0) + '</div>' +
        '<div class="cap">kha nang trung it nhat ' + state.need + ' ban sao voi ' + state.gold + ' vang</div>' +
        '<div class="bar"><i style="width:' + (out.probabilityAtLeastNeeded * 100).toFixed(0) + '%"></i></div>';

      document.getElementById('mRollTable').innerHTML =
        row('Moi o cua hang', calc.percent(out.slotProbability, 2)) +
        row('Moi lan roll (5 o)', calc.percent(out.shopProbability, 1)) +
        row('Ky vong so ban sao', out.expectedCopies.toFixed(2)) +
        row('Vang trung binh cho 1 ban', isFinite(out.expectedGoldForOne) ? Math.round(out.expectedGoldForOne) + 'v' : '-') +
        row('Con lai trong kho', out.copiesLeftInPool + ' ban');

      renderDecision(opts);

      document.getElementById('mConfidence').innerHTML =
        '<tr><th>Chac chan</th><th class="num">Vang</th><th class="num">Lan roll</th></tr>' +
        [0.5, 0.75, 0.9, 0.95].map(function (c) {
          var g = calc.goldForConfidence(opts, c);
          return '<tr><td>' + Math.round(c * 100) + '%</td><td class="num">' +
            (isFinite(g) ? g + 'v' : '-') + '</td><td class="num">' + (isFinite(g) ? g / 2 : '-') + '</td></tr>';
        }).join('');
    }

    ['mLevel', 'mCost', 'mOwned', 'mTaken', 'mGold', 'mDvGold', 'mDvXp'].forEach(function (id) {
      el[id].addEventListener('input', render);
    });

    /** So sanh roll ngay / len cap / cho mot vong. */
    function renderDecision(opts) {
      state.dvGold = +el.mDvGold.value;
      state.dvXp = +el.mDvXp.value;
      var decision = calc.rollVsLevel({
        gold: state.dvGold,
        xp: state.dvXp,
        level: opts.level,
        cost: opts.cost,
        copiesOwnedByYou: opts.copiesOwnedByYou,
        copiesTakenByOthers: opts.copiesTakenByOthers,
        copiesNeeded: opts.copiesNeeded,
        expectedExtraTaken: 1
      });
      document.getElementById('mDecision').innerHTML = decision.options.map(function (o) {
        var best = o.key === decision.best;
        var label = o.key === 'roll' ? 'Roll ngay ở cấp ' + o.level
          : o.key === 'level' ? 'Lên cấp ' + o.level + ' rồi roll'
          : 'Chờ một vòng, ăn lãi';
        return '<div style="margin-bottom:10px">' +
          '<div class="kv"><span>' + (best ? '<b style="color:var(--gold)">' + esc(label) + '</b>' : esc(label)) +
          '<div class="small muted">' + o.rolls + ' lần roll' +
          (o.levelGold ? ', tốn ' + o.levelGold + 'v mua XP' : '') +
          (o.income ? ', +' + o.income + 'v thu nhập' : '') + '</div></span>' +
          '<b style="' + (best ? 'color:var(--gold)' : 'color:var(--muted)') + '">' +
          calc.percent(o.probability, 0) + '</b></div>' +
          '<div class="bar"><i style="width:' + (o.probability * 100).toFixed(0) + '%' + (best ? '' : ';opacity:.4') + '"></i></div>' +
          '</div>';
      }).join('');
    }

    document.getElementById('mOddsTable').innerHTML =
      '<tr><th>Cap</th>' + [1, 2, 3, 4, 5].map(function (c) {
        return '<th class="num cost-' + c + '">' + c + 'v</th>';
      }).join('') + '</tr>' +
      Object.keys(tables.SHOP_ODDS).map(function (lv) {
        return '<tr><td>' + lv + '</td>' + tables.SHOP_ODDS[lv].map(function (p) {
          return '<td class="num">' + (p ? p + '%' : '-') + '</td>';
        }).join('') + '</tr>';
      }).join('');

    render();
  }

  // --------------------------------------------------------------------- econ

  function bindEcon() {
    var el = ids(['mMoney', 'mStreak', 'mWin', 'mLvl', 'mXp']);
    el.mMoney.value = state.money;
    el.mStreak.value = state.streak;
    el.mWin.checked = state.win;
    el.mLvl.value = state.lvl;
    el.mXp.value = state.xp;

    function render() {
      state.money = +el.mMoney.value;
      state.streak = +el.mStreak.value;
      state.win = el.mWin.checked;
      state.lvl = +el.mLvl.value;
      state.xp = +el.mXp.value;
      save(KEYS.state, state);

      var income = calc.incomeNextRound({ gold: state.money, streak: state.streak, win: state.win });
      var toInterest = (Math.floor(state.money / 10) + 1) * 10 - state.money;
      document.getElementById('mEconResult').innerHTML =
        '<table>' +
        row('Co ban', income.base + 'v') +
        row('Lai', '+' + income.interest + 'v') +
        row('Chuoi', '+' + income.streak + 'v') +
        row('Thang', '+' + income.win + 'v') +
        '<tr><td><b>Vong sau nhan</b></td><td class="num"><b style="color:var(--gold);font-size:20px">' +
          income.total + 'v</b></td></tr>' +
        row('Them 1 lai khi du', income.interest >= tables.MAX_INTEREST ? 'da toi da' : ((Math.floor(state.money / 10) + 1) * 10) + 'v (con ' + toInterest + 'v)') +
        '</table>';

      document.getElementById('mProjection').innerHTML =
        '<tr><th>Vong</th><th class="num">Thu nhap</th><th class="num">Tong vang</th></tr>' +
        calc.projectGold({ gold: state.money, streak: state.streak, win: state.win, rounds: 5, spendPerRound: 0 })
          .map(function (r) {
            return '<tr><td>+' + r.round + '</td><td class="num">' + r.income + 'v</td><td class="num">' + r.gold + 'v</td></tr>';
          }).join('');

      var next = calc.levelCost(state.lvl, state.xp, state.lvl + 1);
      var two = calc.levelCost(state.lvl, state.xp, state.lvl + 2);
      document.getElementById('mLevelResult').innerHTML =
        '<table>' +
        row('Len cap ' + (state.lvl + 1), '<b style="color:var(--gold)">' + next.gold + 'v</b> (' + next.xp + ' XP)') +
        row('Len cap ' + (state.lvl + 2), two.gold + 'v') +
        row('Neu khong mua XP', next.rounds + ' vong nua') +
        '</table>';
    }

    ['mMoney', 'mStreak', 'mWin', 'mLvl', 'mXp'].forEach(function (id) {
      el[id].addEventListener('input', render);
      el[id].addEventListener('change', render);
    });

    document.getElementById('mRoadmap').innerHTML =
      '<tr><th>Vong</th><th>Cap</th><th>Ghi chu</th></tr>' +
      tables.LEVEL_ROADMAP.map(function (r) {
        return '<tr><td>' + r.round + '</td><td class="cost-5">' + r.level + '</td><td class="small">' + esc(r.note) + '</td></tr>';
      }).join('');

    render();
  }

  // -------------------------------------------------------------------- items

  function bindItems() {
    var bagEl = document.getElementById('mBag');
    bagEl.innerHTML = tables.COMPONENTS.map(function (c) {
      return '<span class="chip" data-id="' + c.id + '">' + esc(c.vi) + '<span class="count" data-count="' + c.id + '"></span></span>';
    }).join('');

    var pressTimer = null;
    bagEl.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip || chip.dataset.skip) { if (chip) delete chip.dataset.skip; return; }
      state.bag[chip.dataset.id] = (state.bag[chip.dataset.id] || 0) + 1;
      renderBag();
    });
    // Cham lau -> bot mot mon
    bagEl.addEventListener('touchstart', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      pressTimer = setTimeout(function () {
        chip.dataset.skip = '1';
        state.bag[chip.dataset.id] = Math.max(0, (state.bag[chip.dataset.id] || 0) - 1);
        renderBag();
      }, 450);
    }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) {
      bagEl.addEventListener(ev, function () { clearTimeout(pressTimer); }, { passive: true });
    });
    bagEl.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      var chip = e.target.closest('.chip');
      if (!chip) return;
      state.bag[chip.dataset.id] = Math.max(0, (state.bag[chip.dataset.id] || 0) - 1);
      renderBag();
    });

    var grid = document.getElementById('mRecipeGrid');
    grid.innerHTML = '<tr><td class="cell head"></td>' + tables.COMPONENTS.map(function (c) {
      return '<td class="cell head">' + esc(c.vi) + '</td>';
    }).join('') + '</tr>' +
      calc.recipeGrid().map(function (r) {
        return '<tr><td class="cell head">' + esc(r.component.vi) + '</td>' +
          r.cells.map(function (cell) {
            return '<td class="cell" data-item="' + esc(cell.item || '') + '">' + esc(cell.itemVi || cell.item || '') + '</td>';
          }).join('') + '</tr>';
      }).join('');
    grid.addEventListener('click', function (e) {
      var td = e.target.closest('td[data-item]');
      if (!td) return;
      grid.querySelectorAll('.cell.on').forEach(function (c) { c.classList.remove('on'); });
      td.classList.add('on');
      var note = tables.ITEM_NOTES[td.dataset.item];
      document.getElementById('mRecipeHint').innerHTML =
        '<b class="cost-5">' + esc((tables.ITEM_NAMES_VI && tables.ITEM_NAMES_VI[td.dataset.item]) || td.dataset.item) + '</b>' +
        (note ? ' — ' + esc(note) : '');
    });

    renderBag();
  }

  function bagList() {
    var out = [];
    Object.keys(state.bag).forEach(function (id) {
      for (var i = 0; i < state.bag[id]; i++) out.push(id);
    });
    return out;
  }

  function renderBag() {
    save(KEYS.state, state);
    tables.COMPONENTS.forEach(function (c) {
      var el = document.querySelector('[data-count="' + c.id + '"]');
      if (el) el.textContent = state.bag[c.id] ? ' x' + state.bag[c.id] : '';
      var chip = document.querySelector('.chip[data-id="' + c.id + '"]');
      if (chip) chip.setAttribute('aria-pressed', String(Boolean(state.bag[c.id])));
    });

    var list = bagList();
    var host = document.getElementById('mBagResult');
    if (!list.length) {
      host.innerHTML = '<span class="small muted">Chạm vào món cơ bản để thêm vào túi.</span>';
      return;
    }

    // Neu doi hinh dang chon co danh sach trang bi, uu tien ghep cho no truoc.
    var comp = comps.find(function (c) { return c.id === state.compId; }) || comps[0];
    var wishlist = [];
    if (comp) {
      comp.units.slice().sort(function (a, b) { return (b.carry ? 1 : 0) - (a.carry ? 1 : 0); })
        .forEach(function (u) { (u.items || []).forEach(function (i) { if (wishlist.indexOf(i) < 0) wishlist.push(i); }); });
    }

    var uniq = {};
    var craftable = calc.craftable(list).filter(function (x) {
      if (uniq[x.item]) return false;
      uniq[x.item] = true;
      return true;
    });

    var html = '<div class="small muted">Ghép được ngay (' + craftable.length + '):</div>' +
      craftable.map(function (x) {
        return '<div class="kv"><b class="cost-5">' + esc(x.item) + '</b><span class="small muted">' +
          x.from.map(compName).join(' + ') + '</span></div>';
      }).join('');

    if (wishlist.length) {
      var plan = calc.bestItemPlan(list, wishlist);
      html += '<div class="small muted" style="margin-top:10px">Theo đội hình "' + esc(comp.name) + '":</div>' +
        plan.crafted.map(function (c) {
          return '<div class="kv"><span class="ok">✓ ' + esc(c.item) + '</span><span class="small muted">' +
            c.from.map(compName).join(' + ') + '</span></div>';
        }).join('') +
        plan.missing.slice(0, 4).map(function (m) {
          return '<div class="kv"><span class="warn">✗ ' + esc(m.item) + '</span><span class="small muted">thiếu ' +
            m.need.map(compName).join(', ') + '</span></div>';
        }).join('') +
        (plan.leftover.length ? '<div class="small muted">Thừa: ' + plan.leftover.map(compName).join(', ') + '</div>' : '');
    }
    host.innerHTML = html;
  }

  function compName(id) {
    var c = tables.COMPONENTS.find(function (x) { return x.id === id; });
    return c ? c.vi : id;
  }

  // -------------------------------------------------------------------- comps

  function bindComps() {
    document.getElementById('mCompPick').addEventListener('change', function (e) {
      state.compId = e.target.value;
      save(KEYS.state, state);
      renderComp();
    });
    renderCompPicker();
  }

  function renderCompPicker() {
    var pick = document.getElementById('mCompPick');
    pick.innerHTML = comps.length
      ? comps.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('')
      : '<option>Chua co doi hinh nao</option>';
    if (state.compId && comps.some(function (c) { return c.id === state.compId; })) pick.value = state.compId;
    else if (comps.length) state.compId = comps[0].id;
    renderComp();
  }

  function renderComp() {
    var host = document.getElementById('mCompView');
    var comp = comps.find(function (c) { return c.id === state.compId; }) || comps[0];
    if (!comp) {
      host.innerHTML = '<div class="card muted">Chưa có đội hình. Bấm nút ⇅ ở góc trên để lấy đội hình từ app trên PC, hoặc dán JSON.</div>';
      return;
    }

    // Ban co thu nho
    var boardHtml = '';
    for (var r = 0; r < 4; r++) {
      boardHtml += '<div class="mini-row">';
      for (var c = 0; c < 7; c++) {
        var unit = comp.units.find(function (u) { return u.row === r && u.col === c; });
        boardHtml += '<div class="mini-hex' + (unit ? ' filled' : '') + (unit && unit.carry ? ' carry' : '') + '">' +
          (unit ? '<span class="cost-' + unit.cost + '">' + esc(clip(unit.name, 9)) + '</span>' : '') + '</div>';
      }
      boardHtml += '</div>';
    }

    var unitsHtml = comp.units.map(function (u) {
      return '<div class="unit-card">' +
        '<span class="nm cost-' + u.cost + '">' + esc(u.name) + '</span>' +
        '<span class="small" style="color:var(--gold)">' + '★'.repeat(u.star || 2) + '</span>' +
        (u.carry ? '<span class="badge">carry</span>' : '') +
        '<span class="it">' + esc((u.items || []).join(', ')) + '</span>' +
        '</div>';
    }).join('');

    // Phan tich toc he neu da co du lieu set
    var traitHtml = '';
    if (dataset.champions && dataset.champions.length) {
      var breakdown = analyzer.traitBreakdown(comp.units, dataset);
      traitHtml = '<div class="card"><h3>Tộc hệ đang bật</h3>' +
        (breakdown.active.length
          ? breakdown.active.map(function (t) {
              return '<div class="kv"><span>' + esc(t.name) + '</span><b style="color:var(--gold)">' +
                t.count + '/' + t.activeAt + (t.next ? ' → ' + t.next : '') + '</b></div>';
            }).join('')
          : '<span class="small muted">Chưa bật mốc nào.</span>') +
        (breakdown.inactive.filter(function (t) { return t.missing === 1; }).length
          ? '<div class="small muted" style="margin-top:8px">Thiếu 1 tướng là bật: ' +
            breakdown.inactive.filter(function (t) { return t.missing === 1; })
              .map(function (t) { return esc(t.name); }).join(', ') + '</div>'
          : '') +
        '</div>';

      var suggestions = analyzer.suggestNextUnit(comp.units, dataset, { limit: 5 });
      if (suggestions.length) {
        traitHtml += '<div class="card"><h3>Nên thêm tướng nào</h3>' +
          suggestions.map(function (s) {
            return '<div class="kv"><span class="cost-' + s.cost + '">' + esc(s.name) + ' <span class="small muted">' +
              s.cost + 'v</span></span><span class="small muted">' +
              (s.unlocks.length ? esc(s.unlocks.join(', ')) : '+' + s.gain) + '</span></div>';
          }).join('') + '</div>';
      }
    }

    host.innerHTML =
      '<div class="card">' +
        '<b>' + esc(comp.name) + '</b>' + (comp.tier ? ' <span class="badge">' + esc(comp.tier) + '</span>' : '') +
        (comp.style ? '<div class="small muted">' + esc(comp.style) + '</div>' : '') +
        (comp.econ && comp.econ.rollDownAt ? '<div class="small muted">Roll xuống ở ' + esc(comp.econ.rollDownAt) + '</div>' : '') +
        '<div class="mini-board" style="margin-top:10px">' + boardHtml + '</div>' +
      '</div>' +
      '<div class="card">' + unitsHtml + '</div>' +
      traitHtml +
      (comp.notes ? '<div class="card small">' + esc(comp.notes) + '</div>' : '');
  }

  // -------------------------------------------------------------------- round

  function bindRound() {
    var input = document.getElementById('mRound');
    var notes = document.getElementById('mNotes');
    input.value = state.round;
    notes.value = state.notes;

    function render() {
      state.round = input.value;
      save(KEYS.state, state);
      var near = calc.upcomingRounds(state.round, 7);
      var far = calc.upcomingRounds(state.round, 21);
      if (!near.length) {
        document.getElementById('mRoundResult').innerHTML = '<span class="muted small">Nhập dạng 3-2</span>';
        return;
      }
      var nextAug = far.find(function (r) { return r.augment; });
      var nextCar = far.find(function (r) { return r.carousel; });
      document.getElementById('mRoundResult').innerHTML =
        '<div class="round-tags">' + near.map(function (r) {
          var cls = r.augment ? 'augment' : r.carousel ? 'carousel' : r.pve ? 'pve' : '';
          return '<span class="tag ' + cls + '">' + r.label + (r.augment ? ' lõi' : r.carousel ? ' chọn đồ' : r.pve ? ' quái' : '') + '</span>';
        }).join('') + '</div>' +
        '<table>' +
        row('Lõi nâng cấp kế tiếp', nextAug ? nextAug.label : '-') +
        row('Vòng chọn đồ kế tiếp', nextCar ? nextCar.label : '-') +
        '</table>';
    }

    input.addEventListener('input', render);
    document.getElementById('mRoundPrev').addEventListener('click', function () { step(-1); });
    document.getElementById('mRoundNext').addEventListener('click', function () { step(1); });
    notes.addEventListener('input', function () {
      state.notes = notes.value;
      save(KEYS.state, state);
    });

    function step(delta) {
      var parsed = calc.parseRound(input.value) || { stage: 2, round: 1 };
      var round = parsed.round + delta;
      var stage = parsed.stage;
      if (round > tables.ROUND_INFO.roundsPerStage) { round = 1; stage++; }
      if (round < 1) { stage = Math.max(1, stage - 1); round = tables.ROUND_INFO.roundsPerStage; }
      input.value = stage + '-' + round;
      render();
    }

    render();
  }

  // --------------------------------------------------------------- dong bo

  function bindSync() {
    var sheet = document.getElementById('syncSheet');
    document.getElementById('openSync').addEventListener('click', function () {
      sheet.classList.remove('hidden');
      renderSyncStatus();
    });
    document.getElementById('closeSync').addEventListener('click', function () { sheet.classList.add('hidden'); });
    sheet.addEventListener('click', function (e) { if (e.target === sheet) sheet.classList.add('hidden'); });

    document.getElementById('pcUrl').value = pcUrl;
    document.getElementById('pcConnect').addEventListener('click', async function () {
      var url = document.getElementById('pcUrl').value.trim();
      msg('Đang kết nối...');
      try {
        var result = await pullFromPc(url);
        msg('<span class="ok">Đã lấy ' + result.comps + ' đội hình, ' + result.champions + ' tướng từ PC.</span>');
      } catch (err) {
        msg('<span class="warn">Không kết nối được: ' + esc(err.message) + '</span>');
      }
    });

    document.getElementById('pasteGo').addEventListener('click', function () {
      var text = document.getElementById('pasteJson').value.trim();
      try {
        var json = JSON.parse(text);
        var list = Array.isArray(json) ? json : (json.comps || [json]);
        comps = list.filter(function (c) { return c && c.units; });
        save(KEYS.comps, comps);
        renderCompPicker();
        renderTop();
        msg('<span class="ok">Đã nhập ' + comps.length + ' đội hình.</span>');
      } catch (err) {
        msg('<span class="warn">JSON không đọc được.</span>');
      }
    });

    document.getElementById('fetchSet').addEventListener('click', function () {
      fetchSet(true);
    });
  }

  /**
   * Tai database cua set. Thu lan luot:
   *   1. /api/tft-data cua chinh trang nay (ban dua len Vercel co san, nhe va khong dinh CORS)
   *   2. May chu cua app tren PC neu da noi
   *   3. Goi thang Community Dragon (nang, co the bi CORS chan)
   */
  async function fetchSet(loud) {
    var say = loud ? msg : function () {};
    var sources = [];
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      sources.push({ name: 'may chu cua trang', url: location.origin + '/api/tft-data?slim=1', parse: false });
    }
    if (pcUrl) sources.push({ name: 'app tren PC', url: pcUrl + '/api/state', parse: 'pc' });
    sources.push({ name: 'Community Dragon', url: cdragon.CDRAGON_URL, parse: true });

    var lastError = null;
    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];
      say('Đang tải dữ liệu set từ ' + source.name + '...');
      try {
        var res = await fetchWithTimeout(source.url, source.parse === true ? 40000 : 15000);
        if (!res.ok) throw new Error('máy chủ trả về ' + res.status);
        var json = await res.json();
        var next = source.parse === true ? cdragon.parseCdragon(json)
          : source.parse === 'pc' ? json.data
          : json;
        if (!next || !next.champions || !next.champions.length) throw new Error('dữ liệu rỗng');
        dataset = next;
        save(KEYS.data, dataset);
        applyRealPool();
        renderTop();
        renderComp();
        renderSyncStatus();
        say('<span class="ok">Xong: ' + esc(dataset.setName || 'Set') + ' - ' +
          dataset.champions.length + ' tướng (nguồn: ' + source.name + ').</span>');
        return dataset;
      } catch (err) {
        lastError = err;
      }
    }
    say('<span class="warn">Không lấy được dữ liệu set: ' + esc(lastError ? lastError.message : '?') +
      '. Thử bật máy chủ trong app PC rồi kết nối ở trên.</span>');
    throw lastError || new Error('khong co nguon du lieu');
  }

  async function pullFromPc(url) {
    var base = String(url || '').replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(base)) base = 'http://' + base;
    var res = await fetchWithTimeout(base + '/api/state', 10000);
    if (!res.ok) throw new Error('máy chủ trả về ' + res.status);
    var payload = await res.json();

    if (payload.comps) { comps = payload.comps; save(KEYS.comps, comps); }
    if (payload.data && payload.data.champions && payload.data.champions.length) {
      dataset = payload.data;
      save(KEYS.data, dataset);
      applyRealPool();
    }
    pcUrl = base;
    save(KEYS.pc, pcUrl);
    renderCompPicker();
    renderTop();
    renderSyncStatus();
    return { comps: comps.length, champions: dataset.champions.length };
  }

  function renderSyncStatus() {
    var el = document.getElementById('syncStatus');
    el.innerHTML = (pcUrl ? '<span class="online">Đã lưu địa chỉ PC: ' + esc(pcUrl) + '</span>' : '<span class="offline">Chưa nối với PC</span>') +
      '<br />' + (dataset.champions.length ? esc(dataset.setName || 'Set') + ' - ' + dataset.champions.length + ' tướng' : 'Chưa có dữ liệu set') +
      ' · ' + comps.length + ' đội hình';
  }

  function msg(html) {
    document.getElementById('syncMsg').innerHTML = html;
  }

  // ----------------------------------------------------------- augments mobile

  function bindAugments() {
    var searchInput = document.getElementById('mAugSearch');
    var tierSelect = document.getElementById('mAugTierFilter');
    var tagSelect = document.getElementById('mAugTagFilter');
    var evalBtn = document.getElementById('mAugEval');

    var hpMinus = document.getElementById('mAugHpMinus');
    var hpPlus = document.getElementById('mAugHpPlus');
    var goldMinus = document.getElementById('mAugGoldMinus');
    var goldPlus = document.getElementById('mAugGoldPlus');

    if (hpMinus) hpMinus.onclick = function () {
      var el = document.getElementById('mAugHp');
      if (el) el.value = Math.max(1, (Number(el.value) || 100) - 10);
    };
    if (hpPlus) hpPlus.onclick = function () {
      var el = document.getElementById('mAugHp');
      if (el) el.value = Math.min(100, (Number(el.value) || 100) + 10);
    };
    if (goldMinus) goldMinus.onclick = function () {
      var el = document.getElementById('mAugGold');
      if (el) el.value = Math.max(0, (Number(el.value) || 50) - 10);
    };
    if (goldPlus) goldPlus.onclick = function () {
      var el = document.getElementById('mAugGold');
      if (el) el.value = (Number(el.value) || 50) + 10;
    };

    if (searchInput) searchInput.addEventListener('input', renderMobileAugLibrary);
    if (tierSelect) tierSelect.addEventListener('change', renderMobileAugLibrary);
    if (tagSelect) tagSelect.addEventListener('change', renderMobileAugLibrary);
    if (evalBtn) evalBtn.addEventListener('click', evaluateMobileAugments);

    renderMobileAugDatalist();
    renderMobileAugLibrary();
  }

  function renderMobileAugDatalist() {
    var dl = document.getElementById('mAugList');
    if (!dl || !dataset || !dataset.augments) return;
    dl.innerHTML = dataset.augments.map(function (a) {
      return '<option value="' + esc(a.name) + '">' + esc(a.tier ? '[' + a.tier.toUpperCase() + '] ' : '') + esc(a.name) + '</option>';
    }).join('');
  }

  function renderMobileAugLibrary() {
    var container = document.getElementById('mAugLibrary');
    if (!container || !dataset) return;

    var query = (document.getElementById('mAugSearch') && document.getElementById('mAugSearch').value) || '';
    var tier = (document.getElementById('mAugTierFilter') && document.getElementById('mAugTierFilter').value) || '';
    var tag = (document.getElementById('mAugTagFilter') && document.getElementById('mAugTagFilter').value) || '';

    var filtered = db.searchAugments(dataset, query, { tier: tier || null, tag: tag || null });

    if (!filtered.length) {
      container.innerHTML = '<div class="muted small" style="padding:10px">Không tìm thấy lõi phù hợp.</div>';
      return;
    }

    container.innerHTML = filtered.map(function (a) {
      var tierBadge = a.tier ? '<span class="badge badge-tier-' + esc(a.tier) + '">' + esc(a.tier) + '</span>' : '';
      var icon = a.icon ? '<img src="' + esc(a.icon) + '" alt="" loading="lazy" style="width:32px;height:32px;border-radius:6px;flex-shrink:0" />' : '';
      return '<div class="card" style="display:flex;gap:10px;align-items:flex-start;padding:8px 10px;margin-bottom:6px">' +
        icon +
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px">' +
            '<b style="font-size:13px">' + esc(a.name) + '</b>' + tierBadge +
          '</div>' +
          '<div class="small muted" style="margin-top:2px;line-height:1.3">' + esc(a.desc || '') + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function evaluateMobileAugments() {
    var p1 = (document.getElementById('mAug1') && document.getElementById('mAug1').value || '').trim();
    var p2 = (document.getElementById('mAug2') && document.getElementById('mAug2').value || '').trim();
    var p3 = (document.getElementById('mAug3') && document.getElementById('mAug3').value || '').trim();
    var resultEl = document.getElementById('mAugResult');
    if (!resultEl || !dataset || !dataset.augments) return;

    var picks = [p1, p2, p3].filter(Boolean);
    if (!picks.length) {
      resultEl.innerHTML = '<div class="muted small">Vui lòng nhập hoặc chọn ít nhất 1 lõi để đánh giá.</div>';
      return;
    }

    var augs = picks.map(function (name) {
      return (dataset.augments || []).find(function (a) {
        return a.name.toLowerCase() === name.toLowerCase() ||
               a.apiName.toLowerCase() === name.toLowerCase() ||
               a.name.toLowerCase().indexOf(name.toLowerCase()) >= 0;
      });
    }).filter(Boolean);

    if (!augs.length) {
      resultEl.innerHTML = '<div class="warn small">Không tìm thấy lõi trong bộ dữ liệu.</div>';
      return;
    }

    var activeComp = comps.find(function (c) { return c.id === state.compId; }) || comps[0];
    var augState = {
      stage: (document.getElementById('mAugStage') && document.getElementById('mAugStage').value) || '2-1',
      hp: Number(document.getElementById('mAugHp') && document.getElementById('mAugHp').value) || 100,
      gold: Number(document.getElementById('mAugGold') && document.getElementById('mAugGold').value) || 50,
      board: (activeComp && activeComp.units) || []
    };

    var ranked = analyzer.rankAugments(augs, augState, dataset);

    var recLabels = {
      must_pick: 'Tuyệt vời',
      recommended: 'Khuyên dùng',
      situational: 'Tùy tình huống',
      avoid: 'Nên bỏ qua'
    };

    resultEl.innerHTML = '<h4 style="margin:6px 0">Kết quả đánh giá:</h4>' +
      ranked.map(function (r, idx) {
        var recBadge = '<span class="badge badge-' + esc(r.recommendation) + '">' + esc(recLabels[r.recommendation] || r.recommendation) + '</span>';
        var icon = r.augment.icon ? '<img src="' + esc(r.augment.icon) + '" alt="" style="width:34px;height:34px;border-radius:6px;flex-shrink:0" />' : '';
        return '<div class="card" style="display:flex;gap:10px;align-items:flex-start;padding:10px;margin-bottom:6px;border-left:3px solid ' +
          (r.recommendation === 'must_pick' ? 'var(--green)' : r.recommendation === 'avoid' ? 'var(--red)' : 'var(--gold)') + '">' +
          icon +
          '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px">' +
              '<b style="font-size:13px">#' + (idx + 1) + ' ' + esc(r.augment.name) + ' (' + r.score + 'đ)</b>' + recBadge +
            '</div>' +
            '<div class="small muted" style="margin-top:2px">' + esc(r.augment.desc || '') + '</div>' +
            '<div class="small" style="color:#a1b8cc;margin-top:4px;background:rgba(0,0,0,.2);padding:3px 5px;border-radius:4px"><b>Lý do:</b> ' + esc(r.reason) + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
  }

  // -------------------------------------------------------- mobile reroll plan

  var mobileRerollOwnedMap = {};

  function bindMobileReroll() {
    fillMobileRerollCompSelect();
    var sel = document.getElementById('mRerollCompSelect');
    if (sel) sel.addEventListener('change', renderMobileRerollPlan);
    renderMobileRerollPlan();
  }

  function fillMobileRerollCompSelect() {
    var sel = document.getElementById('mRerollCompSelect');
    if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = comps.map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.name) + ' (' + esc(c.tier || 'A') + ' Tier)</option>';
    }).join('');
    if (cur) sel.value = cur;
  }

  function renderMobileRerollPlan() {
    var sel = document.getElementById('mRerollCompSelect');
    var compId = sel ? sel.value : '';
    var comp = comps.find(function (c) { return c.id === compId; }) || comps[0];
    if (!comp) return;

    var stratEl = document.getElementById('mRerollStrategy');
    var listEl = document.getElementById('mRerollList');
    var lv = parseInt((document.getElementById('mLevel') && document.getElementById('mLevel').value) || '7', 10);
    var gold = parseInt((document.getElementById('mGold') && document.getElementById('mGold').value) || '40', 10);

    var plan = calc.buildCompRerollPlan(comp, mobileRerollOwnedMap, { level: lv, gold: gold });
    if (!plan) return;

    if (stratEl) {
      stratEl.innerHTML = '<b>' + esc(plan.rollStrategy) + '</b><br/>' +
        'Vàng mua tướng: <b style="color:var(--gold)">' + plan.totalBuyGold + 'v</b> • Dự kiến hoàn thiện: <b style="color:var(--green)">' + (isFinite(plan.totalExpectedGold) ? plan.totalExpectedGold : '—') + 'v</b>';
    }

    if (listEl) {
      listEl.innerHTML = (plan.shoppingList || []).map(function (item) {
        var isCarry = item.carry;
        var percent = Math.min(100, Math.round((item.owned / item.calculation.targetCopies) * 100));
        var progressColor = percent >= 100 ? 'var(--green)' : percent >= 66 ? 'var(--gold)' : 'var(--blue)';

        return '<div style="padding:6px 8px;background:rgba(255,255,255,0.02);border-radius:4px;border-left:3px solid ' + (isCarry ? 'var(--gold)' : 'var(--border)') + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<div>' +
              '<span class="cost-' + item.cost + '" style="font-weight:600">' + esc(item.name) + '</span> ' +
              (isCarry ? '<span style="color:var(--gold);font-size:10px">★Carry</span>' : '') +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:4px">' +
              '<button class="mini m-reroll-dec" data-champ="' + esc(item.name.toLowerCase()) + '" style="padding:2px 6px">-</button>' +
              '<span style="font-weight:bold;min-width:28px;text-align:center">' + item.progress + '</span>' +
              '<button class="mini m-reroll-inc" data-champ="' + esc(item.name.toLowerCase()) + '" style="padding:2px 6px">+</button>' +
            '</div>' +
          '</div>' +
          '<div style="margin-top:4px;background:rgba(0,0,0,0.3);height:4px;border-radius:2px;overflow:hidden">' +
            '<div style="width:' + percent + '%;height:100%;background:' + progressColor + '"></div>' +
          '</div>' +
        '</div>';
      }).join('');

      listEl.querySelectorAll('.m-reroll-inc').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var name = btn.dataset.champ;
          var cur = mobileRerollOwnedMap[name] !== undefined ? mobileRerollOwnedMap[name] : 1;
          mobileRerollOwnedMap[name] = Math.min(9, cur + 1);
          renderMobileRerollPlan();
        });
      });

      listEl.querySelectorAll('.m-reroll-dec').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var name = btn.dataset.champ;
          var cur = mobileRerollOwnedMap[name] !== undefined ? mobileRerollOwnedMap[name] : 1;
          mobileRerollOwnedMap[name] = Math.max(0, cur - 1);
          renderMobileRerollPlan();
        });
      });
    }
  }

  // ---------------------------------------------------------------- scout (mobile)

  var mobileScoutOpponents = [
    { id: 1, text: '' }, { id: 2, text: '' }, { id: 3, text: '' },
    { id: 4, text: '' }, { id: 5, text: '' }, { id: 6, text: '' }, { id: 7, text: '' }
  ];

  function bindMobileScout() {
    renderMobileOpponentsList();
    var analyzeBtn = document.getElementById('mScoutAnalyzeBtn');
    if (analyzeBtn) analyzeBtn.addEventListener('click', renderMobileScoutAnalysis);
    var resetBtn = document.getElementById('mScoutResetBtn');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      mobileScoutOpponents.forEach(function (o) { o.text = ''; });
      renderMobileOpponentsList();
      renderMobileScoutAnalysis();
    });
    renderMobileScoutAnalysis();
  }

  function renderMobileOpponentsList() {
    var container = document.getElementById('mOpponentsList');
    if (!container) return;

    var compOptions = comps.map(function (c) {
      return '<option value="' + esc(c.name) + '">';
    }).join('');

    container.innerHTML = mobileScoutOpponents.map(function (opp, idx) {
      return '<div class="row" style="align-items:center;gap:6px">' +
        '<span style="font-weight:bold;min-width:48px;font-size:12px" class="muted">Nhà #' + (idx + 1) + ':</span>' +
        '<input class="m-opp-input" data-idx="' + idx + '" list="mScoutDatalist" placeholder="Tên bài hoặc carry..." value="' + esc(opp.text) + '" style="flex:1;padding:8px" />' +
      '</div>';
    }).join('') + '<datalist id="mScoutDatalist">' + compOptions + '</datalist>';

    container.querySelectorAll('.m-opp-input').forEach(function (input) {
      input.addEventListener('input', function () {
        var i = parseInt(input.dataset.idx, 10);
        mobileScoutOpponents[i].text = input.value.trim();
      });
    });
  }

  function renderMobileScoutAnalysis() {
    var freeCompsEl = document.getElementById('mFreeCompsResult');
    var counterEl = document.getElementById('mCounterAdviceResult');
    if (!freeCompsEl || !counterEl) return;

    var opps = mobileScoutOpponents.map(function (o) { return o.text; }).filter(Boolean);
    var analysis = analyzer.analyzeLobbyComps(opps, comps, dataset);

    if (analysis.topRecommendedComps.length) {
      freeCompsEl.innerHTML = analysis.topRecommendedComps.map(function (item) {
        var comp = item.comp;
        var badgeColor = item.isFree ? 'var(--green)' : item.contestedScore <= 35 ? 'var(--gold)' : 'var(--red)';

        return '<div class="card" style="padding:10px;background:rgba(255,255,255,0.03);border-left:3px solid ' + badgeColor + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<div><b>' + esc(comp.name) + '</b> <span class="tag">' + esc(item.tier) + '</span></div>' +
            '<span class="small" style="color:' + badgeColor + ';font-weight:bold">' + esc(item.statusText) + '</span>' +
          '</div>' +
          '<div class="small muted" style="margin-top:4px">' +
            'Carry: <b>' + esc(item.carryName || 'Đa dụng') + '</b> • Điểm sảnh: <b style="color:var(--green)">' + item.lobbyScore + '/100</b>' +
          '</div>' +
          '<div style="margin-top:8px">' +
            '<button class="m-scout-select-btn" data-id="' + esc(comp.id) + '" style="width:100%;padding:6px;font-size:12px;background:var(--primary);color:#fff;border:none;border-radius:4px">Chốt bài này để Reroll</button>' +
          '</div>' +
        '</div>';
      }).join('');

      freeCompsEl.querySelectorAll('.m-scout-select-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.dataset.id;
          var sel = document.getElementById('mRerollCompSelect');
          if (sel) {
            sel.value = id;
            showTab('roll');
            renderMobileRerollPlan();
          }
        });
      });
    } else {
      freeCompsEl.innerHTML = '<div class="small muted">Chưa có dữ liệu phân tích.</div>';
    }

    var dominance = analysis.lobbyDominance;
    var counterHtml = '<div style="margin-bottom:8px;display:flex;gap:6px;flex-wrap:wrap">' +
      '<span class="tag" style="color:#60a5fa">SMPT (AP): ' + dominance.ap + ' nhà</span>' +
      '<span class="tag" style="color:#f87171">STVL (AD): ' + dominance.ad + ' nhà</span>' +
      '<span class="tag" style="color:#facc15">Reroll: ' + dominance.reroll + ' nhà</span>' +
    '</div>';

    var adviceList = analysis.counterAdvice.map(function (adv) {
      return '<li style="margin-bottom:4px">' + esc(adv) + '</li>';
    }).join('');

    counterEl.innerHTML = counterHtml + '<ul style="margin:0;padding-left:16px" class="small">' + adviceList + '</ul>';
  }

  function checkMobileUpdates() {
    var banner = document.getElementById('mUpdateBanner');
    var verText = document.getElementById('mUpdateVer');
    var updateBtn = document.getElementById('mUpdateBtn');

    fetch('https://api.github.com/repos/vianphm/TFT/releases/latest', { cache: 'no-cache' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !data.tag_name) return;
        var latestVer = data.tag_name.replace(/^v/, '');
        var currentVer = '1.0.0';
        if (latestVer > currentVer) {
          if (banner) banner.classList.remove('hidden');
          if (verText) verText.textContent = 'v' + latestVer;
          if (updateBtn) {
            updateBtn.addEventListener('click', function () {
              window.open(data.html_url || 'https://github.com/vianphm/TFT/releases', '_blank');
            });
          }
        }
      }).catch(function () { /* offline */ });
  }

  // ---------------------------------------------------------------- tien ich

  /** fetch co han gio - mang yeu thi bao loi chu khong treo mai. */
  function fetchWithTimeout(url, ms) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, ms || 15000);
    return fetch(url, { cache: 'no-store', signal: controller ? controller.signal : undefined })
      .then(function (res) { clearTimeout(timer); return res; })
      .catch(function (err) {
        clearTimeout(timer);
        throw new Error(err && err.name === 'AbortError' ? 'quá hạn chờ' : (err.message || 'lỗi mạng'));
      });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').catch(function () { /* mo bang file:// thi bo qua */ });
  }

  function ids(list) {
    var out = {};
    list.forEach(function (id) { out[id] = document.getElementById(id); });
    return out;
  }

  function row(label, value) {
    return '<tr><td>' + label + '</td><td class="num">' + value + '</td></tr>';
  }

  function clip(text, max) {
    var s = String(text || '');
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* het cho luu */ }
  }

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
