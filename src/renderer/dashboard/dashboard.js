/**
 * Dashboard - man hinh chinh cua app (nen de o man hinh phu khi choi).
 * Gom 6 tab: doi hinh, trang bi, ti le roll, kinh te, tuong trong set, cai dat nhanh.
 */
(function () {
  'use strict';

  var calc = window.TFT.calc;
  var analyzer = window.TFT.analyzer;
  var db = window.TFT.db;
  var tables = window.TFT.tables;
  var api = window.tft;

  var config = null;
  var comps = [];
  var dataset = { champions: [], traits: [] };
  var displays = [];
  var activeCompId = null;
  var selectedUnitIndex = null;
  var bag = {}; // id mon co ban -> so luong
  var lastBag = '';

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    config = await api.config.get();
    comps = await api.comps.list();
    dataset = await api.data.load();
    applyRealPool();
    displays = await api.displays.list();

    bindTabs();
    bindComps();
    bindItems();
    bindOdds();
    bindEcon();
    bindAugments();
    bindReroll();
    bindScout();
    bindChamps();
    bindTools();
    bindUpdater();
    refreshGameStatus();
    renderSetInfo();

    api.on('comps:changed', function (next) { comps = next; renderCompList(); renderCompEditor(); });
    api.on('game:status', renderGameStatus);
    api.on('live:status', function (status) {
      if (status && status.liveApiActive) {
        var dot = document.getElementById('gameDot');
        var text = document.getElementById('gameText');
        if (dot) dot.classList.add('on');
        if (text) text.textContent = 'Live Riot (2999)';
      }
    });
    api.on('live:game-data', function (liveData) {
      if (liveData && liveData.round) {
        config.state.round = liveData.round;
        var rInput = document.getElementById('econRound');
        if (rInput && rInput.value !== liveData.round) {
          rInput.value = liveData.round;
          renderEconPlan();
        }
      }
      if (liveData && liveData.level) {
        config.state.level = liveData.level;
        var oLevel = document.getElementById('rollLevel');
        if (oLevel && parseInt(oLevel.value, 10) !== liveData.level) {
          oLevel.value = liveData.level;
          renderOdds();
        }
      }
      if (liveData && liveData.gold !== null && liveData.gold !== undefined) {
        config.state.gold = liveData.gold;
        var eGold = document.getElementById('gold');
        if (eGold && parseInt(eGold.value, 10) !== liveData.gold) {
          eGold.value = liveData.gold;
          renderEconCalc();
        }
      }
    });
    api.on('data:updated', async function () {
      dataset = await api.data.load();
      applyRealPool();
      renderSetInfo();
      renderAugmentDatalist();
      renderAugmentLibrary();
      renderChamps();
      renderPoolTable();
    });
    api.on('displays:changed', async function () {
      displays = await api.displays.list();
      fillDisplaySelects();
    });
    api.on('overlay:click-through', function (locked) {
      config.overlay.clickThrough = locked;
    });
  }

  /**
   * Dung so tuong that cua set dang choi cho phan tinh ti le roll.
   * Bang trong tables.js chi la mac dinh; moi set Riot doi so tuong tung muc gia,
   * ma con so do vao thang cong thuc xac suat.
   */
  function applyRealPool() {
    if (!dataset || !dataset.champions || !dataset.champions.length) {
      calc.resetPool();
      return;
    }
    calc.setPool(db.poolFromDataset(dataset));
  }

  // -------------------------------------------------------------------- tabs

  function bindTabs() {
    var tabs = document.querySelectorAll('.tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { showTab(tab.dataset.tab); });
    });
    showTab(config.dashboard.lastTab || 'comps');
  }

  function showTab(name) {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === name);
    });
    document.querySelectorAll('.page').forEach(function (p) {
      p.classList.toggle('hidden', p.dataset.page !== name);
    });
    api.config.set('dashboard.lastTab', name);
  }

  // ---------------------------------------------------------------- doi hinh

  function bindComps() {
    document.getElementById('compNew').addEventListener('click', function () {
      var comp = {
        id: 'c-' + Date.now().toString(36),
        name: 'Doi hinh moi',
        tier: '', style: '', traits: [],
        econ: { levelAt: {}, rollDownAt: '', keepGold: 50 },
        notes: '',
        units: []
      };
      comps.push(comp);
      activeCompId = comp.id;
      saveComps();
    });
    document.getElementById('compExport').addEventListener('click', function () {
      var text = JSON.stringify(comps, null, 2);
      navigator.clipboard.writeText(text).then(function () {
        toast('Da chep ' + comps.length + ' doi hinh vao clipboard (dang JSON).');
      });
    });
    bindImportModal();
    if (comps.length) activeCompId = comps[0].id;
    renderCompList();
    renderCompEditor();
  }

  function saveComps() {
    api.comps.save(comps).then(function (saved) {
      comps = saved;
      renderCompList();
      renderCompEditor();
    });
  }

  function renderCompList() {
    var host = document.getElementById('compList');
    if (!comps.length) {
      host.innerHTML = '<div class="muted small" style="padding:10px">Chua co doi hinh nao.</div>';
      return;
    }
    host.innerHTML = comps.map(function (c) {
      var tierClass = (c.tier || '').toLowerCase().replace('+', '');
      return '<div class="comp-item ' + (c.id === activeCompId ? 'active' : '') + '" data-id="' + c.id + '">' +
        '<div class="name">' + esc(c.name) + (c.tier ? ' <span class="badge ' + tierClass + '">' + esc(c.tier) + '</span>' : '') + '</div>' +
        '<div class="small muted">' + c.units.length + ' tuong' + (c.style ? ' - ' + esc(c.style) : '') + '</div>' +
        '</div>';
    }).join('');
    host.querySelectorAll('.comp-item').forEach(function (el) {
      el.addEventListener('click', function () {
        activeCompId = el.dataset.id;
        selectedUnitIndex = null;
        renderCompList();
        renderCompEditor();
      });
    });
  }

  function currentComp() {
    return comps.find(function (c) { return c.id === activeCompId; }) || null;
  }

  function renderCompEditor() {
    var host = document.getElementById('compEditor');
    var comp = currentComp();
    if (!comp) {
      host.innerHTML = '<div class="muted">Chon mot doi hinh o ben trai, hoac bam "Tao moi".</div>';
      return;
    }

    host.innerHTML =
      '<div class="row">' +
        '<div class="field"><label>Ten doi hinh</label><input id="fName" value="' + esc(comp.name) + '" /></div>' +
        '<div class="field" style="max-width:90px"><label>Bac</label><input id="fTier" value="' + esc(comp.tier) + '" /></div>' +
        '<div class="field"><label>Loi choi</label><input id="fStyle" value="' + esc(comp.style) + '" /></div>' +
      '</div>' +
      '<div class="row">' +
        '<div class="field"><label>Roll xuong o vong</label><input id="fRoll" value="' + esc(comp.econ && comp.econ.rollDownAt || '') + '" placeholder="4-1" /></div>' +
        '<div class="field"><label>Giu vang</label><input type="number" id="fKeep" value="' + (comp.econ && comp.econ.keepGold || 50) + '" /></div>' +
      '</div>' +
      '<div class="field"><label>Ghi chu / cach choi</label><textarea id="fNotes">' + esc(comp.notes) + '</textarea></div>' +
      '<h3>Vi tri dung (hang duoi cung la sau lung ban)</h3>' +
      '<div class="board" id="board"></div>' +
      '<div class="row" style="margin-top:10px">' +
        '<button id="unitAdd">+ Them tuong</button>' +
        '<button id="compDelete" class="danger ghost">Xoa doi hinh nay</button>' +
      '</div>' +
      '<div class="unit-rows" id="unitRows"></div>';

    bindField('fName', function (v) { comp.name = v; });
    bindField('fTier', function (v) { comp.tier = v; });
    bindField('fStyle', function (v) { comp.style = v; });
    bindField('fNotes', function (v) { comp.notes = v; });
    bindField('fRoll', function (v) { comp.econ.rollDownAt = v; });
    bindField('fKeep', function (v) { comp.econ.keepGold = Number(v) || 0; });

    document.getElementById('unitAdd').addEventListener('click', function () {
      comp.units.push({ name: 'Tuong moi', cost: 1, star: 2, carry: false, items: [], row: null, col: null });
      selectedUnitIndex = comp.units.length - 1;
      saveComps();
    });
    document.getElementById('compDelete').addEventListener('click', function () {
      comps = comps.filter(function (c) { return c.id !== comp.id; });
      activeCompId = comps.length ? comps[0].id : null;
      saveComps();
    });

    renderBoard(comp);
    renderUnitRows(comp);
    renderAnalysis(comp);
  }

  /**
   * Phan tich doi hinh dang chon: toc he bat duoc, tuong nen them,
   * ke hoach ghep do, va nut tu tim to hop toi uu.
   */
  function renderAnalysis(comp) {
    var host = document.getElementById('compAnalysis');
    if (!dataset.champions || !dataset.champions.length) {
      host.innerHTML = '<h3>Phan tich</h3><div class="muted small">Can du lieu set. Vao tab "Tuong trong set" bam "Dong bo du lieu set" roi quay lai day.</div>';
      return;
    }

    var breakdown = analyzer.traitBreakdown(comp.units, dataset);
    var suggestions = analyzer.suggestNextUnit(comp.units, dataset, { limit: 6 });
    var almost = breakdown.inactive.filter(function (t) { return t.missing === 1; });

    var wishlist = [];
    comp.units.slice().sort(function (a, b) { return (b.carry ? 1 : 0) - (a.carry ? 1 : 0); })
      .forEach(function (u) {
        (u.items || []).forEach(function (i) { if (wishlist.indexOf(i) < 0) wishlist.push(i); });
      });

    host.innerHTML =
      '<h3>Phan tich doi hinh</h3>' +
      '<div class="analysis-cols">' +
        '<div>' +
          '<div class="small muted">Toc he dang bat (diem ' + breakdown.score + ')</div>' +
          (breakdown.active.length
            ? breakdown.active.map(function (t) {
                return '<div class="kv"><span>' + esc(t.name) + '</span><b class="cost-5">' + t.count + '/' + t.activeAt +
                  (t.next ? ' <span class="muted small">-> ' + t.next + '</span>' : '') + '</b></div>';
              }).join('')
            : '<div class="muted small">Chua bat moc nao.</div>') +
          (almost.length ? '<div class="small muted" style="margin-top:6px">Thieu 1 tuong la bat: ' +
            almost.map(function (t) { return esc(t.name); }).join(', ') + '</div>' : '') +
        '</div>' +
        '<div>' +
          '<div class="small muted">Nen them tuong nao</div>' +
          suggestions.map(function (sg) {
            return '<div class="kv"><span class="cost-' + sg.cost + '">' + esc(sg.name) +
              ' <span class="muted small">' + sg.cost + 'v</span></span><span class="small muted">' +
              (sg.unlocks.length ? esc(sg.unlocks.join(', ')) : '+' + sg.gain) + '</span></div>';
          }).join('') +
        '</div>' +
      '</div>' +
      (wishlist.length ? renderItemPlan(comp, wishlist) : '') +
      renderPivots(comp) +
      '<div class="row" style="margin-top:12px">' +
        '<div class="field" style="max-width:120px"><label>So o (cap)</label><input type="number" id="optSize" min="3" max="10" value="' +
          Math.max(3, Math.min(10, comp.units.length || 8)) + '" /></div>' +
        '<div class="field" style="max-width:140px"><label>Chi dung tuong toi</label>' +
          '<select id="optMaxCost"><option value="5">5 vang</option><option value="4" selected>4 vang</option>' +
          '<option value="3">3 vang</option><option value="2">2 vang</option></select></div>' +
        '<div class="field"><label>&nbsp;</label><button id="optRun" style="width:100%">Tu tim to hop toi uu</button></div>' +
      '</div>' +
      '<div id="optResult"></div>';

    bindItemPlanInput(comp);

    document.getElementById('optRun').addEventListener('click', function () {
      var size = Number(document.getElementById('optSize').value) || 8;
      var maxCost = Number(document.getElementById('optMaxCost').value) || 4;
      var carries = comp.units.filter(function (u) { return u.carry; }).map(function (u) { return u.name; });
      var out = document.getElementById('optResult');
      out.innerHTML = '<div class="muted small">Dang tinh...</div>';

      // Cho trinh duyet ve xong roi moi tinh (beam search mat vai tram ms)
      setTimeout(function () {
        var best = analyzer.optimizeComp(dataset, { size: size, maxCost: maxCost, required: carries });
        if (!best.units.length) {
          out.innerHTML = '<div class="muted small">Khong tim duoc to hop nao.</div>';
          return;
        }
        out.innerHTML =
          '<div class="small muted" style="margin-top:8px">Goi y (diem ' + best.score + ', tong gia ' + best.totalCost + 'v)' +
          (carries.length ? ' - da giu carry: ' + carries.map(esc).join(', ') : '') + '</div>' +
          '<div class="chips" style="margin:6px 0">' + best.units.map(function (u) {
            return '<span class="chip cost-' + u.cost + '">' + esc(u.name) + ' <span class="muted">' + u.cost + 'v</span></span>';
          }).join('') + '</div>' +
          '<div class="small">' + best.traits.active.map(function (t) {
            return '<span class="badge" style="margin-right:4px">' + esc(t.name) + ' ' + t.activeAt + '</span>';
          }).join('') + '</div>' +
          '<button id="optApply" style="margin-top:8px">Thay doi hinh bang goi y nay</button>';

        document.getElementById('optApply').addEventListener('click', function () {
          var kept = {};
          comp.units.forEach(function (u) { kept[u.name.toLowerCase()] = u; });
          comp.units = best.units.map(function (u, i) {
            var old = kept[u.name.toLowerCase()];
            return {
              name: u.name,
              cost: u.cost,
              star: old ? old.star : (u.cost <= 2 ? 3 : 2),
              carry: old ? old.carry : false,
              items: old ? old.items : [],
              row: old && old.row !== null ? old.row : (u.cost >= 4 ? 3 : 0),
              col: old && old.col !== null ? old.col : i % 7
            };
          });
          saveComps();
        });
      }, 30);
    });
  }

  /** Bo do can gom + chia cho tung tuong theo mon co ban dang co. */
  function renderItemPlan(comp, wishlist) {
    return '<div style="margin-top:12px">' +
      '<div class="small muted">Bo do can gom (' + wishlist.length + ' mon): ' + wishlist.map(esc).join(', ') + '</div>' +
      '<div class="row" style="margin-top:6px">' +
        '<div class="field"><label>Mon co ban dang co (vd: bf, glove, tear, vest)</label>' +
        '<input id="planBag" placeholder="bf, glove, tear" value="' + esc(lastBag) + '" /></div>' +
      '</div>' +
      '<div id="planResult"></div><div id="emblemResult"></div></div>';
  }

  function bindItemPlanInput(comp) {
    var input = document.getElementById('planBag');
    if (!input) return;
    var render = function () {
      lastBag = input.value;
      var ids = input.value.split(/[,\s]+/).map(function (x) { return x.trim().toLowerCase(); })
        .filter(function (x) { return tables.COMPONENTS.some(function (c) { return c.id === x; }); });
      var plan = calc.assignItems(comp.units, ids);
      document.getElementById('planResult').innerHTML = !ids.length
        ? '<div class="small muted">Nhap ma mon co ban de xem chia cho ai: ' +
          tables.COMPONENTS.map(function (c) { return c.id; }).join(', ') + '</div>'
        : plan.units.filter(function (u) { return u.done.length || u.missing.length; }).map(function (u) {
            return '<div class="kv"><span>' + (u.carry ? '<b class="cost-5">' : '') + esc(u.unit) + (u.carry ? '</b>' : '') +
              '</span><span class="small">' +
              u.done.map(function (d) { return '<span class="ok">' + esc(d.item) + '</span>'; }).join(', ') +
              (u.done.length && u.missing.length ? ' - ' : '') +
              u.missing.map(function (m) {
                return '<span class="warn">' + esc(m.item) + ' (thieu ' + m.need.map(compName).join(', ') + ')</span>';
              }).join(', ') + '</span></div>';
          }).join('') +
          (plan.leftover.length ? '<div class="small muted">Thua: ' + plan.leftover.map(compName).join(', ') + '</div>' : '');

      var emblemHost = document.getElementById('emblemResult');
      var emblemRows = analyzer.recommendEmblems({ units: comp.units, components: ids }, dataset, { limit: 5 });
      emblemHost.innerHTML = !emblemRows.length ? '' :
        '<div class="small muted" style="margin-top:10px">Gợi ý ghép ấn theo đội hình và đồ đang có:</div>' +
        emblemRows.map(function (row) {
          var state = row.craftable
            ? '<span class="ok">ghép được ngay</span>'
            : '<span class="muted">thiếu ' + row.missingComponents.map(compName).join(', ') + '</span>';
          return '<div class="kv"><span><b>' + esc((tables.ITEM_NAMES_VI && tables.ITEM_NAMES_VI[row.name]) || row.name) + '</b>' +
            '<div class="small muted">' + (row.holder ? 'lắp cho ' + esc(row.holder) : 'không còn ô đồ phù hợp') +
            (row.unlocks ? ' · mở ' + esc(row.unlocks) : '') + '</div></span><span>' + state +
            '<div class="small cost-5">+' + row.scoreGain + ' điểm</div></span></div>';
        }).join('');
    };
    input.addEventListener('input', render);
    render();
  }

  /** Dang cam nhung tuong nay thi chuyen sang doi hinh nao re nhat. */
  function renderPivots(comp) {
    if (comps.length < 2) return '';
    var others = comps.filter(function (c) { return c.id !== comp.id; });
    var list = analyzer.pivotSuggestions(comp.units, others, dataset, {
      level: config.state.level || 8, limit: 3
    });
    if (!list.length) return '';
    return '<div style="margin-top:12px"><div class="small muted">Tu doi hinh nay, chuyen sang doi hinh khac:</div>' +
      list.map(function (p) {
        return '<div class="kv"><span>' + esc(p.name) +
          '<div class="small muted">da co ' + p.overlap + '% - thieu ' + esc(p.missing.slice(0, 4).join(', ')) +
          (p.winRate || p.top4 ? ' · WR ' + p.winRate + '% · Top 4 ' + p.top4 + '%' : '') + '</div></span>' +
          '<b class="' + (isFinite(p.estGold) ? 'cost-5' : 'muted') + '">' +
          (isFinite(p.estGold) ? '~' + p.estGold + 'v' : '-') + '</b></div>';
      }).join('') + '</div>';
  }

  function bindField(id, setter) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', function () {
      setter(el.value);
      saveComps();
    });
  }

  /** Ban co 4 hang x 7 cot. Bam vao tuong o duoi roi bam o de dat vi tri. */
  function renderBoard(comp) {
    var board = document.getElementById('board');
    var html = '';
    for (var row = 0; row < 4; row++) {
      html += '<div class="board-row">';
      for (var col = 0; col < 7; col++) {
        var unit = comp.units.find(function (u) { return u.row === row && u.col === col; });
        var cls = 'hex' + (unit ? ' filled' : '') + (unit && unit.carry ? ' carry' : '') +
          (selectedUnitIndex !== null ? ' target' : '');
        html += '<div class="' + cls + '" data-row="' + row + '" data-col="' + col + '">' +
          (unit
            ? '<div><div class="u-name cost-' + unit.cost + '" title="' + esc(unit.name) + '">' + esc(clip(unit.name, 16)) + '</div>' +
              '<div class="u-items">' + esc((unit.items || []).map(shortItem).join(' ')) + '</div></div>'
            : '') +
          '</div>';
      }
      html += '</div>';
    }
    board.innerHTML = html;

    board.querySelectorAll('.hex').forEach(function (hex) {
      hex.addEventListener('click', function () {
        var row = Number(hex.dataset.row);
        var col = Number(hex.dataset.col);
        var comp2 = currentComp();
        if (selectedUnitIndex !== null && comp2.units[selectedUnitIndex]) {
          // Neu o da co tuong khac thi doi cho cho nhau
          var occupant = comp2.units.find(function (u) { return u.row === row && u.col === col; });
          var moving = comp2.units[selectedUnitIndex];
          if (occupant && occupant !== moving) {
            occupant.row = moving.row;
            occupant.col = moving.col;
          }
          moving.row = row;
          moving.col = col;
          selectedUnitIndex = null;
          saveComps();
          return;
        }
        var unit = comp2.units.find(function (u) { return u.row === row && u.col === col; });
        if (unit) {
          selectedUnitIndex = comp2.units.indexOf(unit);
          renderBoard(comp2);
          renderUnitRows(comp2);
        }
      });
    });
  }

  function renderUnitRows(comp) {
    var host = document.getElementById('unitRows');
    var champOptions = dataset.champions.length
      ? '<datalist id="champList">' + dataset.champions.map(function (c) {
          return '<option value="' + esc(c.name) + '">' + c.cost + ' vang</option>';
        }).join('') + '</datalist>'
      : '';

    host.innerHTML = champOptions + comp.units.map(function (u, i) {
      return '<div class="unit-row" data-i="' + i + '">' +
        '<input class="u-name" list="champList" value="' + esc(u.name) + '" />' +
        '<select class="u-cost">' + [1, 2, 3, 4, 5].map(function (c) {
          return '<option value="' + c + '"' + (c === u.cost ? ' selected' : '') + '>' + c + 'v</option>';
        }).join('') + '</select>' +
        '<select class="u-star">' + [1, 2, 3].map(function (s) {
          return '<option value="' + s + '"' + (s === (u.star || 2) ? ' selected' : '') + '>' + '*'.repeat(s) + '</option>';
        }).join('') + '</select>' +
        '<input class="u-items" value="' + esc((u.items || []).join(', ')) + '" placeholder="Trang bi, cach nhau dau phay" />' +
        '<label class="small" style="margin:0"><input type="checkbox" class="u-carry" style="width:auto"' +
          (u.carry ? ' checked' : '') + ' /> carry</label>' +
        '<button class="icon u-del" title="Xoa">x</button>' +
        '</div>';
    }).join('');

    host.querySelectorAll('.unit-row').forEach(function (row) {
      var i = Number(row.dataset.i);
      var unit = comp.units[i];
      row.querySelector('.u-name').addEventListener('change', function (e) {
        unit.name = e.target.value;
        var known = dataset.champions.find(function (c) { return c.name.toLowerCase() === unit.name.toLowerCase(); });
        if (known) unit.cost = known.cost;
        saveComps();
      });
      row.querySelector('.u-cost').addEventListener('change', function (e) { unit.cost = Number(e.target.value); saveComps(); });
      row.querySelector('.u-star').addEventListener('change', function (e) { unit.star = Number(e.target.value); saveComps(); });
      row.querySelector('.u-items').addEventListener('change', function (e) {
        unit.items = e.target.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 3);
        saveComps();
      });
      row.querySelector('.u-carry').addEventListener('change', function (e) { unit.carry = e.target.checked; saveComps(); });
      row.querySelector('.u-del').addEventListener('click', function () {
        comp.units.splice(i, 1);
        selectedUnitIndex = null;
        saveComps();
      });
      row.addEventListener('click', function (e) {
        if (e.target.closest('input, select, button')) return;
        selectedUnitIndex = i;
        renderBoard(comp);
      });
    });
  }

  function bindImportModal() {
    var modal = document.getElementById('importModal');
    var msg = document.getElementById('importMsg');

    document.getElementById('compImport').addEventListener('click', function () { modal.classList.remove('hidden'); });
    document.getElementById('importClose').addEventListener('click', function () { modal.classList.add('hidden'); });

    document.getElementById('importUrlGo').addEventListener('click', async function () {
      var url = document.getElementById('importUrl').value.trim();
      msg.innerHTML = '<span class="muted">Dang tai...</span>';
      try {
        var imported = await api.comps.importUrl(url);
        addImported(imported);
        msg.innerHTML = '<span class="ok">Da nhap ' + imported.length + ' doi hinh.</span>';
      } catch (err) {
        msg.innerHTML = '<span class="warn">' + esc(err.message) + '</span>';
      }
    });

    document.getElementById('importTextGo').addEventListener('click', async function () {
      var text = document.getElementById('importText').value;
      msg.innerHTML = '<span class="muted">Dang doc...</span>';
      try {
        var imported = await api.comps.importText(text);
        addImported(imported);
        msg.innerHTML = '<span class="ok">Da nhap ' + imported.length + ' doi hinh.</span>';
      } catch (err) {
        msg.innerHTML = '<span class="warn">' + esc(err.message) + '</span>';
      }
    });

    function addImported(imported) {
      comps = comps.concat(imported);
      activeCompId = imported.length ? imported[0].id : activeCompId;
      saveComps();
    }
  }

  // ---------------------------------------------------------------- trang bi

  function bindItems() {
    buildRecipeGrid(document.getElementById('dashRecipeGrid'), document.getElementById('dashRecipeHint'));

    var picker = document.getElementById('bagPicker');
    picker.innerHTML = tables.COMPONENTS.map(function (c) {
      return '<span class="chip" data-id="' + c.id + '" title="' + esc(c.stat) + '">' + esc(c.vi) +
        '<span class="count" data-count="' + c.id + '"></span></span>';
    }).join('');
    picker.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      var id = chip.dataset.id;
      bag[id] = (bag[id] || 0) + 1;
      renderBag();
    });
    picker.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      var chip = e.target.closest('.chip');
      if (!chip) return;
      var id = chip.dataset.id;
      bag[id] = Math.max(0, (bag[id] || 0) - 1);
      renderBag();
    });

    var target = document.getElementById('itemTarget');
    var names = Array.from(new Set(Object.values(tables.RECIPES))).sort();
    target.innerHTML = names.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('');
    target.addEventListener('change', renderNeed);

    renderBag();
    renderNeed();
  }

  function bagList() {
    var out = [];
    Object.keys(bag).forEach(function (id) {
      for (var i = 0; i < bag[id]; i++) out.push(id);
    });
    return out;
  }

  function renderBag() {
    tables.COMPONENTS.forEach(function (c) {
      var el = document.querySelector('[data-count="' + c.id + '"]');
      if (el) el.textContent = bag[c.id] ? ' x' + bag[c.id] : '';
      var chip = document.querySelector('.chip[data-id="' + c.id + '"]');
      if (chip) chip.setAttribute('aria-pressed', String(Boolean(bag[c.id])));
    });

    var list = bagList();
    var craftable = calc.craftable(list);
    var host = document.getElementById('bagResult');
    if (!list.length) {
      host.innerHTML = '<span class="muted small">Bam vao mon co ban de them (bam chuot phai de bot).</span>';
      return;
    }
    var seen = {};
    var unique = craftable.filter(function (x) {
      if (seen[x.item]) return false;
      seen[x.item] = true;
      return true;
    });
    host.innerHTML = '<div class="small muted">Ghep duoc ngay (' + unique.length + '):</div>' +
      unique.map(function (x) {
        var note = tables.ITEM_NOTES[x.item];
        return '<div class="kv"><span><b class="cost-5">' + esc(x.item) + '</b>' +
          (note ? '<div class="small muted">' + esc(note) + '</div>' : '') + '</span>' +
          '<span class="small muted">' + x.from.map(compName).join(' + ') + '</span></div>';
      }).join('');
    renderNeed();
  }

  function renderNeed() {
    var target = document.getElementById('itemTarget');
    var host = document.getElementById('itemNeed');
    if (!target || !target.value) return;
    var need = calc.missingFor(target.value, bagList());
    if (!need) { host.innerHTML = '<span class="muted">Khong ro cong thuc.</span>'; return; }
    host.innerHTML = '<div class="kv"><span>Cong thuc</span><b>' + need.recipe.map(compName).join(' + ') + '</b></div>' +
      (need.missing.length
        ? '<div class="kv"><span>Con thieu</span><b class="warn">' + need.missing.map(compName).join(', ') + '</b></div>'
        : '<div class="ok">Du do de ghep ngay.</div>') +
      (tables.ITEM_NOTES[target.value] ? '<div class="small muted" style="margin-top:6px">' + esc(tables.ITEM_NOTES[target.value]) + '</div>' : '');
  }

  function compName(id) {
    var c = tables.COMPONENTS.find(function (x) { return x.id === id; });
    return c ? c.vi : id;
  }

  function buildRecipeGrid(table, hint) {
    var grid = calc.recipeGrid();
    var html = '<tr><td class="cell head"></td>' + tables.COMPONENTS.map(function (c) {
      return '<td class="cell head">' + esc(c.vi) + '</td>';
    }).join('') + '</tr>';
    grid.forEach(function (row) {
      html += '<tr><td class="cell head">' + esc(row.component.vi) + '</td>' +
        row.cells.map(function (cell) {
          return '<td class="cell" data-item="' + esc(cell.item || '') + '">' + esc(cell.itemVi || cell.item || '') + '</td>';
        }).join('') + '</tr>';
    });
    table.innerHTML = html;
    table.addEventListener('mouseover', function (e) {
      var td = e.target.closest('td[data-item]');
      if (!td || !hint) return;
      var name = td.dataset.item;
      var note = tables.ITEM_NOTES[name];
      hint.innerHTML = '<b class="cost-5">' + esc((tables.ITEM_NAMES_VI && tables.ITEM_NAMES_VI[name]) || name) + '</b>' +
        (note ? ' &mdash; ' + esc(note) : '');
    });
  }

  // -------------------------------------------------------------------- odds

  function bindOdds() {
    var ids = ['dLevel', 'dCost', 'dOwned', 'dTaken', 'dOut', 'dNeed', 'dGold'];
    var el = {};
    ids.forEach(function (id) { el[id] = document.getElementById(id); });

    el.dLevel.value = config.state.level;
    el.dCost.value = config.state.champCost;
    el.dOwned.value = config.state.copiesOwned;
    el.dTaken.value = config.state.copiesTakenByOthers;
    el.dOut.value = config.state.champsOutOfPool;
    el.dNeed.value = 1;
    el.dGold.value = config.state.rolls * 2;

    function render() {
      var rolls = Math.floor(el.dGold.value / 2);
      var opts = {
        level: +el.dLevel.value,
        cost: +el.dCost.value,
        copiesOwnedByYou: +el.dOwned.value,
        copiesTakenByOthers: +el.dTaken.value,
        championsOutOfPool: +el.dOut.value,
        rolls: rolls,
        copiesNeeded: +el.dNeed.value
      };
      var out = calc.rollOutcome(opts);
      document.getElementById('dGoldLabel').textContent = el.dGold.value;
      document.getElementById('dRollsLabel').textContent = rolls;

      document.getElementById('dResult').innerHTML =
        '<div class="kv"><span>Trung it nhat ' + opts.copiesNeeded + ' ban sao</span>' +
        '<b class="big-num">' + calc.percent(out.probabilityAtLeastNeeded, 1) + '</b></div>' +
        '<div class="bar"><i style="width:' + (out.probabilityAtLeastNeeded * 100).toFixed(0) + '%"></i></div>' +
        '<table style="margin-top:10px">' +
        tr('Xac suat moi o cua hang', calc.percent(out.slotProbability, 2)) +
        tr('Xac suat moi lan roll (5 o)', calc.percent(out.shopProbability, 1)) +
        tr('Ky vong so ban sao nhan duoc', out.expectedCopies.toFixed(2)) +
        tr('Vang trung binh cho 1 ban sao', isFinite(out.expectedGoldForOne) ? Math.round(out.expectedGoldForOne) + 'v' : '-') +
        tr('Ban sao con trong kho', out.copiesLeftInPool) +
        '</table>';

      document.getElementById('dConfidence').innerHTML =
        '<tr><th>Muc chac chan</th><th class="num">Vang can</th><th class="num">So lan roll</th></tr>' +
        [0.5, 0.75, 0.9, 0.95].map(function (c) {
          var gold = calc.goldForConfidence(opts, c);
          return '<tr><td>' + Math.round(c * 100) + '%</td><td class="num">' +
            (isFinite(gold) ? gold + 'v' : '-') + '</td><td class="num">' +
            (isFinite(gold) ? gold / 2 : '-') + '</td></tr>';
        }).join('');

      renderDecision(opts);

      api.config.patch({ state: {
        level: +el.dLevel.value, champCost: +el.dCost.value,
        copiesOwned: +el.dOwned.value, copiesTakenByOthers: +el.dTaken.value,
        champsOutOfPool: +el.dOut.value, rolls: rolls
      } });
    }

    ids.forEach(function (id) { el[id].addEventListener('input', render); });
    ['dvGold', 'dvXp', 'dvKeep'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', render);
    });

    /** So sanh ba phuong an va to dam phuong an tot nhat. */
    function renderDecision(opts) {
      var decision = calc.rollVsLevel({
        gold: +document.getElementById('dvGold').value,
        xp: +document.getElementById('dvXp').value,
        keepGold: +document.getElementById('dvKeep').value,
        level: opts.level,
        cost: opts.cost,
        copiesOwnedByYou: opts.copiesOwnedByYou,
        copiesTakenByOthers: opts.copiesTakenByOthers,
        championsOutOfPool: opts.championsOutOfPool,
        copiesNeeded: opts.copiesNeeded,
        expectedExtraTaken: 1
      });

      document.getElementById('dvResult').innerHTML = decision.options.map(function (o) {
        var best = o.key === decision.best;
        var label = decisionLabel(o);
        return '<div style="margin-bottom:8px">' +
          '<div class="kv"><span>' + (best ? '<b class="cost-5">' + esc(label) + '</b>' : esc(label)) +
          '<div class="small muted">' + o.rolls + ' lan roll' +
          (o.levelGold ? ', ton ' + o.levelGold + 'v mua XP' : '') +
          (o.income ? ', +' + o.income + 'v thu nhap' : '') + '</div></span>' +
          '<b class="' + (best ? 'cost-5' : 'muted') + '">' + calc.percent(o.probability, 1) + '</b></div>' +
          '<div class="bar"><i style="width:' + (o.probability * 100).toFixed(0) + '%' +
          (best ? '' : ';opacity:.45') + '"></i></div></div>';
      }).join('') +
      '<div class="small muted">Tinh theo so ban sao can o o "So ban sao can them" ben trai.</div>';
    }

    document.getElementById('dOddsTable').innerHTML =
      '<tr><th>Cap</th>' + [1, 2, 3, 4, 5].map(function (c) {
        return '<th class="num cost-' + c + '">' + c + ' vang</th>';
      }).join('') + '</tr>' +
      Object.keys(tables.SHOP_ODDS).map(function (lv) {
        return '<tr><td>' + lv + '</td>' + tables.SHOP_ODDS[lv].map(function (p) {
          return '<td class="num">' + (p ? p + '%' : '-') + '</td>';
        }).join('') + '</tr>';
      }).join('');

    renderPoolTable();

    render();
  }

  /** Kho tuong: doi chieu bang mac dinh voi so dem duoc tu du lieu set. */
  function renderPoolTable() {
    var pool = calc.getPool();
    var hasData = dataset && dataset.champions && dataset.champions.length;
    var diff = hasData ? db.poolDiff(dataset) : [];

    document.getElementById('dPoolTable').innerHTML =
      '<tr><th>Gia</th><th class="num">Ban sao / tuong</th><th class="num">So tuong</th><th class="num">Tong kho</th></tr>' +
      [1, 2, 3, 4, 5].map(function (cost) {
        var p = pool[cost];
        var row = diff.find(function (d) { return d.cost === cost; });
        var note = row && row.changed
          ? ' <span class="small muted">(bang mac dinh ghi ' + row.hardcoded + ')</span>'
          : '';
        return '<tr><td class="cost-' + cost + '">' + cost + ' vang</td><td class="num">' + p.copies +
          '</td><td class="num">' + p.champions + note + '</td><td class="num">' + (p.copies * p.champions) + '</td></tr>';
      }).join('') +
      '<tr><td colspan="4" class="small muted">' +
      (hasData
        ? 'So tuong dem tu du lieu set ' + esc(dataset.setName || '') + '. So ban sao moi tuong lay tu bang chuan cua Riot.'
        : 'Chua dong bo du lieu set nen dang dung bang mac dinh - ti le tinh ra co the lech.') +
      '</td></tr>';
  }

  // ------------------------------------------------------------------- econ

  function bindEcon() {
    var gold = document.getElementById('eGold');
    var streak = document.getElementById('eStreak');
    var spend = document.getElementById('eSpend');
    var rounds = document.getElementById('eRounds');
    var win = document.getElementById('eWin');

    gold.value = config.state.gold;
    streak.value = 0;
    spend.value = 0;
    rounds.value = 5;

    function render() {
      var income = calc.incomeNextRound({ gold: +gold.value, streak: +streak.value, win: win.checked });
      document.getElementById('eResult').innerHTML =
        '<table>' +
        tr('Thu nhap co ban', income.base + 'v') +
        tr('Lai (toi da 5)', '+' + income.interest + 'v') +
        tr('Thuong chuoi', '+' + income.streak + 'v') +
        tr('Thuong thang', '+' + income.win + 'v') +
        '<tr><td><b>Tong vong sau</b></td><td class="num"><b class="big-num">' + income.total + 'v</b></td></tr>' +
        '</table>';

      var rows = calc.projectGold({
        gold: +gold.value, streak: +streak.value, win: win.checked,
        rounds: +rounds.value, spendPerRound: +spend.value
      });
      document.getElementById('eProjection').innerHTML =
        '<tr><th>Vong</th><th class="num">Thu nhap</th><th class="num">Lai</th><th class="num">Vang sau vong</th></tr>' +
        rows.map(function (r) {
          return '<tr><td>+' + r.round + '</td><td class="num">' + r.income + 'v</td><td class="num">' +
            r.interest + 'v</td><td class="num">' + r.gold + 'v</td></tr>';
        }).join('');

      api.config.patch({ state: { gold: +gold.value } });
    }

    [gold, streak, spend, rounds, win].forEach(function (el) { el.addEventListener('input', render); });
    render();

    // ---- len cap
    var lLevel = document.getElementById('lLevel');
    var lXp = document.getElementById('lXp');
    var lTarget = document.getElementById('lTarget');
    lLevel.value = config.state.level;
    lXp.value = config.state.xp;
    lTarget.value = config.state.targetLevel;

    function renderLevel() {
      var r = calc.levelCost(+lLevel.value, +lXp.value, +lTarget.value);
      var next = calc.levelCost(+lLevel.value, +lXp.value, +lLevel.value + 1);
      document.getElementById('lResult').innerHTML =
        '<table>' +
        tr('XP con thieu de len cap ' + lTarget.value, r.xp) +
        tr('Vang phai mua XP', '<b class="big-num">' + r.gold + 'v</b>') +
        tr('So lan bam mua XP (4v)', r.buys) +
        tr('Neu khong mua, cho khoang', r.rounds + ' vong') +
        tr('Len 1 cap ke tiep het', next.gold + 'v') +
        '</table>';
      api.config.patch({ state: { level: +lLevel.value, xp: +lXp.value, targetLevel: +lTarget.value } });
    }
    [lLevel, lXp, lTarget].forEach(function (el) { el.addEventListener('input', renderLevel); });
    renderLevel();

    document.getElementById('lTable').innerHTML =
      '<tr><th>Tu cap</th><th class="num">XP can</th><th class="num">Vang neu mua het</th></tr>' +
      Object.keys(tables.XP_TO_NEXT).map(function (lv) {
        var xp = tables.XP_TO_NEXT[lv];
        return '<tr><td>' + lv + ' &rarr; ' + (+lv + 1) + '</td><td class="num">' + xp +
          '</td><td class="num">' + Math.ceil(xp / 4) * 4 + 'v</td></tr>';
      }).join('');

    document.getElementById('roadmapTable').innerHTML =
      '<tr><th>Vong</th><th>Cap</th><th>Ghi chu</th></tr>' +
      tables.LEVEL_ROADMAP.map(function (r) {
        return '<tr><td>' + r.round + '</td><td class="cost-5">' + r.level + '</td><td class="small">' + esc(r.note) + '</td></tr>';
      }).join('');
  }

  // ------------------------------------------------------------------ champs

  function bindChamps() {
    document.getElementById('syncData').addEventListener('click', async function () {
      var btn = this;
      btn.disabled = true;
      btn.textContent = 'Dang tai...';
      try {
        var res = await api.data.sync();
        dataset = await api.data.load();
        applyRealPool();
        renderSetInfo();
        renderChamps();
        renderPoolTable();
        toast('Da tai ' + res.champions + ' tuong cua ' + res.setName + '. Kho tuong da cap nhat theo set nay.');
      } catch (err) {
        toast('Loi dong bo: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Dong bo du lieu set';
      }
    });
    document.getElementById('champSearch').addEventListener('input', renderChamps);
    renderChamps();
  }

  function renderChamps() {
    var host = document.getElementById('champBoard');
    var query = (document.getElementById('champSearch').value || '').toLowerCase();
    if (!dataset.champions.length) {
      host.innerHTML = '<div class="card muted">Chua co du lieu tuong. Bam "Dong bo du lieu set" (can mang) de tai danh sach tuong, toc/he cua set dang choi.</div>';
      return;
    }
    var filtered = dataset.champions.filter(function (c) {
      if (!query) return true;
      return c.name.toLowerCase().indexOf(query) >= 0 ||
        (c.traits || []).join(' ').toLowerCase().indexOf(query) >= 0;
    });
    var groups = [1, 2, 3, 4, 5].map(function (cost) {
      var list = filtered.filter(function (c) { return c.cost === cost; });
      if (!list.length) return '';
      return '<div class="cost-group"><h3 class="cost-' + cost + '">' + cost + ' vang (' + list.length + ')</h3>' +
        '<div class="champ-grid">' + list.map(function (c) {
          return '<div class="champ">' +
            (c.icon ? '<img src="' + esc(c.icon) + '" alt="" onerror="this.style.visibility=\'hidden\'" />' : '') +
            '<div><div class="n cost-' + c.cost + '">' + esc(c.name) + '</div>' +
            '<div class="t">' + esc((c.traits || []).join(', ')) + '</div></div></div>';
        }).join('') + '</div></div>';
    }).join('');
    host.innerHTML = groups || '<div class="card muted">Khong tim thay tuong nao.</div>';
  }

  function renderSetInfo() {
    var el = document.getElementById('setInfo');
    if (!dataset || !dataset.champions.length) {
      el.textContent = 'Chua dong bo du lieu set';
      return;
    }
    el.textContent = (dataset.setName || 'Set ?') + ' - ' + dataset.champions.length + ' tuong';
  }

  // ------------------------------------------------------------------- tools

  function bindTools() {
    fillDisplaySelects();

    var opacity = document.getElementById('opacity');
    opacity.value = Math.round(config.overlay.opacity * 100);
    document.getElementById('opacityLabel').textContent = opacity.value + '%';
    opacity.addEventListener('input', function () {
      document.getElementById('opacityLabel').textContent = opacity.value + '%';
      api.overlay.setOpacity(opacity.value / 100);
    });

    document.getElementById('toggleOverlay').addEventListener('click', function () { api.overlay.toggle(); });
    document.getElementById('toggleLock').addEventListener('click', function () {
      config.overlay.clickThrough = !config.overlay.clickThrough;
      api.overlay.setClickThrough(config.overlay.clickThrough);
    });

    var auto = document.getElementById('autoShow');
    auto.checked = config.general.autoShowWithGame;
    auto.addEventListener('change', function () {
      api.config.set('general.autoShowWithGame', auto.checked);
    });

    var toggles = document.getElementById('widgetToggles');
    var labels = { odds: 'Ti le roll', econ: 'Kinh te', timer: 'Vong dau', items: 'Cong thuc do', comp: 'Doi hinh', notes: 'Ghi chu' };
    toggles.innerHTML = Object.keys(config.overlay.widgets).map(function (name) {
      return '<span class="chip" data-w="' + name + '" aria-pressed="' +
        Boolean(config.overlay.widgets[name].visible) + '">' + (labels[name] || name) + '</span>';
    }).join('');
    toggles.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      var name = chip.dataset.w;
      var visible = chip.getAttribute('aria-pressed') !== 'true';
      chip.setAttribute('aria-pressed', String(visible));
      api.overlay.updateWidget(name, { visible: visible });
    });

    document.getElementById('openSettings').addEventListener('click', function () { api.settings.open(); });
    bindMobileServer();

    var names = {
      toggleOverlay: 'Bat/tat overlay',
      toggleClickThrough: 'Khoa/mo chuot overlay',
      toggleDashboard: 'Bat/tat dashboard',
      resetTimer: 'Dem nguoc 30 giay',
      opacityUp: 'Tang do mo',
      opacityDown: 'Giam do mo',
      moveOverlayScreen: 'Chuyen overlay sang man khac'
    };
    document.getElementById('hotkeyTable').innerHTML =
      Object.keys(config.hotkeys).map(function (action) {
        return '<tr><td>' + (names[action] || action) + '</td><td class="right"><code>' +
          esc(config.hotkeys[action]) + '</code></td></tr>';
      }).join('');
  }

  /** Bat/tat may chu cho dien thoai va hien dia chi de go tren may. */
  async function bindMobileServer() {
    var portInput = document.getElementById('mobilePort');
    var toggle = document.getElementById('mobileToggle');
    var auto = document.getElementById('mobileAuto');
    portInput.value = (config.mobile && config.mobile.port) || 7333;
    auto.checked = Boolean(config.mobile && config.mobile.autoStart);
    auto.addEventListener('change', function () { api.config.set('mobile.autoStart', auto.checked); });

    function render(status) {
      var info = document.getElementById('mobileInfo');
      toggle.textContent = status.running ? 'Tat' : 'Bat';
      toggle.setAttribute('aria-pressed', String(status.running));
      if (!status.running) {
        info.innerHTML = '<span class="muted">Dang tat.</span>';
        return;
      }
      info.innerHTML = '<div class="ok">Dang chay o cong ' + status.port + '. Go dia chi nay tren dien thoai:</div>' +
        status.addresses.map(function (a) {
          return '<div class="kv"><code>' + esc(a) + '</code>' +
            '<button class="ghost small" data-copy="' + esc(a) + '">Chep</button></div>';
        }).join('');
      info.querySelectorAll('[data-copy]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          navigator.clipboard.writeText(btn.dataset.copy);
          toast('Da chep: ' + btn.dataset.copy);
        });
      });
    }

    toggle.addEventListener('click', async function () {
      toggle.disabled = true;
      try {
        var status = await api.mobile.status();
        var next = status.running ? await api.mobile.stop() : await api.mobile.start(Number(portInput.value));
        render(next);
      } catch (err) {
        toast('Loi: ' + err.message);
      } finally {
        toggle.disabled = false;
      }
    });

    api.on('mobile:status', render);
    render(await api.mobile.status());
  }

  /** Ten tieng Viet cho tung phuong an quyet dinh. */
  function decisionLabel(option) {
    if (option.key === 'roll') return 'Roll ngay o cap ' + option.level;
    if (option.key === 'level') return 'Len cap ' + option.level + ' roi roll';
    return 'Cho mot vong, an lai';
  }

  function fillDisplaySelects() {
    ['overlayDisplay', 'dashDisplay'].forEach(function (id) {
      var sel = document.getElementById(id);
      if (!sel) return;
      var current = id === 'overlayDisplay' ? config.overlay.displayId : config.dashboard.displayId;
      sel.innerHTML = displays.map(function (d) {
        return '<option value="' + d.id + '"' + (d.id === current ? ' selected' : '') + '>' + esc(d.label) + '</option>';
      }).join('');
      sel.onchange = function () {
        var value = Number(sel.value);
        if (id === 'overlayDisplay') api.overlay.moveToDisplay(value);
        else api.dashboard.moveToDisplay(value);
      };
    });
  }

  // ----------------------------------------------------------- loi nang cap (augments)

  function bindAugments() {
    var searchInput = document.getElementById('augSearch');
    var tierSelect = document.getElementById('augTierFilter');
    var tagSelect = document.getElementById('augTagFilter');
    var evalBtn = document.getElementById('augEvaluateBtn');

    if (searchInput) searchInput.addEventListener('input', renderAugmentLibrary);
    if (tierSelect) tierSelect.addEventListener('change', renderAugmentLibrary);
    if (tagSelect) tagSelect.addEventListener('change', renderAugmentLibrary);
    if (evalBtn) evalBtn.addEventListener('click', evaluateSelectedAugments);

    renderAugmentDatalist();
    renderAugmentLibrary();
  }

  function renderAugmentDatalist() {
    var dl = document.getElementById('augDatalist');
    if (!dl || !dataset || !dataset.augments) return;
    dl.innerHTML = dataset.augments.map(function (a) {
      return '<option value="' + esc(a.name) + '">' + esc(a.tier ? '[' + a.tier.toUpperCase() + '] ' : '') + esc(a.name) + '</option>';
    }).join('');
  }

  function renderAugmentLibrary() {
    var container = document.getElementById('augLibrary');
    var countLabel = document.getElementById('augCountLabel');
    if (!container || !dataset) return;

    var query = (document.getElementById('augSearch') && document.getElementById('augSearch').value) || '';
    var tier = (document.getElementById('augTierFilter') && document.getElementById('augTierFilter').value) || '';
    var tag = (document.getElementById('augTagFilter') && document.getElementById('augTagFilter').value) || '';

    var filtered = db.searchAugments(dataset, query, { tier: tier || null, tag: tag || null });
    if (countLabel) countLabel.textContent = filtered.length;

    if (!filtered.length) {
      container.innerHTML = '<div class="muted small" style="padding:10px">Khong tim thay loi phu hop.</div>';
      return;
    }

    container.innerHTML = filtered.map(function (a) {
      var tierBadge = a.tier ? '<span class="badge badge-tier-' + esc(a.tier) + '">' + esc(a.tier) + '</span>' : '';
      var tagBadges = (a.tags || []).map(function (t) { return '<span class="chip" style="padding:2px 6px;font-size:9px">' + esc(t) + '</span>'; }).join('');
      var icon = a.icon ? '<img src="' + esc(a.icon) + '" alt="" loading="lazy" />' : '';
      return '<div class="aug-card">' +
        icon +
        '<div class="aug-body">' +
          '<div class="aug-title"><span class="aug-name">' + esc(a.name) + '</span>' + tierBadge + '</div>' +
          '<div class="aug-desc">' + esc(a.desc || 'Chua co mo ta.') + '</div>' +
          '<div class="aug-meta">' + tagBadges + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function evaluateSelectedAugments() {
    var p1 = (document.getElementById('augPick1') && document.getElementById('augPick1').value || '').trim();
    var p2 = (document.getElementById('augPick2') && document.getElementById('augPick2').value || '').trim();
    var p3 = (document.getElementById('augPick3') && document.getElementById('augPick3').value || '').trim();
    var resultEl = document.getElementById('augRankResult');
    if (!resultEl || !dataset || !dataset.augments) return;

    var picks = [p1, p2, p3].filter(Boolean);
    if (!picks.length) {
      resultEl.innerHTML = '<div class="muted small">Vui long nhap hoac chon it nhat 1 loi de danh gia.</div>';
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
      resultEl.innerHTML = '<div class="warn small">Khong tim thay loi trong bo du lieu.</div>';
      return;
    }

    var activeComp = comps.find(function (c) { return c.id === activeCompId; });
    var state = {
      stage: (document.getElementById('augStage') && document.getElementById('augStage').value) || '2-1',
      hp: Number(document.getElementById('augHp') && document.getElementById('augHp').value) || 100,
      gold: Number(document.getElementById('augGold') && document.getElementById('augGold').value) || 50,
      board: (activeComp && activeComp.units) || []
    };

    var ranked = analyzer.rankAugments(augs, state, dataset);

    var recLabels = {
      must_pick: 'Tuyet voi (Nen chon)',
      recommended: 'Khuyen dung',
      situational: 'Tuy tinh huong',
      avoid: 'Nen bo qua'
    };

    resultEl.innerHTML = '<h4>Ket qua xep hang (' + ranked.length + ' loi):</h4><div class="aug-grid" style="margin-top:8px">' +
      ranked.map(function (r, idx) {
        var recBadge = '<span class="badge badge-' + esc(r.recommendation) + '">' + esc(recLabels[r.recommendation] || r.recommendation) + '</span>';
        var tierBadge = r.tier ? '<span class="badge badge-tier-' + esc(r.tier) + '">' + esc(r.tier) + '</span>' : '';
        var icon = r.augment.icon ? '<img src="' + esc(r.augment.icon) + '" alt="" />' : '';
        return '<div class="aug-card" style="border-left: 3px solid ' + (r.recommendation === 'must_pick' ? 'var(--green)' : r.recommendation === 'avoid' ? 'var(--red)' : 'var(--gold)') + '">' +
          icon +
          '<div class="aug-body">' +
            '<div class="aug-title"><span class="aug-name">#' + (idx + 1) + ' ' + esc(r.augment.name) + ' (' + r.score + ' diem)</span><div>' + recBadge + ' ' + tierBadge + '</div></div>' +
            '<div class="aug-desc">' + esc(r.augment.desc || '') + '</div>' +
            '<div class="aug-reason"><b>Ly do:</b> ' + esc(r.reason) + '</div>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
  }

  // ------------------------------------------------------------------ reroll

  var rerollOwnedMap = {};

  function bindReroll() {
    fillRerollCompSelect();
    var select = document.getElementById('rerollCompSelect');
    if (select) select.addEventListener('change', renderRerollPlan);
    var refreshBtn = document.getElementById('rerollRefreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', renderRerollPlan);
    var evalBtn = document.getElementById('evalShopBtn');
    if (evalBtn) evalBtn.addEventListener('click', evaluateDashboardShop);

    renderRerollPlan();
  }

  function fillRerollCompSelect() {
    var select = document.getElementById('rerollCompSelect');
    if (!select) return;
    var current = select.value;
    select.innerHTML = comps.map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.name) + ' (' + esc(c.tier || 'A') + ' Tier)</option>';
    }).join('');
    if (current) select.value = current;
  }

  function renderRerollPlan() {
    var select = document.getElementById('rerollCompSelect');
    var compId = select ? select.value : '';
    var comp = comps.find(function (c) { return c.id === compId; }) || comps[0];
    if (!comp) return;

    var titleEl = document.getElementById('rerollCompTitle');
    var badgeEl = document.getElementById('rerollStrategyBadge');
    var textEl = document.getElementById('rerollStrategyText');
    var listEl = document.getElementById('rerollUnitList');
    var buyGoldEl = document.getElementById('rerollBuyGold');
    var totalGoldEl = document.getElementById('rerollTotalGold');
    var tipEl = document.getElementById('rerollLevelTip');

    if (titleEl) titleEl.textContent = comp.name;

    var currentShop = [
      (document.getElementById('shopSlot1') && document.getElementById('shopSlot1').value || '').trim(),
      (document.getElementById('shopSlot2') && document.getElementById('shopSlot2').value || '').trim(),
      (document.getElementById('shopSlot3') && document.getElementById('shopSlot3').value || '').trim(),
      (document.getElementById('shopSlot4') && document.getElementById('shopSlot4').value || '').trim(),
      (document.getElementById('shopSlot5') && document.getElementById('shopSlot5').value || '').trim()
    ].filter(Boolean);

    var plan = calc.buildCompRerollPlan(comp, rerollOwnedMap, {
      level: config.state.level || 7,
      gold: config.state.gold || 50,
      shop: currentShop
    });

    if (!plan) return;

    if (badgeEl) badgeEl.textContent = 'Roll cấp ' + plan.recommendedRollLevel;
    if (textEl) textEl.innerHTML = '<b>Chiến lược:</b> ' + esc(plan.rollStrategy);
    if (buyGoldEl) buyGoldEl.textContent = plan.totalBuyGold + ' vàng';
    if (totalGoldEl) totalGoldEl.textContent = (isFinite(plan.totalExpectedGold) ? plan.totalExpectedGold : '—') + ' vàng';
    if (tipEl) {
      tipEl.innerHTML = 'Cấp độ roll tối ưu: <b>Cấp ' + plan.recommendedRollLevel + '</b>. Khi săn tướng 3 sao, hãy tích đủ 50 vàng để tối ưu lợi tức 5 vàng mỗi round.';
    }

    if (listEl) {
      listEl.innerHTML = plan.shoppingList.map(function (item) {
        var isCarry = item.targetStar === 3 || item.cost >= 4;
        var percent = Math.min(100, Math.round((item.owned / item.calculation.targetCopies) * 100));
        var progressColor = percent >= 100 ? 'var(--green)' : percent >= 66 ? 'var(--gold)' : 'var(--blue)';

        return '<div class="card" style="padding:8px 12px;background:rgba(255,255,255,0.02);border-left:3px solid ' + (item.carry ? 'var(--gold)' : 'var(--border)') + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<div>' +
              '<span class="cost-' + item.cost + '" style="font-weight:600">' + esc(item.name) + '</span> ' +
              '<span class="small muted">(' + item.cost + ' vàng' + (item.carry ? ' • Carry chính' : '') + ')</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:6px">' +
              '<button class="mini reroll-dec" data-champ="' + esc(item.name.toLowerCase()) + '">-</button>' +
              '<span style="font-weight:bold;min-width:32px;text-align:center">' + item.progress + '</span>' +
              '<button class="mini reroll-inc" data-champ="' + esc(item.name.toLowerCase()) + '">+</button>' +
              '<span class="badge" style="background:var(--bg-card);color:' + progressColor + '">' + item.targetStar + '★</span>' +
            '</div>' +
          '</div>' +
          '<div style="margin-top:6px;background:rgba(0,0,0,0.3);height:6px;border-radius:3px;overflow:hidden">' +
            '<div style="width:' + percent + '%;height:100%;background:' + progressColor + ';transition:width .2s"></div>' +
          '</div>' +
          '<div class="small muted" style="margin-top:4px;display:flex;justify-content:space-between">' +
            '<span>Còn thiếu: ' + item.calculation.copiesNeeded + ' bản sao (' + item.calculation.buyGold + 'v)</span>' +
            '<span>Trong kho: còn ' + item.calculation.copiesLeftInPool + ' con</span>' +
          '</div>' +
        '</div>';
      }).join('');

      listEl.querySelectorAll('.reroll-inc').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var name = btn.dataset.champ;
          var cur = rerollOwnedMap[name] !== undefined ? rerollOwnedMap[name] : 1;
          rerollOwnedMap[name] = Math.min(9, cur + 1);
          renderRerollPlan();
        });
      });

      listEl.querySelectorAll('.reroll-dec').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var name = btn.dataset.champ;
          var cur = rerollOwnedMap[name] !== undefined ? rerollOwnedMap[name] : 1;
          rerollOwnedMap[name] = Math.max(0, cur - 1);
          renderRerollPlan();
        });
      });
    }
  }

  function evaluateDashboardShop() {
    var select = document.getElementById('rerollCompSelect');
    var compId = select ? select.value : '';
    var comp = comps.find(function (c) { return c.id === compId; }) || comps[0];
    var resultEl = document.getElementById('shopEvalResult');
    if (!resultEl || !comp) return;

    var shop = [
      (document.getElementById('shopSlot1') && document.getElementById('shopSlot1').value || '').trim(),
      (document.getElementById('shopSlot2') && document.getElementById('shopSlot2').value || '').trim(),
      (document.getElementById('shopSlot3') && document.getElementById('shopSlot3').value || '').trim(),
      (document.getElementById('shopSlot4') && document.getElementById('shopSlot4').value || '').trim(),
      (document.getElementById('shopSlot5') && document.getElementById('shopSlot5').value || '').trim()
    ].filter(Boolean);

    if (!shop.length) {
      resultEl.innerHTML = '<span class="muted">Hãy nhập ít nhất 1 tướng trong cửa hàng để kiểm tra.</span>';
      return;
    }

    var plan = calc.buildCompRerollPlan(comp, rerollOwnedMap, {
      level: config.state.level || 7,
      gold: config.state.gold || 50,
      shop: shop
    });

    if (plan.matchedInShop && plan.matchedInShop.length) {
      resultEl.innerHTML = '<div style="padding:8px;background:rgba(34,197,94,0.1);border-left:3px solid var(--green);border-radius:4px">' +
        '<b style="color:var(--green)">Có ' + plan.matchedInShop.length + ' tướng mục tiêu trong Shop:</b>' +
        '<ul style="margin:4px 0 0 16px;padding:0">' +
          plan.matchedInShop.map(function (m) {
            return '<li><b>Ô ' + m.slot + ': ' + esc(m.name) + ' (' + m.cost + 'v)</b> — ' + esc(m.reason) + '</li>';
          }).join('') +
        '</ul>' +
      '</div>';
    } else {
      resultEl.innerHTML = '<div style="padding:8px;background:rgba(255,255,255,0.04);border-radius:4px" class="muted">' +
        'Không có tướng nào thuộc đội hình ' + esc(comp.name) + ' trong 5 ô này. Tiếp tục roll hoặc giữ tiền.' +
      '</div>';
    }
  }

  // ------------------------------------------------------------------- scout

  var scoutOpponents = [
    { id: 1, text: '' }, { id: 2, text: '' }, { id: 3, text: '' },
    { id: 4, text: '' }, { id: 5, text: '' }, { id: 6, text: '' }, { id: 7, text: '' }
  ];

  function bindScout() {
    renderOpponentInputs();
    var analyzeBtn = document.getElementById('scoutAnalyzeBtn');
    if (analyzeBtn) analyzeBtn.addEventListener('click', renderScoutAnalysis);
    var resetBtn = document.getElementById('scoutResetBtn');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      scoutOpponents.forEach(function (o) { o.text = ''; });
      renderOpponentInputs();
      renderScoutAnalysis();
    });

    renderScoutAnalysis();
  }

  function renderOpponentInputs() {
    var container = document.getElementById('opponentsList');
    if (!container) return;

    var compOptions = comps.map(function (c) {
      return '<option value="' + esc(c.name) + '">';
    }).join('');

    container.innerHTML = scoutOpponents.map(function (opp, idx) {
      return '<div class="row" style="align-items:center;gap:8px">' +
        '<span style="font-weight:bold;min-width:55px" class="small muted">Nhà #' + (idx + 1) + ':</span>' +
        '<input class="opp-input" data-idx="' + idx + '" list="scoutCompList" placeholder="Nhập tên bài hoặc carry đối thủ..." value="' + esc(opp.text) + '" style="flex:1" />' +
      '</div>';
    }).join('') + '<datalist id="scoutCompList">' + compOptions + '</datalist>';

    container.querySelectorAll('.opp-input').forEach(function (input) {
      input.addEventListener('input', function () {
        var i = parseInt(input.dataset.idx, 10);
        scoutOpponents[i].text = input.value.trim();
      });
    });
  }

  function renderScoutAnalysis() {
    var freeCompsEl = document.getElementById('freeCompsResult');
    var counterEl = document.getElementById('counterAdviceResult');
    if (!freeCompsEl || !counterEl) return;

    var opps = scoutOpponents.map(function (o) { return o.text; }).filter(Boolean);
    var analysis = analyzer.analyzeLobbyComps(opps, comps, dataset);

    // 1. Render cac doi hinh trong bai (Free Comps / Uncontested)
    if (analysis.topRecommendedComps.length) {
      freeCompsEl.innerHTML = analysis.topRecommendedComps.map(function (item) {
        var comp = item.comp;
        var badgeColor = item.isFree ? 'var(--green)' : item.contestedScore <= 35 ? 'var(--gold)' : 'var(--red)';
        var tierBadge = '<span class="badge" style="background:var(--gold-dim);color:var(--gold)">' + esc(item.tier) + ' Tier</span>';

        return '<div class="card" style="padding:10px 12px;background:rgba(255,255,255,0.02);border-left:3px solid ' + badgeColor + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<div>' +
              '<b style="font-size:14px">' + esc(comp.name) + '</b> ' + tierBadge +
            '</div>' +
            '<span class="badge" style="background:rgba(0,0,0,0.3);color:' + badgeColor + '">' + esc(item.statusText) + '</span>' +
          '</div>' +
          '<div class="small muted" style="margin-top:4px">' +
            'Carry: <b>' + esc(item.carryName || 'Đa dụng') + '</b> • Điểm khuyến nghị sảnh: <b style="color:var(--green)">' + item.lobbyScore + '/100</b>' +
          '</div>' +
          '<div style="margin-top:6px;display:flex;gap:6px">' +
            '<button class="mini primary scout-select-comp" data-id="' + esc(comp.id) + '">Chốt bài này để Reroll</button>' +
          '</div>' +
        '</div>';
      }).join('');

      freeCompsEl.querySelectorAll('.scout-select-comp').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.dataset.id;
          var sel = document.getElementById('rerollCompSelect');
          if (sel) {
            sel.value = id;
            var tabBtn = document.querySelector('.tab[data-tab="reroll"]');
            if (tabBtn) tabBtn.click();
            renderRerollPlan();
          }
        });
      });
    } else {
      freeCompsEl.innerHTML = '<div class="muted">Chưa có dữ liệu phân tích.</div>';
    }

    // 2. Render xu huong lobby & khac che
    var dominance = analysis.lobbyDominance;
    var counterHtml = '<div style="margin-bottom:10px;display:flex;gap:8px">' +
      '<span class="badge" style="background:rgba(59,130,246,0.1);color:#60a5fa">SMPT (AP): ' + dominance.ap + ' nhà</span>' +
      '<span class="badge" style="background:rgba(239,68,68,0.1);color:#f87171">STVL (AD): ' + dominance.ad + ' nhà</span>' +
      '<span class="badge" style="background:rgba(234,179,8,0.1);color:#facc15">Reroll: ' + dominance.reroll + ' nhà</span>' +
    '</div>';

    var adviceList = analysis.counterAdvice.map(function (adv) {
      return '<li style="margin-bottom:6px">' + esc(adv) + '</li>';
    }).join('');

    var itemsList = '';
    if (analysis.recommendedCounterItems.length) {
      itemsList = '<div style="margin-top:8px" class="small"><b>Trang bị khắc chế ưu tiên:</b> ' +
        analysis.recommendedCounterItems.map(function (it) {
          var itVi = (tables.ITEM_NAMES_VI && tables.ITEM_NAMES_VI[it]) || it;
          return '<span class="tag" style="margin-right:4px">' + esc(itVi) + '</span>';
        }).join('') +
      '</div>';
    }

    counterEl.innerHTML = counterHtml + '<ul style="margin:0;padding-left:18px" class="small">' + adviceList + '</ul>' + itemsList;
  }

  // ------------------------------------------------------------------- updater

  var currentUpdateInfo = null;

  function bindUpdater() {
    var banner = document.getElementById('updateBanner');
    var verText = document.getElementById('updateVerText');
    var notesText = document.getElementById('updateNotesText');
    var nowBtn = document.getElementById('updateNowBtn');
    var dismissBtn = document.getElementById('updateDismissBtn');
    var checkBtn = document.getElementById('checkUpdateBtn');
    var statusText = document.getElementById('updateStatusText');

    if (nowBtn) {
      nowBtn.addEventListener('click', function () {
        if (currentUpdateInfo && currentUpdateInfo.downloadUrl) {
          api.updater.openDownload(currentUpdateInfo.downloadUrl);
        } else {
          api.updater.openDownload('https://github.com/vianphm/TFT/releases');
        }
      });
    }

    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () {
        if (banner) banner.classList.add('hidden');
      });
    }

    if (checkBtn) {
      checkBtn.addEventListener('click', async function () {
        checkBtn.disabled = true;
        if (statusText) statusText.textContent = 'Đang kiểm tra từ GitHub...';
        try {
          var res = await api.updater.check();
          if (res && res.hasUpdate) {
            showUpdateBanner(res);
            if (statusText) statusText.innerHTML = '<span class="ok">Có bản mới: <b>v' + esc(res.latestVersion) + '</b></span>';
          } else {
            if (statusText) statusText.innerHTML = '<span class="ok">Bạn đang dùng phiên bản mới nhất (' + esc(res.currentVersion) + ').</span>';
            toast('Bạn đang ở phiên bản mới nhất (' + (res.currentVersion || '1.0.0') + ')');
          }
        } catch (err) {
          if (statusText) statusText.textContent = 'Lỗi kiểm tra: ' + err.message;
        } finally {
          checkBtn.disabled = false;
        }
      });
    }

    api.on('app:update-available', function (info) {
      showUpdateBanner(info);
    });
  }

  function showUpdateBanner(info) {
    if (!info || !info.hasUpdate) return;
    currentUpdateInfo = info;
    var banner = document.getElementById('updateBanner');
    var verText = document.getElementById('updateVerText');
    var notesText = document.getElementById('updateNotesText');
    if (banner) banner.classList.remove('hidden');
    if (verText) verText.textContent = 'v' + info.latestVersion;
    if (notesText && info.releaseName) notesText.textContent = info.releaseName;
  }

  // ------------------------------------------------------------------- misc

  async function refreshGameStatus() {
    renderGameStatus(await api.game.status());
  }

  function renderGameStatus(status) {
    var dot = document.getElementById('gameDot');
    var text = document.getElementById('gameText');
    dot.classList.toggle('on', Boolean(status.gameRunning || status.clientRunning));
    text.textContent = status.gameRunning ? 'Dang trong tran' :
      status.clientRunning ? 'Dang mo client' : 'Chua chay game';
  }

  function toast(text) {
    var el = document.createElement('div');
    el.className = 'card';
    el.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:60;max-width:340px;box-shadow:var(--shadow)';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 4000);
  }

  function tr(label, value) {
    return '<tr><td>' + label + '</td><td class="num">' + value + '</td></tr>';
  }

  function clip(text, max) {
    var s = String(text || '');
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  function shortItem(name) {
    return String(name).replace(/'s\b/, '').split(' ').map(function (w) { return w.slice(0, 3); }).join('');
  }

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
