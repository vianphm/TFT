/**
 * Bo may phan tich doi hinh.
 *
 * Chay duoc ca trong Node (kiem thu, tien trinh chinh) lan trinh duyet (overlay, dashboard, dien thoai).
 * Chi can du lieu chinh thuc cua set (tuong + toc he tu Community Dragon), khong can trang meta nao.
 *
 * Y tuong cham diem: moi toc/he co cac moc (vd 2/4/6). Mot doi hinh tot la doi hinh bat duoc
 * nhieu moc CAO, khong phai nhieu toc he le te - nen moc cang cao diem cang tang nhanh (binh phuong),
 * va nhung tuong khong dong gop vao moc nao bi tru diem.
 */
(function (global) {
  'use strict';

  var calc = (global.TFT && global.TFT.calc) ||
    (typeof require !== 'undefined' ? require('./calc.js') : null);

  // So ban sao can de len sao (tinh tu con so 0)
  var COPIES_FOR_STAR = { 1: 1, 2: 3, 3: 9 };

  var DEFAULT_WEIGHTS = {
    tierBase: 10,      // diem cho moc dau tien cua mot toc he
    tierGrowth: 2.2,   // moc cao hon nhan them (luy thua) -> uu tien bat sau thay vi bat rong
    wastePenalty: 3,   // tru diem cho tuong khong gop vao moc nao
    costPenalty: 0.6,  // tru nhe theo tong gia -> uu tien doi hinh de gom hon khi diem bang nhau
    nearBonus: 1.5     // thuong nho khi chi con thieu 1 tuong la len moc (de mo rong tiep)
  };

  // ------------------------------------------------------------ toc/he dang bat

  /**
   * Tinh trang toc he cua mot nhom tuong.
   * units: [{name, traits?}] - neu khong co traits thi tra cuu theo ten trong champions.
   */
  function traitBreakdown(units, dataset, options) {
    var opts = options || {};
    var traitDefs = indexTraits(dataset);
    var counts = {};

    dedupeUnits(units, dataset).forEach(function (unit) {
      (unit.traits || []).forEach(function (trait) {
        counts[trait] = (counts[trait] || 0) + 1;
      });
    });

    var rows = Object.keys(counts).map(function (name) {
      var breakpoints = traitDefs[name] || [];
      var count = counts[name];
      var activeIndex = -1;
      for (var i = 0; i < breakpoints.length; i++) {
        if (count >= breakpoints[i]) activeIndex = i;
      }
      var next = breakpoints.filter(function (b) { return b > count; })[0] || null;
      return {
        name: name,
        count: count,
        breakpoints: breakpoints,
        activeAt: activeIndex >= 0 ? breakpoints[activeIndex] : 0,
        tier: activeIndex + 1,               // 0 = chua bat
        maxTier: breakpoints.length,
        next: next,
        missing: next ? next - count : 0
      };
    });

    rows.sort(function (a, b) {
      return b.tier - a.tier || b.count - a.count || a.name.localeCompare(b.name);
    });

    return {
      active: rows.filter(function (r) { return r.tier > 0; }),
      inactive: rows.filter(function (r) { return r.tier === 0; }),
      all: rows,
      score: scoreRows(rows, dedupeUnits(units, dataset), opts.weights)
    };
  }

  function scoreRows(rows, units, weights) {
    var w = Object.assign({}, DEFAULT_WEIGHTS, weights || {});
    var score = 0;
    var contributing = {};

    rows.forEach(function (row) {
      if (row.tier > 0) {
        score += w.tierBase * Math.pow(w.tierGrowth, row.tier - 1);
        units.forEach(function (u) {
          if ((u.traits || []).indexOf(row.name) >= 0) contributing[unitKey(u)] = true;
        });
      } else if (row.missing === 1) {
        score += w.nearBonus;
      }
    });

    units.forEach(function (u) {
      if (!contributing[unitKey(u)]) score -= w.wastePenalty;
      score -= (u.cost || 1) * w.costPenalty;
    });

    return Math.round(score * 100) / 100;
  }

  // ------------------------------------------------------- goi y tuong tiep theo

  /**
   * Them tuong nao thi loi nhat? Tra ve danh sach xep hang theo diem tang them.
   */
  function suggestNextUnit(units, dataset, options) {
    var opts = options || {};
    var current = dedupeUnits(units, dataset);
    var have = {};
    current.forEach(function (u) { have[unitKey(u)] = true; });

    var base = traitBreakdown(current, dataset, opts).score;
    var pool = (dataset.champions || []).filter(function (c) {
      if (have[unitKey(c)]) return false;
      if (opts.maxCost && c.cost > opts.maxCost) return false;
      if (opts.exclude && opts.exclude.indexOf(c.name) >= 0) return false;
      return true;
    });

    return pool.map(function (champ) {
      var next = traitBreakdown(current.concat([champ]), dataset, opts);
      var unlocked = next.active.filter(function (row) {
        var before = traitBreakdown(current, dataset, opts).active
          .find(function (r) { return r.name === row.name; });
        return !before || before.tier < row.tier;
      });
      return {
        name: champ.name,
        cost: champ.cost,
        traits: champ.traits,
        gain: Math.round((next.score - base) * 100) / 100,
        unlocks: unlocked.map(function (r) { return r.name + ' ' + r.activeAt; })
      };
    }).sort(function (a, b) {
      return b.gain - a.gain || a.cost - b.cost || a.name.localeCompare(b.name);
    }).slice(0, opts.limit || 8);
  }

  // ------------------------------------------------------------ tim doi hinh toi uu

  /**
   * Tim to hop tuong tot nhat bang beam search.
   *  size      : so o tren san (= cap cua ban)
   *  maxCost   : chi xet tuong tu gia nay tro xuong (vd chua len 8 thi bo tuong 5 vang)
   *  required  : ten cac tuong bat buoc phai co (carry ban dang cam)
   *  exclude   : ten cac tuong khong muon dung
   *  beamWidth : giu lai bao nhieu nhanh tot nhat moi buoc (cang lon cang ky, cham hon)
   */
  function optimizeComp(dataset, options) {
    var opts = options || {};
    var size = Math.max(1, Math.min(10, opts.size || 8));
    var beamWidth = opts.beamWidth || 24;

    var pool = (dataset.champions || []).filter(function (c) {
      if (opts.maxCost && c.cost > opts.maxCost) return false;
      if (opts.exclude && opts.exclude.indexOf(c.name) >= 0) return false;
      return true;
    });
    if (!pool.length) return { units: [], score: 0, traits: { active: [], inactive: [], all: [] } };

    var required = (opts.required || []).map(function (name) {
      return pool.find(function (c) { return c.name.toLowerCase() === String(name).toLowerCase(); });
    }).filter(Boolean);

    var beams = [required.slice(0, size)];
    var seen = {};

    while (beams[0].length < size) {
      var nextBeams = [];
      beams.forEach(function (beam) {
        var have = {};
        beam.forEach(function (u) { have[unitKey(u)] = true; });
        pool.forEach(function (champ) {
          if (have[unitKey(champ)]) return;
          var candidate = beam.concat([champ]);
          var key = candidate.map(unitKey).sort().join('|');
          if (seen[key]) return;
          seen[key] = true;
          nextBeams.push({ units: candidate, score: traitBreakdown(candidate, dataset, opts).score });
        });
      });
      if (!nextBeams.length) break;
      nextBeams.sort(function (a, b) { return b.score - a.score; });
      beams = nextBeams.slice(0, beamWidth).map(function (b) { return b.units; });
    }

    var best = beams[0] || [];
    var breakdown = traitBreakdown(best, dataset, opts);
    return {
      units: best.map(function (c) { return { name: c.name, cost: c.cost, traits: c.traits }; }),
      score: breakdown.score,
      traits: breakdown,
      totalCost: best.reduce(function (sum, c) { return sum + (c.cost || 0); }, 0)
    };
  }

  // ------------------------------------------------------- nen chuyen doi hinh nao

  /**
   * Dang cam nhung tuong nay thi chuyen sang doi hinh nao la re nhat?
   *
   * Voi tung doi hinh trong thu vien: dem tuong da co, uoc luong so vang con phai
   * bo ra de gom du tuong con thieu (theo ti le roll o cap hien tai va do sau kho tuong),
   * roi xep hang theo diem toc he chia cho chi phi. Doi hinh manh ma dang do sang
   * mot nua se dung tren doi hinh manh hon nhung phai lam lai tu dau.
   */
  function pivotSuggestions(currentUnits, comps, dataset, options) {
    var opts = options || {};
    var level = opts.level || 8;
    var owned = {};
    (currentUnits || []).forEach(function (u) { owned[String(u.name || '').toLowerCase()] = u; });

    var champByName = {};
    (dataset.champions || []).forEach(function (c) { champByName[c.name.toLowerCase()] = c; });

    return (comps || []).map(function (comp) {
      var units = comp.units || [];
      var have = [];
      var missing = [];

      units.forEach(function (unit) {
        var key = String(unit.name || '').toLowerCase();
        if (owned[key]) have.push(unit.name);
        else missing.push(unit);
      });

      var goldNeeded = 0;
      var unreachable = false;
      missing.forEach(function (unit) {
        var champ = champByName[String(unit.name || '').toLowerCase()];
        var cost = (champ && champ.cost) || unit.cost || 1;
        var copies = COPIES_FOR_STAR[unit.star || 2] || 3;
        var one = calc.rollOutcome({
          level: level, cost: cost, rolls: 1, copiesNeeded: 1,
          copiesOwnedByYou: 0, copiesTakenByOthers: opts.copiesTakenByOthers || 0
        }).expectedGoldForOne;
        if (!isFinite(one)) { unreachable = true; return; }
        goldNeeded += one * copies;
      });

      var breakdown = traitBreakdown(units, dataset, opts);
      var estGold = unreachable ? Infinity : Math.round(goldNeeded);
      var ratio = units.length ? have.length / units.length : 0;

      return {
        id: comp.id,
        name: comp.name,
        tier: comp.tier || '',
        have: have,
        missing: missing.map(function (u) { return u.name; }),
        overlap: Math.round(ratio * 100),
        estGold: estGold,
        traitScore: breakdown.score,
        activeTraits: breakdown.active.map(function (t) { return t.name + ' ' + t.activeAt; }),
        // Diem xep hang: doi hinh manh, dang co san nhieu tuong, con it vang phai bo ra
        rank: Math.round((breakdown.score * (0.4 + 0.6 * ratio)) / (1 + (isFinite(estGold) ? estGold : 999) / 120) * 100) / 100
      };
    }).sort(function (a, b) { return b.rank - a.rank; }).slice(0, opts.limit || 5);
  }

  // ------------------------------------------------------------------- utils

  function indexTraits(dataset) {
    var out = {};
    (dataset.traits || []).forEach(function (t) {
      var points = (t.breakpoints || []).slice().sort(function (a, b) { return a - b; });
      out[t.name] = points.filter(function (p, i, arr) { return p > 0 && arr.indexOf(p) === i; });
    });
    return out;
  }

  /** Doi hinh khong tinh trung tuong; tuong nhap tay thi tra cuu toc he theo ten. */
  function dedupeUnits(units, dataset) {
    var byName = {};
    (dataset.champions || []).forEach(function (c) { byName[c.name.toLowerCase()] = c; });
    var seen = {};
    var out = [];
    (units || []).forEach(function (unit) {
      var known = unit.traits && unit.traits.length ? unit : byName[String(unit.name || '').toLowerCase()];
      if (!known) return;
      var key = unitKey(known);
      if (seen[key]) return;
      seen[key] = true;
      out.push({ name: known.name, cost: known.cost || unit.cost || 1, traits: known.traits || [] });
    });
    return out;
  }

  function unitKey(unit) {
    return String(unit.apiName || unit.name || '').toLowerCase();
  }

  var api = {
    DEFAULT_WEIGHTS: DEFAULT_WEIGHTS,
    traitBreakdown: traitBreakdown,
    suggestNextUnit: suggestNextUnit,
    optimizeComp: optimizeComp,
    pivotSuggestions: pivotSuggestions,
    COPIES_FOR_STAR: COPIES_FOR_STAR
  };

  global.TFT = global.TFT || {};
  global.TFT.analyzer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
