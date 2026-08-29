/**
 * Toan bo phan tinh toan ho tro: ti le roll, kho tuong, kinh te, XP, ghep do,
 * san tuong theo yeu cau, va ho tro reroll doi hinh da chot.
 * Khong dung DOM -> chay duoc ca trong node de kiem thu.
 */
(function (global) {
  'use strict';

  var T = (global.TFT && global.TFT.tables) || (typeof require !== 'undefined' ? require('./tables.js') : null);

  // Kho tuong dang dung. Mac dinh la bang trong tables.js; khi app doc duoc du lieu
  // set that thi goi setPool() de thay so tuong moi muc gia cho dung set dang choi.
  var POOL = T.POOL;

  function setPool(pool) {
    POOL = pool && pool[1] ? pool : T.POOL;
    return POOL;
  }

  function getPool() {
    return POOL;
  }

  function resetPool() {
    POOL = T.POOL;
    return POOL;
  }

  // ------------------------------------------------------------------ shop

  function shopOdds(level) {
    var row = T.SHOP_ODDS[clampInt(level, 1, 11)] || T.SHOP_ODDS[9];
    return row.map(function (p) { return p / 100; });
  }

  /**
   * Xac suat mot o cua hang ra dung con tuong dang tim.
   *  cost                 : gia tuong (1-5)
   *  level                : cap cua ban
   *  copiesOwnedByYou     : so ban sao ban da mua (da roi khoi kho)
   *  copiesTakenByOthers  : so ban sao nguoi khac dang cam
   *  championsOutOfPool   : so tuong CUNG GIA da bi vet sach (uoc luong), lam nho kho chung
   */
  function slotProbability(opts) {
    var cost = clampInt(opts.cost, 1, 5);
    var pool = POOL[cost];
    var tierOdds = shopOdds(opts.level)[cost - 1];
    if (!tierOdds) return 0;

    var copiesLeft = Math.max(0, pool.copies - num(opts.copiesOwnedByYou) - num(opts.copiesTakenByOthers));
    var tierTotal = pool.copies * pool.champions;
    var removed = num(opts.copiesOwnedByYou) + num(opts.copiesTakenByOthers) +
      num(opts.championsOutOfPool) * pool.copies;
    var tierLeft = Math.max(1, tierTotal - removed);

    return tierOdds * (copiesLeft / tierLeft);
  }

  /**
   * Ket qua roll: p moi o, ky vong so ban sao, xac suat trung >= k, vang du kien.
   *  rolls: so lan refresh (moi lan 2 vang), moi lan 5 o.
   */
  function rollOutcome(opts) {
    var p = slotProbability(opts);
    var slots = (opts.slots || 5) * Math.max(0, num(opts.rolls));
    var need = Math.max(1, num(opts.copiesNeeded) || 1);

    var pAtLeastOne = slots ? 1 - Math.pow(1 - p, slots) : 0;
    var pShop = 1 - Math.pow(1 - p, opts.slots || 5);
    var expectedShopsToHit = pShop > 0 ? 1 / pShop : Infinity;

    return {
      slotProbability: p,
      shopProbability: pShop,
      expectedCopies: slots * p,
      probabilityAtLeastOne: pAtLeastOne,
      probabilityAtLeastNeeded: binomialAtLeast(slots, p, need),
      goldSpent: Math.max(0, num(opts.rolls)) * T.ROLL_COST,
      expectedGoldForOne: isFinite(expectedShopsToHit) ? expectedShopsToHit * T.ROLL_COST : Infinity,
      copiesLeftInPool: Math.max(0, POOL[clampInt(opts.cost, 1, 5)].copies -
        num(opts.copiesOwnedByYou) - num(opts.copiesTakenByOthers))
    };
  }

  /** So vang can roll de dat xac suat mong muon (vd 0.75). */
  function goldForConfidence(opts, confidence) {
    var p = slotProbability(opts);
    var slotsPerRoll = opts.slots || 5;
    if (p <= 0) return Infinity;
    var target = Math.min(0.999, Math.max(0.01, confidence || 0.75));
    var slotsNeeded = Math.log(1 - target) / Math.log(1 - p);
    return Math.ceil(slotsNeeded / slotsPerRoll) * T.ROLL_COST;
  }

  function binomialAtLeast(n, p, k) {
    if (k <= 0) return 1;
    if (n <= 0 || p <= 0) return 0;
    if (k > n) return 0;
    // 1 - P(X <= k-1)
    var cum = 0;
    var term = Math.pow(1 - p, n); // P(X = 0)
    for (var i = 0; i < k; i++) {
      if (i > 0) term = term * ((n - i + 1) / i) * (p / (1 - p));
      cum += term;
    }
    return Math.min(1, Math.max(0, 1 - cum));
  }

  // -------------------------------------------------- san tuong & ho tro reroll 3 sao

  /**
   * Tinh toan chi phi vang va xac suat de dat moc sao muc tieu (2 sao = 3 ban sao, 3 sao = 9 ban sao).
   */
  function goldToTargetStar(opts) {
    var cost = clampInt(opts.cost, 1, 5);
    var level = clampInt(opts.level, 1, 11);
    var currentOwned = Math.max(0, num(opts.copiesOwned));
    var targetStar = clampInt(opts.targetStar || 3, 2, 3);
    var targetCopies = targetStar === 3 ? 9 : 3;
    var copiesNeeded = Math.max(1, targetCopies - currentOwned);
    var taken = num(opts.copiesTakenByOthers);

    var p = slotProbability({
      cost: cost,
      level: level,
      copiesOwnedByYou: currentOwned,
      copiesTakenByOthers: taken
    });

    var pShop = 1 - Math.pow(1 - p, 5);
    var expectedRolls = p > 0 ? (copiesNeeded / (5 * p)) : Infinity;
    var expectedRollGold = isFinite(expectedRolls) ? Math.ceil(expectedRolls) * T.ROLL_COST : Infinity;
    var buyGold = copiesNeeded * cost;
    var totalExpectedGold = isFinite(expectedRollGold) ? expectedRollGold + buyGold : Infinity;

    // Tinh vang can de dat 50%, 75%, 90% xac suat truoc khi roll
    var confidence50 = goldForConfidence({ cost: cost, level: level, copiesOwnedByYou: currentOwned, copiesTakenByOthers: taken }, 0.50) + buyGold;
    var confidence75 = goldForConfidence({ cost: cost, level: level, copiesOwnedByYou: currentOwned, copiesTakenByOthers: taken }, 0.75) + buyGold;
    var confidence90 = goldForConfidence({ cost: cost, level: level, copiesOwnedByYou: currentOwned, copiesTakenByOthers: taken }, 0.90) + buyGold;

    // Cap do toi uu nhat de roll tuong nay
    var bestLevel = cost === 1 ? 5 : cost === 2 ? 6 : cost === 3 ? 7 : cost === 4 ? 8 : 9;

    return {
      cost: cost,
      targetStar: targetStar,
      targetCopies: targetCopies,
      currentOwned: currentOwned,
      copiesNeeded: copiesNeeded,
      slotProbability: p,
      shopProbability: pShop,
      expectedRolls: Math.ceil(expectedRolls),
      expectedRollGold: expectedRollGold,
      buyGold: buyGold,
      totalExpectedGold: totalExpectedGold,
      confidence50: isFinite(confidence50) ? confidence50 : Infinity,
      confidence75: isFinite(confidence75) ? confidence75 : Infinity,
      confidence90: isFinite(confidence90) ? confidence90 : Infinity,
      bestLevel: bestLevel,
      copiesLeftInPool: Math.max(0, POOL[cost].copies - currentOwned - taken)
    };
  }

  /**
   * Danh gia toan bo danh sach tuong can mua (Shopping / Wishlist Tracker).
   */
  function evaluateShoppingList(targets, state) {
    var list = targets || [];
    var level = clampInt((state && state.level) || 7, 1, 11);
    var currentGold = num((state && state.gold) || 50);

    var evaluated = list.map(function (item) {
      if (!item || !item.name) return null;
      var cost = clampInt(item.cost || 3, 1, 5);
      var owned = num(item.owned || 0);
      var targetStar = clampInt(item.targetStar || 3, 2, 3);
      var taken = num(item.taken || 0);

      var calcResult = goldToTargetStar({
        cost: cost,
        level: level,
        copiesOwned: owned,
        targetStar: targetStar,
        copiesTakenByOthers: taken
      });

      return {
        name: item.name,
        cost: cost,
        owned: owned,
        targetStar: targetStar,
        progress: owned + '/' + calcResult.targetCopies,
        percent: Math.min(100, Math.round((owned / calcResult.targetCopies) * 100)),
        calculation: calcResult
      };
    }).filter(Boolean);

    var totalBuyGold = evaluated.reduce(function (sum, item) { return sum + item.calculation.buyGold; }, 0);
    var totalExpectedGold = evaluated.reduce(function (sum, item) { return sum + item.calculation.totalExpectedGold; }, 0);

    // Kiem tra cua hang hien tai xem co tuong nao trong danh sach khong
    var matchedInShop = [];
    if (state && state.shop && state.shop.length) {
      state.shop.forEach(function (champName, slotIdx) {
        var match = evaluated.find(function (t) { return t.name.toLowerCase() === String(champName).toLowerCase(); });
        if (match) {
          matchedInShop.push({
            slot: slotIdx + 1,
            name: match.name,
            cost: match.cost,
            buyNow: currentGold >= match.cost,
            reason: 'Tướng mục tiêu (' + match.progress + ')'
          });
        }
      });
    }

    return {
      items: evaluated,
      totalBuyGold: totalBuyGold,
      totalExpectedGold: isFinite(totalExpectedGold) ? totalExpectedGold : Infinity,
      matchedInShop: matchedInShop,
      canAffordAllImmediate: currentGold >= totalBuyGold
    };
  }

  /**
   * Tao ke hoach Reroll va Mua tuong tu mot Doi hinh da chot (Locked Comp Reroll Plan).
   * comp: { name, tier, style, units: [{ name, cost, star, carry, items }] }
   */
  function buildCompRerollPlan(comp, currentOwnedMap, state) {
    if (!comp || !comp.units) return null;
    var ownedMap = currentOwnedMap || {};
    var level = clampInt((state && state.level) || 7, 1, 11);
    var currentGold = num((state && state.gold) || 50);

    var shoppingTargets = comp.units.map(function (u) {
      var owned = num(ownedMap[u.name.toLowerCase()] !== undefined ? ownedMap[u.name.toLowerCase()] : (u.star === 3 ? 9 : u.star === 2 ? 3 : 1));
      var targetStar = u.carry ? 3 : (u.star || 2);
      return {
        name: u.name,
        cost: u.cost || 3,
        owned: owned,
        targetStar: targetStar,
        carry: Boolean(u.carry),
        items: u.items || []
      };
    });

    var evaluated = evaluateShoppingList(shoppingTargets, { level: level, gold: currentGold, shop: (state && state.shop) || [] });

    // Tim cap do thich hop nhat cho toan bo doi hinh reroll
    var carryUnit = shoppingTargets.find(function (t) { return t.carry; }) || shoppingTargets[0];
    var recommendedRollLevel = carryUnit ? carryUnit.cost === 1 ? 5 : carryUnit.cost === 2 ? 6 : carryUnit.cost === 3 ? 7 : carryUnit.cost === 4 ? 8 : 9 : 8;

    // Huong dan hanh dong roll:
    var rollStrategy = '';
    if (carryUnit && carryUnit.cost <= 3) {
      rollStrategy = 'Đội hình Reroll ' + carryUnit.cost + ' vàng (' + carryUnit.name + '): Tích 50 vàng và Slow Roll (giữ mốc 50 vàng) ở cấp ' + recommendedRollLevel + '.';
    } else {
      rollStrategy = 'Đội hình Fast ' + recommendedRollLevel + ': Tích kinh tế lên cấp ' + recommendedRollLevel + ' rồi xả vàng roll tìm khung 2 sao.';
    }

    return {
      compName: comp.name,
      compTier: comp.tier || 'S',
      compStyle: comp.style || '',
      carryName: carryUnit ? carryUnit.name : '',
      recommendedRollLevel: recommendedRollLevel,
      rollStrategy: rollStrategy,
      shoppingList: evaluated.items,
      totalBuyGold: evaluated.totalBuyGold,
      totalExpectedGold: evaluated.totalExpectedGold,
      matchedInShop: evaluated.matchedInShop,
      canAffordAllImmediate: evaluated.canAffordAllImmediate
    };
  }

  // ------------------------------------------------------------------ econ

  function interest(gold) {
    return Math.min(T.MAX_INTEREST, Math.floor(Math.max(0, num(gold)) / 10));
  }

  function streakGold(streak) {
    var s = Math.abs(num(streak));
    for (var i = 0; i < T.STREAK_TABLE.length; i++) {
      if (s >= T.STREAK_TABLE[i].min) return T.STREAK_TABLE[i].gold;
    }
    return 0;
  }

  /** Thu nhap vong sau: co ban + lai + chuoi + thang tran. */
  function incomeNextRound(opts) {
    var base = T.BASE_INCOME;
    var i = interest(opts.gold);
    var s = streakGold(opts.streak);
    var w = opts.win ? T.WIN_BONUS : 0;
    return { base: base, interest: i, streak: s, win: w, total: base + i + s + w };
  }

  /** Mo phong n vong toi neu khong tieu gi, de biet khi nao du vang roll. */
  function projectGold(opts) {
    var gold = num(opts.gold);
    var rows = [];
    for (var r = 1; r <= (opts.rounds || 5); r++) {
      var inc = incomeNextRound({ gold: gold, streak: opts.streak, win: opts.win });
      gold += inc.total - num(opts.spendPerRound);
      rows.push({ round: r, income: inc.total, gold: Math.max(0, gold), interest: inc.interest });
    }
    return rows;
  }

  // -------------------------------------------------------------------- xp

  /** Vang va XP can de di tu (level, xp hien tai) len targetLevel, chi tinh mua XP. */
  function levelCost(level, xp, targetLevel) {
    var lv = clampInt(level, 1, 11);
    var target = clampInt(targetLevel, 1, 11);
    if (target <= lv) return { xp: 0, gold: 0, buys: 0, rounds: 0 };

    var xpNeeded = -num(xp);
    for (var l = lv; l < target; l++) xpNeeded += (T.XP_TO_NEXT[l] || 0);
    xpNeeded = Math.max(0, xpNeeded);
    var buys = Math.ceil(xpNeeded / T.XP_PER_BUY);
    return {
      xp: xpNeeded,
      gold: buys * T.GOLD_PER_BUY,
      buys: buys,
      rounds: Math.ceil(xpNeeded / T.XP_PER_ROUND) // neu khong mua, cho XP tu nhien
    };
  }

  /** Con bao nhieu XP nua thi len cap. */
  function xpToNext(level, xp) {
    var need = T.XP_TO_NEXT[clampInt(level, 1, 11)] || 0;
    return Math.max(0, need - num(xp));
  }

  // ----------------------------------------------------------------- items

  function normalizeComponentId(id) {
    if (!id) return '';
    var str = String(id).toLowerCase().replace(/[-_\s]/g, '');
    if (str === 'bf' || str === 'bfsword' || str === 'sword') return 'bf';
    if (str === 'bow' || str === 'recurvebow') return 'bow';
    if (str === 'rod' || str === 'largerod' || str === 'needlesslylargerod') return 'rod';
    if (str === 'tear' || str === 'tearofthegoddess') return 'tear';
    if (str === 'vest' || str === 'chainvest') return 'vest';
    if (str === 'cloak' || str === 'negatroncloak' || str === 'negatron') return 'cloak';
    if (str === 'belt' || str === 'giantsbelt') return 'belt';
    if (str === 'glove' || str === 'gloves' || str === 'sparringgloves') return 'glove';
    if (str === 'spatula' || str === 'spat') return 'spat';
    if (str === 'pan' || str === 'fryingpan') return 'pan';
    return String(id).toLowerCase();
  }

  function recipeKey(a, b) {
    var normA = normalizeComponentId(a);
    var normB = normalizeComponentId(b);
    var order = T.COMPONENTS.map(function (c) { return c.id; });
    var pair = [normA, normB].sort(function (x, y) { return order.indexOf(x) - order.indexOf(y); });
    return pair[0] + '+' + pair[1];
  }

  function combine(a, b) {
    return T.RECIPES[recipeKey(a, b)] || null;
  }

  /** Bang ghep 10x10 de ve luoi (co ca Xeng va Chao). */
  function recipeGrid() {
    return T.COMPONENTS.map(function (row) {
      return {
        component: row,
        cells: T.COMPONENTS.map(function (col) {
          var item = combine(row.id, col.id);
          return { a: row.id, b: col.id, item: item, itemVi: (T.ITEM_NAMES_VI && T.ITEM_NAMES_VI[item]) || item };
        })
      };
    });
  }

  /** Tu danh sach mon co ban dang co -> nhung do co the ghep ngay. */
  function craftable(componentIds) {
    var out = [];
    var have = (componentIds || []).slice();
    for (var i = 0; i < have.length; i++) {
      for (var j = i + 1; j < have.length; j++) {
        var item = combine(have[i], have[j]);
        if (item) out.push({ item: item, from: [have[i], have[j]] });
      }
    }
    return out;
  }

  /** Thieu gi de ghep duoc mon do dang muon. */
  function missingFor(itemName, componentIds) {
    var have = (componentIds || []).slice();
    var keys = Object.keys(T.RECIPES).filter(function (k) { return T.RECIPES[k] === itemName; });
    return keys.map(function (key) {
      var parts = key.split('+');
      var pool = have.slice();
      var missing = [];
      parts.forEach(function (part) {
        var idx = pool.indexOf(part);
        if (idx >= 0) pool.splice(idx, 1);
        else missing.push(part);
      });
      return { recipe: parts, missing: missing };
    }).sort(function (x, y) { return x.missing.length - y.missing.length; })[0] || null;
  }

  /**
   * Lap ke hoach ghep do: co tung nay mon co ban, muon ra danh sach mon uu tien nay
   * thi ghep duoc gi, con thua gi, con thieu gi.
   */
  function bestItemPlan(componentIds, wishlist) {
    var pool = (componentIds || []).map(normalizeComponentId);
    var crafted = [];
    var missing = [];

    (wishlist || []).forEach(function (itemName) {
      var recipes = Object.keys(T.RECIPES)
        .filter(function (key) { return T.RECIPES[key] === itemName; })
        .map(function (key) { return key.split('+'); });
      if (!recipes.length) {
        missing.push({ item: itemName, need: [], reason: 'khong ro cong thuc' });
        return;
      }

      var doable = recipes.filter(function (parts) { return canTake(pool, parts); });
      if (doable.length) {
        doable.sort(function (a, b) { return abundance(pool, b) - abundance(pool, a); });
        var chosen = doable[0];
        chosen.forEach(function (part) { pool.splice(pool.indexOf(part), 1); });
        crafted.push({ item: itemName, from: chosen });
      } else {
        var best = recipes.map(function (parts) {
          return { parts: parts, need: shortfall(pool, parts) };
        }).sort(function (a, b) { return a.need.length - b.need.length; })[0];
        missing.push({ item: itemName, need: best.need, recipe: best.parts });
      }
    });

    return { crafted: crafted, missing: missing, leftover: pool };
  }

  /**
   * Tinh toan do uu tien nhan do o vong di cho (Carousel Priority Picker):
   * Dua tren do chuan cua Carry va Tank trong doi hinh va cac linh kien dang giu.
   */
  function carouselPriorities(comp, currentComponents) {
    if (!comp || !comp.units) return [];
    var have = (currentComponents || []).slice();
    var neededComponents = {};

    comp.units.forEach(function (u) {
      if (u.items && (u.carry || u.role === 'tank' || u.role === 'main_tank')) {
        u.items.forEach(function (itemName) {
          var recipes = Object.keys(T.RECIPES).filter(function (k) { return T.RECIPES[k] === itemName; });
          if (recipes.length) {
            var parts = recipes[0].split('+');
            parts.forEach(function (part) {
              neededComponents[part] = (neededComponents[part] || 0) + (u.carry ? 2 : 1);
            });
          }
        });
      }
    });

    have.forEach(function (part) {
      if (neededComponents[part] && neededComponents[part] > 0) {
        neededComponents[part]--;
      }
    });

    var sorted = Object.keys(neededComponents)
      .filter(function (k) { return neededComponents[k] > 0; })
      .map(function (k) {
        var compObj = T.COMPONENTS.find(function (c) { return c.id === k; }) || { id: k, name: k };
        return {
          id: k,
          name: compObj.name,
          demandScore: neededComponents[k]
        };
      })
      .sort(function (a, b) { return b.demandScore - a.demandScore; });

    return sorted;
  }

  function canTake(pool, parts) {
    return shortfall(pool, parts).length === 0;
  }

  function shortfall(pool, parts) {
    var copy = pool.slice();
    var need = [];
    parts.forEach(function (part) {
      var idx = copy.indexOf(part);
      if (idx >= 0) copy.splice(idx, 1);
      else need.push(part);
    });
    return need;
  }

  function abundance(pool, parts) {
    return parts.reduce(function (sum, part) {
      return sum + pool.filter(function (p) { return p === part; }).length;
    }, 0);
  }

  // ------------------------------------------------ roll bay gio hay len cap?

  function rollVsLevel(opts) {
    var gold = num(opts.gold);
    var level = clampInt(opts.level, 1, 11);
    var xp = num(opts.xp);
    var need = Math.max(1, num(opts.copiesNeeded) || 1);
    var keep = num(opts.keepGold);
    var base = {
      cost: opts.cost,
      copiesOwnedByYou: opts.copiesOwnedByYou,
      copiesTakenByOthers: opts.copiesTakenByOthers,
      championsOutOfPool: opts.championsOutOfPool,
      copiesNeeded: need
    };

    var spendable = Math.max(0, gold - keep);
    var rollsNow = Math.floor(spendable / T.ROLL_COST);
    var now = rollOutcome(Object.assign({}, base, { level: level, rolls: rollsNow }));

    var up = levelCost(level, xp, level + 1);
    var afterLevel = Math.max(0, spendable - up.gold);
    var rollsAfter = Math.floor(afterLevel / T.ROLL_COST);
    var levelled = rollOutcome(Object.assign({}, base, { level: level + 1, rolls: rollsAfter }));

    var income = incomeNextRound({ gold: gold, streak: num(opts.streak), win: Boolean(opts.win) });
    var goldNextRound = gold + income.total;
    var rollsLater = Math.floor(Math.max(0, goldNextRound - keep) / T.ROLL_COST);
    var extraTaken = num(opts.expectedExtraTaken);
    var later = rollOutcome(Object.assign({}, base, {
      level: level,
      rolls: rollsLater,
      copiesTakenByOthers: num(opts.copiesTakenByOthers) + extraTaken
    }));

    var options = [
      { key: 'roll', level: level, rolls: rollsNow, gold: rollsNow * T.ROLL_COST,
        probability: now.probabilityAtLeastNeeded },
      { key: 'level', level: level + 1, rolls: rollsAfter,
        gold: up.gold + rollsAfter * T.ROLL_COST, levelGold: up.gold,
        probability: levelled.probabilityAtLeastNeeded },
      { key: 'wait', level: level, rolls: rollsLater, gold: rollsLater * T.ROLL_COST,
        income: income.total, probability: later.probabilityAtLeastNeeded }
    ];

    var best = options.slice().sort(function (a, b) { return b.probability - a.probability; })[0];
    return { options: options, best: best.key, bestOption: best };
  }

  // ----------------------------------------------- chia trang bi cho tung tuong

  function assignItems(a, b) {
    var isCompArray = function (arr) {
      return Array.isArray(arr) && arr.every(function (x) { return typeof x === 'string'; });
    };
    var componentIds = (isCompArray(a) ? a : (isCompArray(b) ? b : []));
    var units = (componentIds === a ? b : a) || [];

    var pool = (componentIds || []).slice();
    var sortedUnits = (units || []).slice().sort(function (u1, u2) {
      if (Boolean(u2.carry) !== Boolean(u1.carry)) return u2.carry ? 1 : -1;
      return 0;
    });

    var assignments = [];
    sortedUnits.forEach(function (unit) {
      var desired = (unit.items || []).slice(0, 3);
      var plan = bestItemPlan(pool, desired);
      pool = plan.leftover;
      assignments.push({
        unit: unit.name,
        name: unit.name,
        carry: Boolean(unit.carry),
        done: plan.crafted,
        crafted: plan.crafted,
        missing: plan.missing
      });
    });

    return { assignments: assignments, units: assignments, leftover: pool };
  }

  // ---------------------------------------------------- lich trinh vong dau

  function upcomingRounds(currentRound, count) {
    var info = T.ROUND_INFO;
    var parsed = parseRound(currentRound);
    if (!parsed) return [];
    var out = [];
    var stage = parsed.stage;
    var round = parsed.round;
    for (var i = 0; i < (count || 6); i++) {
      round += 1;
      if (round > info.roundsPerStage) { round = 1; stage += 1; }
      var label = stage + '-' + round;
      out.push({
        label: label,
        augment: info.augmentRounds.indexOf(label) >= 0,
        carousel: round === info.carouselRound,
        pve: round === info.pveRound
      });
    }
    return out;
  }

  function parseRound(text) {
    var m = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(String(text || ''));
    if (!m) return null;
    return { stage: parseInt(m[1], 10), round: parseInt(m[2], 10) };
  }

  // -------------------------------------------------- phan loai & tuong thich trang bi

  function classifyItem(itemName) {
    return (T.ITEM_CATEGORIES && T.ITEM_CATEGORIES[itemName]) || ['utility'];
  }

  function itemSynergyWithChampion(itemName, champion) {
    if (!itemName || !champion) return 50;
    var tags = classifyItem(itemName);
    var role = String(champion.role || (champion.datatft && champion.datatft.role) || '').toLowerCase();
    var stats = champion.stats || {};
    var isTank = /tank|vanguard|defender|brawler|guardian/i.test(role) || (stats.range === 1 && !/assassin|slayer/i.test(role));
    var isAP = /mage|caster|arcanist|spell|invoker|sorcerer/i.test(role);
    var isAD = /carry|marksman|sniper|hunter|executioner|slayer/i.test(role) && !isAP;

    var score = 50;
    if (isTank) {
      if (tags.indexOf('tank') >= 0 || tags.indexOf('armor') >= 0 || tags.indexOf('mr') >= 0 || tags.indexOf('hp') >= 0) score += 40;
      if (tags.indexOf('ad') >= 0 || tags.indexOf('ap') >= 0) score -= 30;
    } else if (isAP) {
      if (tags.indexOf('ap') >= 0 || tags.indexOf('mana') >= 0) score += 40;
      if (tags.indexOf('ad') >= 0) score -= 25;
      if (tags.indexOf('tank') >= 0) score -= 20;
    } else if (isAD) {
      if (tags.indexOf('ad') >= 0 || tags.indexOf('crit') >= 0 || tags.indexOf('as') >= 0 || tags.indexOf('sunder') >= 0) score += 40;
      if (tags.indexOf('ap') >= 0) score -= 25;
      if (tags.indexOf('tank') >= 0) score -= 20;
    }

    if (tags.indexOf('sustain') >= 0) score += 15;
    return Math.max(0, Math.min(100, score));
  }

  function itemSlamWarning(itemName) {
    var tags = classifyItem(itemName);
    if (tags.indexOf('ad') >= 0 && tags.indexOf('crit') >= 0) {
      return 'Ghép sớm khóa cứng hướng chơi tướng STVL chí mạng, khó xoay bài sang Pháp Sư.';
    }
    if (tags.indexOf('ap') >= 0 && tags.indexOf('mana') >= 0) {
      return 'Ghép sớm khóa hướng chơi tướng SMPT dùng nhiều năng lượng.';
    }
    if (tags.indexOf('tank') >= 0) {
      return 'Trang bị phòng thủ đa dụng, có thể ghép sớm giữ máu cho mọi đội hình.';
    }
    if (itemName === "Guinsoo's Rageblade" || itemName === 'Giant Slayer' || itemName === 'Hand of Justice') {
      return 'Trang bị đa dụng, có thể dùng tốt cho cả tướng STVL lẫn SMPT.';
    }
    return null;
  }

  function suggestCompsFromComponents(components, compsLib, dataset, options) {
    var pool = (components || []).slice();

    return (compsLib || []).map(function (comp) {
      var coreItems = [];
      (comp.units || []).forEach(function (u) {
        if (u.carry || (u.items && u.items.length)) {
          (u.items || []).forEach(function (item) { coreItems.push({ item: item, holder: u.name }); });
        }
      });

      var plan = bestItemPlan(pool, coreItems.map(function (x) { return x.item; }));
      var matchCount = plan.crafted.length;
      var totalNeeded = Math.max(1, coreItems.length);
      var fitRatio = matchCount / totalNeeded;

      var carryUnit = (comp.units || []).find(function (u) { return u.carry; });
      var earlyHolders = [];
      if (carryUnit && dataset && dataset.champions) {
        earlyHolders = (dataset.champions || [])
          .filter(function (c) { return (c.cost === 1 || c.cost === 2) && c.name !== carryUnit.name; })
          .slice(0, 3)
          .map(function (c) { return c.name; });
      }

      return {
        comp: comp,
        fitScore: Math.round(fitRatio * 100),
        craftableNow: plan.crafted,
        missing: plan.missing,
        leftover: plan.leftover,
        earlyHolders: earlyHolders
      };
    }).sort(function (a, b) { return b.fitScore - a.fitScore; });
  }

  // ----------------------------------------------------------------- utils

  function num(value) {
    var n = Number(value);
    return isNaN(n) ? 0 : n;
  }

  function clampInt(value, min, max) {
    var n = Math.round(num(value));
    return Math.min(max, Math.max(min, n));
  }

  function percent(value, digits) {
    return (value * 100).toFixed(digits === undefined ? 1 : digits) + '%';
  }

  var api = {
    shopOdds: shopOdds,
    setPool: setPool,
    getPool: getPool,
    resetPool: resetPool,
    slotProbability: slotProbability,
    rollOutcome: rollOutcome,
    goldForConfidence: goldForConfidence,
    binomialAtLeast: binomialAtLeast,
    goldToTargetStar: goldToTargetStar,
    evaluateShoppingList: evaluateShoppingList,
    buildCompRerollPlan: buildCompRerollPlan,
    interest: interest,
    streakGold: streakGold,
    incomeNextRound: incomeNextRound,
    projectGold: projectGold,
    levelCost: levelCost,
    xpToNext: xpToNext,
    combine: combine,
    recipeKey: recipeKey,
    recipeGrid: recipeGrid,
    craftable: craftable,
    missingFor: missingFor,
    bestItemPlan: bestItemPlan,
    carouselPriorities: carouselPriorities,
    classifyItem: classifyItem,
    itemSynergyWithChampion: itemSynergyWithChampion,
    itemSlamWarning: itemSlamWarning,
    suggestCompsFromComponents: suggestCompsFromComponents,
    rollVsLevel: rollVsLevel,
    assignItems: assignItems,
    upcomingRounds: upcomingRounds,
    parseRound: parseRound,
    percent: percent
  };

  global.TFT = global.TFT || {};
  global.TFT.calc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
