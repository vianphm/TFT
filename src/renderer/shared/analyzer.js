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
    nearBonus: 1.5,    // thuong nho khi chi con thieu 1 tuong la len moc (de mo rong tiep)
    wantedMultiplier: 3 // nhan diem cho toc he nguoi choi chi dinh muon choi (opts.wantTraits)
  };

  // ------------------------------------------------- cham diem nhanh (dung trong vong lap)

  /**
   * Bang tra cuu dung lai duoc cho mot bo du lieu set.
   * Beam search goi ham cham diem hang chuc nghin lan, nen khong the dung lai
   * bang tra cuu moi lan goi nhu traitBreakdown lam.
   */
  var prepCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  function prepare(dataset) {
    if (prepCache && prepCache.has(dataset)) return prepCache.get(dataset);
    var breakpoints = {};
    (dataset.traits || []).forEach(function (t) {
      breakpoints[t.name] = (t.breakpoints || [])
        .filter(function (b) { return b > 0; })
        .sort(function (a, b) { return a - b; });
    });
    var prep = { breakpoints: breakpoints };
    if (prepCache) prepCache.set(dataset, prep);
    return prep;
  }

  /**
   * Cham diem mot nhom tuong ma khong dung mang trung gian nao.
   * Cung cong thuc voi scoreRows, chi khac la lam thang tren bien dem.
   */
  function scoreUnits(units, prep, weights, wantedMap) {
    var w = weights;
    var counts = Object.create(null);
    var i, j, traits;

    for (i = 0; i < units.length; i++) {
      traits = units[i].traits;
      if (!traits) continue;
      for (j = 0; j < traits.length; j++) {
        counts[traits[j]] = (counts[traits[j]] || 0) + 1;
      }
    }

    var score = 0;
    var activeTraits = Object.create(null);

    for (var name in counts) {
      var points = prep.breakpoints[name];
      var count = counts[name];
      var tier = 0;
      if (points) {
        for (var k = 0; k < points.length; k++) {
          if (count >= points[k]) tier = k + 1;
        }
      }
      var wanted = wantedMap && wantedMap[name.toLowerCase()] ? w.wantedMultiplier : 1;
      if (tier > 0) {
        score += wanted * w.tierBase * Math.pow(w.tierGrowth, tier - 1);
        activeTraits[name] = true;
      } else if (points && points.length) {
        var next = 0;
        for (var m = 0; m < points.length; m++) {
          if (points[m] > count) { next = points[m]; break; }
        }
        if (next - count === 1) score += w.nearBonus * wanted;
      }
    }

    for (i = 0; i < units.length; i++) {
      var contributes = false;
      traits = units[i].traits || [];
      for (j = 0; j < traits.length; j++) {
        if (activeTraits[traits[j]]) { contributes = true; break; }
      }
      if (!contributes) score -= w.wastePenalty;
      score -= (units[i].cost || 1) * w.costPenalty;
    }

    return score;
  }

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
      score: scoreRows(rows, dedupeUnits(units, dataset), opts.weights, opts.wantTraits)
    };
  }

  function scoreRows(rows, units, weights, wanted) {
    var w = Object.assign({}, DEFAULT_WEIGHTS, weights || {});
    var want = {};
    (wanted || []).forEach(function (name) { want[String(name).toLowerCase()] = true; });
    var score = 0;
    var contributing = {};

    rows.forEach(function (row) {
      if (row.tier > 0) {
        var bonus = want[row.name.toLowerCase()] ? w.wantedMultiplier : 1;
        score += bonus * w.tierBase * Math.pow(w.tierGrowth, row.tier - 1);
        units.forEach(function (u) {
          if ((u.traits || []).indexOf(row.name) >= 0) contributing[unitKey(u)] = true;
        });
      } else if (row.missing === 1) {
        score += w.nearBonus * (want[row.name.toLowerCase()] ? w.wantedMultiplier : 1);
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
    // Do duoc: beam cang rong ket qua cang tot (96 dat diem cao nhat o moi bo du lieu thu),
    // va sau khi toi uu ham cham diem thi 96 chi ton khoang 200ms nen de mac dinh luon.
    var beamWidth = opts.beamWidth || 96;

    var pool = (dataset.champions || []).filter(function (c) {
      if (opts.maxCost && c.cost > opts.maxCost) return false;
      if (opts.exclude && opts.exclude.indexOf(c.name) >= 0) return false;
      return true;
    });
    if (!pool.length) return { units: [], score: 0, traits: { active: [], inactive: [], all: [] } };

    var required = (opts.required || []).map(function (name) {
      return pool.find(function (c) { return c.name.toLowerCase() === String(name).toLowerCase(); });
    }).filter(Boolean);

    var prep = prepare(dataset);
    var weights = Object.assign({}, DEFAULT_WEIGHTS, opts.weights || {});
    var wantedMap = null;
    if (opts.wantTraits && opts.wantTraits.length) {
      wantedMap = {};
      opts.wantTraits.forEach(function (n) { wantedMap[String(n).toLowerCase()] = true; });
    }

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
          nextBeams.push({ units: candidate, score: scoreUnits(candidate, prep, weights, wantedMap) });
        });
      });
      if (!nextBeams.length) break;
      nextBeams.sort(function (a, b) { return b.score - a.score; });
      beams = nextBeams.slice(0, beamWidth).map(function (b) { return b.units; });
    }

    var best = beams[0] || [];

    // Beam search de bo sot: no chi giu vai nhanh tot nhat o moi buoc, nen ket qua
    // cuoi cung thuong con cai thien duoc bang cach thu doi tung tuong mot.
    best = localSearch(best, pool, dataset, opts, prep, weights, wantedMap);

    var breakdown = traitBreakdown(best, dataset, opts);
    return {
      units: best.map(function (c) { return { name: c.name, cost: c.cost, traits: c.traits }; }),
      score: breakdown.score,
      traits: breakdown,
      totalCost: best.reduce(function (sum, c) { return sum + (c.cost || 0); }, 0)
    };
  }

  /**
   * Doi tung tuong trong doi hinh lay tuong khac trong kho, giu lai neu diem tang.
   * Lap den khi khong con cai thien duoc (hoac het so vong cho phep).
   */
  function localSearch(units, pool, dataset, options, prep, weights, wantedMap) {
    var opts = options || {};
    prep = prep || prepare(dataset);
    weights = weights || Object.assign({}, DEFAULT_WEIGHTS, opts.weights || {});
    var required = (opts.required || []).map(function (n) { return String(n).toLowerCase(); });
    var current = units.slice();
    var currentScore = scoreUnits(current, prep, weights, wantedMap);
    var rounds = opts.localSearchRounds || 4;

    for (var round = 0; round < rounds; round++) {
      var improved = false;

      for (var i = 0; i < current.length; i++) {
        if (required.indexOf(String(current[i].name).toLowerCase()) >= 0) continue; // tuong bat buoc thi giu

        var bestSwap = null;
        var bestScore = currentScore;

        for (var j = 0; j < pool.length; j++) {
          var candidate = pool[j];
          if (current.some(function (u) { return unitKey(u) === unitKey(candidate); })) continue;

          var trial = current.slice();
          trial[i] = candidate;
          var score = scoreUnits(trial, prep, weights, wantedMap);
          if (score > bestScore + 1e-9) {
            bestScore = score;
            bestSwap = trial;
          }
        }

        if (bestSwap) {
          current = bestSwap;
          currentScore = bestScore;
          improved = true;
        }
      }

      if (!improved) break;
    }

    return current;
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
      var winRate = parseFloat(String(comp.winRate || '').replace(',', '.')) || 0;
      var top4 = parseFloat(String(comp.top4 || '').replace(',', '.')) || 0;
      var tierBonus = ({ S: 12, A: 6, B: 2 })[String(comp.tier || '').toUpperCase()] || 0;
      // Meta chi la mot phan cua diem: doi hinh co thong ke cao van phai phu hop
      // voi ban co, vang va cap hien tai cua nguoi choi.
      var metaScore = Math.round((winRate * 0.35 + top4 * 0.65 + tierBonus) * 100) / 100;
      var transitionScore = (breakdown.score * (0.4 + 0.6 * ratio)) /
        (1 + (isFinite(estGold) ? estGold : 999) / 120);

      return {
        id: comp.id,
        name: comp.name,
        tier: comp.tier || '',
        have: have,
        missing: missing.map(function (u) { return u.name; }),
        overlap: Math.round(ratio * 100),
        estGold: estGold,
        traitScore: breakdown.score,
        winRate: winRate,
        top4: top4,
        metaScore: metaScore,
        activeTraits: breakdown.active.map(function (t) { return t.name + ' ' + t.activeAt; }),
        // Ket hop suc manh/chuyen doi trong tran voi thong ke meta cua ban cap nhat.
        rank: Math.round((transitionScore + metaScore * 0.25) * 100) / 100
      };
    }).sort(function (a, b) { return b.rank - a.rank; }).slice(0, opts.limit || 5);
  }

  // ---------------------------------------------------- goi y an theo tran hien tai

  /**
   * Xep hang an theo doi hinh dang co va linh kien trong tui.
   * Khong chi dem "con thieu 1 moc": moi phuong an duoc cham lai bang cung ham
   * traitBreakdown cua bo toi uu doi hinh, nen an day len moc cao se duoc uu tien.
   */
  function recommendEmblems(state, dataset, options) {
    var opts = options || {};
    var rawUnits = (state && state.units) || [];
    var byName = {};
    (dataset.champions || []).forEach(function (champ) { byName[champ.name.toLowerCase()] = champ; });
    var units = rawUnits.map(function (unit) {
      var known = byName[String(unit.name || '').toLowerCase()] || unit;
      return Object.assign({}, known, unit, { traits: (known.traits || unit.traits || []).slice() });
    }).filter(function (unit) { return unit.name; });
    var base = traitBreakdown(units, dataset, opts);
    var inventory = componentCounts((state && state.components) || []);
    var traitDefs = indexTraits(dataset);

    return (dataset.emblems || []).filter(function (emblem) {
      return emblem && emblem.trait;
    }).map(function (emblem) {
      var recipe = (emblem.composition || []).map(componentId).filter(Boolean);
      var recipeState = recipeAvailability(recipe, inventory);
      var holders = units.filter(function (unit) {
        return unit.traits.indexOf(emblem.trait) < 0 && (!unit.items || unit.items.length < 3);
      }).sort(function (a, b) {
        return (a.carry ? 1 : 0) - (b.carry ? 1 : 0) ||
          ((a.items || []).length - (b.items || []).length) ||
          (b.cost || 1) - (a.cost || 1);
      });
      var holder = holders[0] || null;
      var gain = 0;
      var after = base;
      if (holder) {
        var simulated = units.map(function (unit) {
          if (unit !== holder) return unit;
          return Object.assign({}, unit, { traits: unit.traits.concat([emblem.trait]) });
        });
        after = traitBreakdown(simulated, dataset, opts);
        gain = Math.round((after.score - base.score) * 100) / 100;
      }
      var beforeRow = base.all.find(function (row) { return row.name === emblem.trait; });
      var afterRow = after.all.find(function (row) { return row.name === emblem.trait; });
      var candidates = (dataset.champions || []).filter(function (champ) {
        return (champ.traits || []).indexOf(emblem.trait) >= 0 &&
          !units.some(function (unit) { return unit.name === champ.name; });
      }).sort(function (a, b) { return a.cost - b.cost || a.name.localeCompare(b.name); }).slice(0, 4);
      return {
        name: emblem.name,
        trait: emblem.trait,
        icon: emblem.icon || null,
        recipe: recipe,
        craftable: recipe.length === 2 && recipeState.missing.length === 0,
        missingComponents: recipeState.missing,
        holder: holder ? holder.name : null,
        scoreGain: gain,
        before: beforeRow ? beforeRow.count : 0,
        after: afterRow ? afterRow.count : (beforeRow ? beforeRow.count : 0),
        unlocks: afterRow && (!beforeRow || afterRow.tier > beforeRow.tier)
          ? emblem.trait + ' ' + afterRow.activeAt : null,
        nextUnits: candidates.map(function (champ) { return { name: champ.name, cost: champ.cost }; }),
        rank: Math.round((gain * 10 + (recipeState.missing.length === 0 ? 5 : 0) - recipeState.missing.length) * 100) / 100
      };
    }).sort(function (a, b) {
      return b.rank - a.rank || b.scoreGain - a.scoreGain || a.name.localeCompare(b.name);
    }).slice(0, opts.limit || 10);
  }

  /** Mot lan goi cho UI: suc manh hien tai, doi hinh tran, tuong tiep theo va an. */
  function optimizeForState(state, dataset, options) {
    var opts = options || {};
    var currentUnits = (state && state.units) || [];
    var level = Math.max(1, Math.min(10, Number(state && state.level) || 8));
    var required = currentUnits.filter(function (u) { return u.locked || u.carry; })
      .map(function (u) { return u.name; });
    var ownedEmblemTraits = ((state && state.emblems) || []).map(function (emblem) {
      return typeof emblem === 'string' ? emblem : emblem.trait;
    }).filter(Boolean);
    var maxCost = opts.maxCost || (level <= 5 ? 3 : level <= 7 ? 4 : 5);
    var strongest = optimizeComp(dataset, {
      size: level,
      maxCost: maxCost,
      required: required,
      exclude: opts.exclude || [],
      wantTraits: ownedEmblemTraits,
      weights: opts.weights,
      beamWidth: opts.beamWidth
    });
    return {
      current: traitBreakdown(currentUnits, dataset, opts),
      strongest: strongest,
      nextUnits: suggestNextUnit(currentUnits, dataset, {
        maxCost: maxCost,
        wantTraits: ownedEmblemTraits,
        limit: opts.unitLimit || 8
      }),
      emblems: recommendEmblems(state || {}, dataset, { limit: opts.emblemLimit || 10 }),
      assumptions: { level: level, maxCost: maxCost, required: required }
    };
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
    // Cac dang Lux mua 18 la lua chon cua cung mot tuong trong shop, khong phai
    // nhieu slot doc lap. variantGroup ngan bo toi uu chon hai dang Lux cung luc.
    return String(unit.variantGroup || unit.apiName || unit.name || '').toLowerCase();
  }

  function componentId(value) {
    var text = String(value || '').toLowerCase();
    if (text === 'bf' || /bfsword/.test(text)) return 'bf';
    if (text === 'bow' || /recurvebow/.test(text)) return 'bow';
    if (text === 'rod' || /needlesslylargerod/.test(text)) return 'rod';
    if (text === 'tear' || /tearofthegoddess/.test(text)) return 'tear';
    if (text === 'vest' || /chainvest/.test(text)) return 'vest';
    if (text === 'cloak' || /negatroncloak/.test(text)) return 'cloak';
    if (text === 'belt' || /giantsbelt/.test(text)) return 'belt';
    if (text === 'glove' || /sparringgloves/.test(text)) return 'glove';
    if (text === 'spat' || /spatula/.test(text)) return 'spat';
    if (text === 'pan' || /fryingpan/.test(text)) return 'pan';
    return null;
  }

  function componentCounts(parts) {
    var out = {};
    (parts || []).map(componentId).filter(Boolean).forEach(function (id) { out[id] = (out[id] || 0) + 1; });
    return out;
  }

  function recipeAvailability(recipe, inventory) {
    var used = {};
    var missing = [];
    (recipe || []).forEach(function (id) {
      used[id] = (used[id] || 0) + 1;
      if (used[id] > (inventory[id] || 0)) missing.push(id);
    });
    return { missing: missing };
  }

  // ------------------------------------------------------------- danh gia / xep hang Augment

  /**
   * Xep hang va dua ra ly do lua chon cho danh sach loi (Augments).
   * augments: danh sach loi can danh gia [{name, desc, tier, tags, associatedTraits, ...}]
   * state: { board: [...], bench: [...], stage: '2-1'|'3-2'|'4-2', hp: 100, gold: 50, level: 7, items: [...], streak: 0 }
   * dataset: bo du lieu set (champions, traits, augments)
   */
  function rankAugments(augments, state, dataset, options) {
    var opts = options || {};
    var st = state || {};
    var currentUnits = (st.board || st.units || []);
    var hp = typeof st.hp === 'number' ? st.hp : 100;
    var gold = typeof st.gold === 'number' ? st.gold : 50;
    var stage = String(st.stage || '2-1');
    var items = (st.items || st.inventory || []);

    var breakdown = dataset ? traitBreakdown(currentUnits, dataset) : { active: [], inactive: [] };
    var activeTraitNames = (breakdown.active || []).map(function (t) { return t.name.toLowerCase(); });
    var inactiveTraitNames = (breakdown.inactive || []).map(function (t) { return t.name.toLowerCase(); });

    var results = (augments || []).map(function (aug) {
      if (!aug) return null;
      var score = 50;
      var reasons = [];
      var tags = aug.tags || [];
      var tier = aug.tier || 'gold';
      var text = (String(aug.name || '') + ' ' + String(aug.desc || '')).toLowerCase();

      // 1. Giai doan tran dau (Stage)
      if (stage.indexOf('2-') === 0) {
        if (tags.indexOf('econ') >= 0 || tags.indexOf('xp') >= 0) {
          score += 25;
          reasons.push('Đầu trận (2-1) chọn lõi kinh tế/kinh nghiệm giúp tích luỹ lợi tức và lên cấp sớm');
        }
        if (tags.indexOf('reroll') >= 0) {
          score += 15;
          reasons.push('Phù hợp nếu định hướng chơi bài reroll tướng 1-2 vàng');
        }
      } else if (stage.indexOf('3-') === 0) {
        if (tags.indexOf('emblem') >= 0) {
          score += 20;
          reasons.push('Giữa trận (3-2) lấy Ấn/Mốc tộc hệ giúp định hình khung bài vững chắc');
        }
        if (tags.indexOf('combat') >= 0) {
          score += 15;
          reasons.push('Tăng cường sức mạnh giao tranh giữ máu giữa trận');
        }
      } else if (stage.indexOf('4-') === 0 || stage.indexOf('5-') === 0) {
        if (tags.indexOf('combat') >= 0) {
          score += 30;
          reasons.push('Cuối trận (4-2+) ưu tiên tối đa chỉ số giao tranh để tranh top');
        }
        if (tags.indexOf('items') >= 0) {
          score += 20;
          reasons.push('Bổ sung trang bị hoàn chỉnh cho các chủ lực cuối trận');
        }
        if (tags.indexOf('econ') >= 0 && hp < 50) {
          score -= 25;
          reasons.push('Máu thấp ở cuối trận không nên chọn lõi kinh tế chậm');
        }
      }

      // 2. Máu và Vàng hiện tại
      if (hp <= 40) {
        if (tags.indexOf('combat') >= 0 || tags.indexOf('items') >= 0) {
          score += 25;
          reasons.push('Máu đang ở ngưỡng nguy hiểm (<40), cần sức mạnh tức thì để tránh bị loại');
        }
        if (tags.indexOf('econ') >= 0 && text.indexOf('gain') < 0 && text.indexOf('nhận ngay') < 0) {
          score -= 30;
          reasons.push('Máu quá thấp, không đủ thời gian phát huy lõi tăng trưởng kinh tế');
        }
      } else if (hp >= 80) {
        if (tags.indexOf('econ') >= 0 || tags.indexOf('xp') >= 0) {
          score += 15;
          reasons.push('Máu dồi dào (>80), an toàn để đánh chuỗi hoặc tích luỹ kinh tế mạnh mẽ');
        }
      }

      if (gold < 15 && tags.indexOf('econ') >= 0) {
        score += 15;
        reasons.push('Kinh tế đang thiếu hụt, lõi hỗ trợ hồi phục tài chính');
      }

      // 3. Tương thích Tộc/Hệ (Trait synergy)
      var assocTraits = (aug.associatedTraits || []).map(function (t) { return String(t).toLowerCase(); });
      var traitMatch = false;
      assocTraits.forEach(function (t) {
        if (activeTraitNames.indexOf(t) >= 0) {
          score += 35;
          traitMatch = true;
          reasons.push('Kích hoạt và bổ trợ trực tiếp cho tộc hệ đang chơi (' + t + ')');
        } else if (inactiveTraitNames.indexOf(t) >= 0) {
          score += 15;
          traitMatch = true;
          reasons.push('Có thể kích hoạt thêm mốc cho tộc hệ dự bị (' + t + ')');
        }
      });

      if (tags.indexOf('emblem') >= 0 && !traitMatch && assocTraits.length > 0) {
        score -= 30;
        reasons.push('Ấn tộc hệ không khớp với bất kỳ tướng nào trên sân');
      }

      // 4. Nhãn khuyên dùng
      var recommendation = 'situational';
      if (score >= 80) recommendation = 'must_pick';
      else if (score >= 65) recommendation = 'recommended';
      else if (score < 40) recommendation = 'avoid';

      return {
        augment: aug,
        score: Math.max(0, Math.min(100, Math.round(score))),
        tier: tier,
        tags: tags,
        recommendation: recommendation,
        reason: reasons.join('. ') || 'Lõi cân bằng chỉ số tổng thể.'
      };
    }).filter(Boolean);

    results.sort(function (a, b) { return b.score - a.score; });
    return results;
  }

  /**
   * Goi y khung bai giu mau dau game (Stage 2 - 3) tu tuong 1-2 vang, sao va do roi.
   */
  function suggestEarlyGameComps(board, bench, components, dataset, options) {
    var opts = options || {};
    var allUnits = (board || []).concat(bench || []);
    var pool = (dataset && dataset.champions) || [];

    // Tim cac tuong 1-2 vang da co 2 sao hoac dang cam
    var star2Units = allUnits.filter(function (u) { return (u.star || 1) >= 2; });
    var lowCostUnits = allUnits.filter(function (u) {
      var champ = pool.find(function (c) { return c.name.toLowerCase() === u.name.toLowerCase(); });
      return champ ? champ.cost <= 2 : (u.cost || 1) <= 2;
    });

    // Do co the slam ngay
    var calcApi = (global.TFT && global.TFT.calc) || (typeof require !== 'undefined' ? require('./calc.js') : null);
    var craftableList = calcApi && calcApi.craftable ? calcApi.craftable(components || []) : [];
    var slammable = craftableList.filter(function (c) {
      return ['Sunfire Cape', "Warmog's Armor", 'Gargoyle Stoneplate', 'Infinity Edge', 'Blue Buff', "Guinsoo's Rageblade", 'Statikk Shiv', 'Ionic Spark'].indexOf(c.item) >= 0;
    });

    // Danh gia suc manh dau tran (Board strength)
    var boardStrength = 0;
    boardStrength += star2Units.length * 25;
    boardStrength += (board || []).length * 10;
    boardStrength += slammable.length * 15;

    var strategy = {
      type: boardStrength >= 45 ? 'win_streak' : 'loss_streak',
      title: boardStrength >= 45 ? 'Đánh Chuỗi Thắng (Giữ máu)' : 'Đánh Chuỗi Thua (Tích tiền & Chợ)',
      levelAdvice: boardStrength >= 45
        ? 'Lên cấp 4 ở 2-1 (hoặc 2-2) và lên cấp 5 ở 2-5 để giữ chuỗi thắng, ghép đồ ngay.'
        : 'Không up cấp sớm, giữ mốc 10-20 vàng sớm nhất, ưu tiên nhặt mảnh đồ chuẩn ở vòng chợ 2-4.',
      itemAdvice: slammable.length
        ? 'Có thể ghép ngay: ' + slammable.map(function (s) { return s.item; }).join(', ') + ' để tối ưu sức mạnh.'
        : 'Chưa có đồ ghép tối ưu, nên chờ thêm mảnh ở quái đá hoặc vòng chọn chung.'
    };

    // Khung bài đầu game gợi ý (2-3 archetypes)
    var earlyArchetypes = [
      {
        name: 'Vệ Quân + Xạ Thủ (AD/Tank)',
        coreUnits: ['Leona', 'Shen', 'Tristana', 'Cassiopeia'],
        synergies: '2 Vệ Quân (Tuyến trước trâu) + 2 Xạ Thủ / Thợ Săn (Sát thương tầm xa)',
        targetLategame: 'Chuyển sang Cassiopeia Vệ Quân hoặc Tristana Tiên Linh'
      },
      {
        name: 'Đấu Sĩ + Thuật Sư (AP/Tank)',
        coreUnits: ['Kobuko', 'Rakan', 'Ahri', 'Veigar'],
        synergies: '2 Đấu Sĩ (Tăng máu diện rộng) + 2 Thuật Sư / Pháp Sư (Sát thương phép)',
        targetLategame: 'Chuyển sang Veigar Tinh Nghịch hoặc Soraka Tiên Linh'
      },
      {
        name: 'Tiên Linh / Thần Rừng Giữ Máu',
        coreUnits: ['Rakan', 'Kobuko', 'Lillia', 'Rengar'],
        synergies: '3 Tiên Linh / Thần Rừng kích hoạt mốc chỉ số sớm',
        targetLategame: 'Chuyển sang Rengar Tiên Linh hoặc Lillia Quái Thú'
      }
    ];

    // Chấm điểm độ phù hợp của từng khung bài với bài hiện có
    var haveNames = allUnits.map(function (u) { return u.name.toLowerCase(); });
    var scoredArchetypes = earlyArchetypes.map(function (arch) {
      var matchCount = 0;
      arch.coreUnits.forEach(function (name) {
        if (haveNames.indexOf(name.toLowerCase()) >= 0) matchCount++;
      });
      return {
        name: arch.name,
        matchCount: matchCount,
        coreUnits: arch.coreUnits,
        synergies: arch.synergies,
        targetLategame: arch.targetLategame,
        score: Math.round((matchCount / arch.coreUnits.length) * 100)
      };
    }).sort(function (a, b) { return b.score - a.score; });

    return {
      strategy: strategy,
      boardStrength: Math.min(100, boardStrength),
      star2Count: star2Units.length,
      slammableItems: slammable,
      suggestedArchetypes: scoredArchetypes
    };
  }

  /**
   * Xep hang va danh gia Wisp / Linh Hon theo vong dau, mau va kinh te.
   */
  function rankWisps(wisps, state, options) {
    var s = state || {};
    var hp = s.hp !== undefined ? Number(s.hp) : 100;
    var gold = s.gold !== undefined ? Number(s.gold) : 50;
    var stage = String(s.stage || '3-2');

    var list = (wisps || []).map(function (wisp) {
      if (!wisp) return null;
      var score = 50;
      var reasons = [];
      var cat = wisp.category || 'misc';

      // 1. Gia va chi phi
      if (wisp.cost === 0) {
        score += 20;
        reasons.push('Linh hồn miễn phí (0 vàng)');
      } else if (wisp.cost > gold) {
        score -= 40;
        reasons.push('Không đủ vàng để mua');
      }

      // 2. Tinh trang mau
      if (hp <= 35) {
        if (cat === 'combat') {
          score += 30;
          reasons.push('Máu thấp, cần sức mạnh giao tranh ngay lập tức');
        }
        if (wisp.id === 'sinister-deal') {
          score -= 50;
          reasons.push('Máu quá thấp (<35), mua giao kèo mất máu cực kỳ nguy hiểm');
        }
        if (wisp.id === 'life-debt') {
          score += 25;
          reasons.push('Máu đã mất nhiều, nhận lượng vàng bù đắp lớn');
        }
      } else if (hp >= 80) {
        if (cat === 'econ' || cat === 'shop') {
          score += 15;
          reasons.push('Máu an toàn (>80), tối ưu để gia tăng kinh tế hoặc đổi tướng');
        }
      }

      // 3. Giai doan tran dau
      if (stage.indexOf('2-') === 0) {
        if (wisp.id === 'all-ones' || wisp.id === 'minor-polymorph' || wisp.id === 'experienced') {
          score += 25;
          reasons.push('Rất mạnh ở giai đoạn đầu trận (Stage 2)');
        }
      } else if (stage.indexOf('4-') === 0 || stage.indexOf('5-') === 0) {
        if (wisp.id === 'major-polymorph' || wisp.id === 'salvager' || wisp.id === 'prolific-power') {
          score += 25;
          reasons.push('Rất giá trị ở giai đoạn giữa - cuối trận');
        }
      }

      var recommendation = 'situational';
      if (score >= 80) recommendation = 'must_buy';
      else if (score >= 65) recommendation = 'recommended';
      else if (score < 40) recommendation = 'skip';

      return {
        wisp: wisp,
        score: Math.max(0, Math.min(100, Math.round(score))),
        recommendation: recommendation,
        reason: reasons.join('. ') || 'Linh hồn hỗ trợ tình huống.'
      };
    }).filter(Boolean);

    list.sort(function (a, b) { return b.score - a.score; });
    return list;
  }

  /**
   * Bo khuyen nghi tong hop realtime: tich hop toan bo trang thai tran dau
   * (doi hinh, shop, do, loi, wisp, kinh te, vi tri).
   */
  function generateComprehensiveAdvice(gameState, dataset, compsLib, options) {
    var state = gameState || {};
    var comps = compsLib || [];
    var board = state.board || [];
    var bench = state.bench || [];
    var allUnits = board.concat(bench);
    var components = state.components || [];
    var level = Number(state.level || 7);
    var gold = Number(state.gold || 50);
    var hp = Number(state.hp || 100);
    var round = String(state.round || '3-2');
    var calcApi = (global.TFT && global.TFT.calc) || (typeof require !== 'undefined' ? require('./calc.js') : null);

    // 1. Doi hinh muc tieu & phuong an du phong
    var pivots = pivotSuggestions(allUnits, comps, dataset, { level: level });
    var compById = {};
    comps.forEach(function (c) { compById[c.id] = c; });
    var targetComp = pivots[0] ? compById[pivots[0].id] : (comps[0] || null);
    var backupComps = pivots.slice(1, 3).map(function (p) { return compById[p.id]; }).filter(Boolean);

    // 2. Goi y mua/ban tu cua hang hien tai
    var shopAdvice = [];
    if (state.shop && state.shop.length && targetComp) {
      var targetUnitNames = (targetComp.units || []).map(function (u) { return u.name.toLowerCase(); });
      var backupUnitNames = backupComps.reduce(function (acc, c) {
        return acc.concat((c.units || []).map(function (u) { return u.name.toLowerCase(); }));
      }, []);

      shopAdvice = state.shop.map(function (champName) {
        if (!champName) return null;
        var nameLower = String(champName).toLowerCase();
        var copiesOnBoard = allUnits.filter(function (u) { return u.name.toLowerCase() === nameLower; }).length;

        if (targetUnitNames.indexOf(nameLower) >= 0) {
          return {
            name: champName,
            action: 'buy',
            priority: copiesOnBoard === 2 ? 'must_buy' : 'recommended',
            reason: copiesOnBoard === 2 ? 'Mua ngay để nâng lên 2 sao cho đội hình chính!' : 'Tướng thuộc khung bài chính (' + targetComp.name + ')'
          };
        } else if (copiesOnBoard === 2) {
          return {
            name: champName,
            action: 'buy',
            priority: 'recommended',
            reason: 'Đang có 2 bản sao trên sân/hàng chờ, mua để lên 2 sao giữ máu'
          };
        } else if (backupUnitNames.indexOf(nameLower) >= 0) {
          return {
            name: champName,
            action: 'hold',
            priority: 'situational',
            reason: 'Tướng thuộc phương án dự phòng'
          };
        } else {
          return {
            name: champName,
            action: 'skip',
            priority: 'skip',
            reason: 'Không thuộc khung bài đang chơi'
          };
        }
      }).filter(Boolean);
    }

    // 3. Toi uu trang bi tu linh kien
    var itemAdvice = null;
    if (calcApi && calcApi.suggestCompsFromComponents && targetComp) {
      var itemPlans = calcApi.suggestCompsFromComponents(components, [targetComp], dataset);
      if (itemPlans && itemPlans.length) {
        itemAdvice = itemPlans[0];
      }
    }

    // 4. Danh gia Loi / Wisp neu dang co lua chon
    var augmentAdvice = [];
    if (state.currentAugmentChoices && state.currentAugmentChoices.length) {
      augmentAdvice = rankAugments(state.currentAugmentChoices, state, dataset);
    }

    var wispAdvice = [];
    if (state.currentWispChoices && state.currentWispChoices.length) {
      wispAdvice = rankWisps(state.currentWispChoices, state);
    }

    // 5. Quyet dinh Kinh te & Roll
    var econDecision = {
      action: gold >= 50 ? 'slow_roll_or_level' : hp <= 35 ? 'roll_now' : 'save_gold',
      message: hp <= 35
        ? 'Máu nguy hiểm (<35): Xả tiền roll nâng cấp 2 sao các tướng chủ lực để giữ mạng.'
        : gold >= 50
        ? 'Kinh tế vững (>50 vàng): Tích lũy lợi tức tối đa, roll chậm hoặc lên cấp theo lộ trình.'
        : 'Tích tiền lên mốc 50 vàng, không roll lẻ tẻ.'
    };

    return {
      targetComp: targetComp,
      pivots: pivots,
      shopAdvice: shopAdvice,
      itemAdvice: itemAdvice,
      augmentAdvice: augmentAdvice,
      wispAdvice: wispAdvice,
      econDecision: econDecision,
      round: round,
      hp: hp,
      gold: gold
    };
  }

  /**
   * Phan tich doi hinh doi thu trong lobby (7 nha con lai):
   * - Tinh do tranh bai cua tung doi hinh meta.
   * - Loc va xep hang cac doi hinh TOP META IT BI TRANH NHAT (Uncontested / Free Comps).
   * - Phan tich xu huong lobby (AP / AD / Tank / Reroll) va dua ra chien luoc khac che + trang bi khuyen dung.
   */
  function analyzeLobbyComps(opponents, compsLib, dataset, playerState) {
    var oppList = opponents || [];
    var comps = compsLib || [];

    // 1. Dem so lan xuat hien cua cac tuong va toc he o cac nha doi thu
    var contestedChampCounts = {};
    var contestedTraitCounts = {};
    var opponentCompNames = [];

    oppList.forEach(function (opp) {
      if (!opp) return;
      if (typeof opp === 'string') {
        var strLower = opp.toLowerCase();
        opponentCompNames.push(strLower);
        contestedChampCounts[strLower] = (contestedChampCounts[strLower] || 0) + 1;
      } else {
        if (opp.compName) opponentCompNames.push(opp.compName.toLowerCase());
        if (opp.carry) {
          var cLower = opp.carry.toLowerCase();
          contestedChampCounts[cLower] = (contestedChampCounts[cLower] || 0) + 1;
        }
        (opp.units || []).forEach(function (u) {
          var uName = (typeof u === 'string' ? u : u.name || '').toLowerCase();
          if (uName) contestedChampCounts[uName] = (contestedChampCounts[uName] || 0) + 1;
        });
        (opp.traits || []).forEach(function (t) {
          var tName = (typeof t === 'string' ? t : t.name || '').toLowerCase();
          if (tName) contestedTraitCounts[tName] = (contestedTraitCounts[tName] || 0) + 1;
        });
      }
    });

    // 2. Tinh do tranh bai cho tung doi hinh meta
    var evaluatedComps = comps.map(function (comp) {
      var compNameLower = (comp.name || '').toLowerCase();
      var directContested = opponentCompNames.filter(function (name) {
        return name.indexOf(compNameLower) >= 0 || compNameLower.indexOf(name) >= 0;
      }).length;

      var carryUnit = (comp.units || []).find(function (u) { return u.carry; });
      var carryContested = carryUnit ? (contestedChampCounts[carryUnit.name.toLowerCase()] || 0) : 0;

      var totalUnitsContested = (comp.units || []).reduce(function (sum, u) {
        return sum + (contestedChampCounts[u.name.toLowerCase()] || 0);
      }, 0);

      var contestedScore = Math.max(directContested * 35, carryContested * 30 + totalUnitsContested * 10);
      var isFree = contestedScore === 0;

      // Diem tier meta co ban (S=100, A=85, B=70, C=50)
      var tierScore = comp.tier === 'S' ? 100 : comp.tier === 'A' ? 85 : comp.tier === 'B' ? 70 : 55;

      // Diem tong hop (Uu tien bài tier cao va IT BI TRANH)
      var lobbyRecommendationScore = Math.max(0, Math.round(tierScore * 0.6 + (100 - Math.min(100, contestedScore)) * 0.4));

      var statusText = isFree ? 'Hoàn toàn trống bài (1 mình 1 chợ)' :
        contestedScore <= 35 ? 'Tranh nhẹ (1 nhà cùng hướng)' :
        'Bị tranh nặng (' + (directContested || carryContested) + ' nhà chơi trùng)';

      return {
        comp: comp,
        tier: comp.tier || 'A',
        isFree: isFree,
        contestedScore: contestedScore,
        statusText: statusText,
        lobbyScore: lobbyRecommendationScore,
        carryName: carryUnit ? carryUnit.name : '',
        directContested: directContested,
        carryContested: carryContested
      };
    });

    evaluatedComps.sort(function (a, b) { return b.lobbyScore - a.lobbyScore; });

    // 3. Phan tich xu huong Lobby & Chien thuat khac che (Anti-Meta Strategy)
    var apCount = 0;
    var adCount = 0;
    var rerollCount = 0;

    evaluatedComps.forEach(function (e) {
      if (e.directContested > 0) {
        var style = (e.comp.style || '').toLowerCase();
        if (style.indexOf('ap') >= 0 || style.indexOf('pháp sư') >= 0 || style.indexOf('magic') >= 0) apCount += e.directContested;
        if (style.indexOf('ad') >= 0 || style.indexOf('xạ thủ') >= 0 || style.indexOf('attack') >= 0) adCount += e.directContested;
        if (style.indexOf('reroll') >= 0 || style.indexOf('3 sao') >= 0) rerollCount += e.directContested;
      }
    });

    var counterAdvice = [];
    var recommendedCounterItems = [];

    if (apCount >= 2) {
      counterAdvice.push('Lobby có nhiều nhà chơi Sát Thương Phép (SMPT): Ưu tiên kẹp tộc hệ Kháng Phép/Bí Ẩn và ghép Vuốt Rồng (Dragon Claw) cho Tank chính.');
      recommendedCounterItems.push("Dragon's Claw", "Ionic Spark");
    }

    if (adCount >= 2) {
      counterAdvice.push('Lobby có nhiều nhà chơi Sát Thương Vật Lý (STVL / Chí mạng): Ưu tiên kẹp Vệ Quân/Hộ Vệ và ghép Giáp Gai (Bramble Vest), Tim Băng.');
      recommendedCounterItems.push("Bramble Vest", "Frozen Heart");
    }

    if (rerollCount >= 3) {
      counterAdvice.push('Lobby có nhiều nhà Slow Roll giữ tiền ở cấp 6/7: Kho tướng 4 và 5 vàng đang rất dồi dào! Chiến lược khuyên dùng là Fast 8 / Fast 9 để giành bài đắt tiền.');
    } else {
      counterAdvice.push('Lobby giữ nhịp độ lên cấp bình thường: Bám sát bài ít trùng để tối ưu tỉ lệ vào Top 4.');
    }

    return {
      topRecommendedComps: evaluatedComps.slice(0, 5),
      freeComps: evaluatedComps.filter(function (e) { return e.isFree && (e.tier === 'S' || e.tier === 'A'); }),
      allEvaluatedComps: evaluatedComps,
      lobbyDominance: { ap: apCount, ad: adCount, reroll: rerollCount },
      counterAdvice: counterAdvice,
      recommendedCounterItems: recommendedCounterItems
    };
  }

  var api = {
    DEFAULT_WEIGHTS: DEFAULT_WEIGHTS,
    traitBreakdown: traitBreakdown,
    suggestNextUnit: suggestNextUnit,
    optimizeComp: optimizeComp,
    scoreUnits: scoreUnits,
    prepare: prepare,
    pivotSuggestions: pivotSuggestions,
    recommendEmblems: recommendEmblems,
    rankAugments: rankAugments,
    suggestEarlyGameComps: suggestEarlyGameComps,
    rankWisps: rankWisps,
    generateComprehensiveAdvice: generateComprehensiveAdvice,
    analyzeLobbyComps: analyzeLobbyComps,
    optimizeForState: optimizeForState,
    COPIES_FOR_STAR: COPIES_FOR_STAR
  };

  global.TFT = global.TFT || {};
  global.TFT.analyzer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
