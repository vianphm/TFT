/**
 * Toan bo phan tinh toan ho tro: ti le roll, kho tuong, kinh te, XP, ghep do.
 * Khong dung DOM -> chay duoc ca trong node de kiem thu.
 */
(function (global) {
  'use strict';

  var T = (global.TFT && global.TFT.tables) || require('./tables.js');

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

  function recipeKey(a, b) {
    var order = T.COMPONENTS.map(function (c) { return c.id; });
    var pair = [a, b].sort(function (x, y) { return order.indexOf(x) - order.indexOf(y); });
    return pair[0] + '+' + pair[1];
  }

  function combine(a, b) {
    return T.RECIPES[recipeKey(a, b)] || null;
  }

  /** Bang ghep 9x9 de ve luoi. */
  function recipeGrid() {
    return T.COMPONENTS.map(function (row) {
      return {
        component: row,
        cells: T.COMPONENTS.map(function (col) {
          return { a: row.id, b: col.id, item: combine(row.id, col.id) };
        })
      };
    });
  }

  /** Tu danh sach mon co ban dang co -> nhung do co the ghep ngay. */
  function craftable(componentIds) {
    var out = [];
    for (var i = 0; i < componentIds.length; i++) {
      for (var j = i + 1; j < componentIds.length; j++) {
        var item = combine(componentIds[i], componentIds[j]);
        if (item) out.push({ item: item, from: [componentIds[i], componentIds[j]] });
      }
    }
    return out;
  }

  /** Thieu gi de ghep duoc mon do dang muon. */
  function missingFor(itemName, componentIds) {
    var have = componentIds.slice();
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
   * Duyet theo thu tu uu tien; moi mon chon cong thuc dung mon co ban dang du nhat,
   * de danh mon hiem cho cac mon phia sau.
   */
  function bestItemPlan(componentIds, wishlist) {
    var pool = (componentIds || []).slice();
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
        // Uu tien cong thuc dung mon dang co nhieu nhat trong tui
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

  /**
   * So sanh ba lua chon quen thuoc khi dang san mot con tuong:
   *   A. Roll het vang o cap hien tai
   *   B. Mua XP len cap roi roll so vang con lai (ti le tot hon nhung it lan roll hon)
   *   C. Giu vang an lai, vong sau roll (nhieu vang hon nhung cham mot vong,
   *      va doi thu co the vet mat ban sao)
   *
   * Tra ve xac suat trung cua tung phuong an de nguoi choi tu quyet, kem goi y.
   */
  function rollVsLevel(opts) {
    var gold = num(opts.gold);
    var level = clampInt(opts.level, 1, 11);
    var xp = num(opts.xp);
    var need = Math.max(1, num(opts.copiesNeeded) || 1);
    var keep = num(opts.keepGold);          // vang muon giu lai (an lai)
    var base = {
      cost: opts.cost,
      copiesOwnedByYou: opts.copiesOwnedByYou,
      copiesTakenByOthers: opts.copiesTakenByOthers,
      championsOutOfPool: opts.championsOutOfPool,
      copiesNeeded: need
    };

    var spendable = Math.max(0, gold - keep);

    // A. roll ngay
    var rollsNow = Math.floor(spendable / T.ROLL_COST);
    var now = rollOutcome(Object.assign({}, base, { level: level, rolls: rollsNow }));

    // B. len cap truoc
    var up = levelCost(level, xp, level + 1);
    var afterLevel = Math.max(0, spendable - up.gold);
    var rollsAfter = Math.floor(afterLevel / T.ROLL_COST);
    var levelled = rollOutcome(Object.assign({}, base, { level: level + 1, rolls: rollsAfter }));

    // C. cho mot vong (co them thu nhap, doi thu co the lay them ban sao)
    var income = incomeNextRound({ gold: gold, streak: num(opts.streak), win: Boolean(opts.win) });
    var goldNextRound = gold + income.total;
    var rollsLater = Math.floor(Math.max(0, goldNextRound - keep) / T.ROLL_COST);
    var extraTaken = num(opts.expectedExtraTaken);  // uoc luong ban sao bi nguoi khac lay them
    var later = rollOutcome(Object.assign({}, base, {
      level: level,
      rolls: rollsLater,
      copiesTakenByOthers: num(opts.copiesTakenByOthers) + extraTaken
    }));

    // Chi tra ve so lieu; phan chu hien ra man hinh do giao dien tu dat.
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

  /**
   * Chia mon co ban dang co cho cac tuong trong doi hinh.
   * Uu tien carry truoc, roi den tuong dung dau danh sach; moi tuong toi da 3 mon.
   * Tra ve tung tuong ghep duoc gi, con thieu gi, va phan con thua.
   */
  function assignItems(units, componentIds) {
    var pool = (componentIds || []).slice();
    var ordered = (units || []).slice().sort(function (a, b) {
      return (b.carry ? 1 : 0) - (a.carry ? 1 : 0);
    });

    var rows = ordered.map(function (unit) {
      var wishlist = (unit.items || []).slice(0, 3);
      var plan = bestItemPlan(pool, wishlist);
      pool = plan.leftover;
      return {
        unit: unit.name,
        carry: Boolean(unit.carry),
        done: plan.crafted,
        missing: plan.missing,
        complete: plan.missing.length === 0 && wishlist.length > 0
      };
    });

    return { units: rows, leftover: pool };
  }

  // ---------------------------------------------------------------- rounds

  /** Danh sach vong tiep theo kem ghi chu (chon do, lo bai tang, quai). */
  function upcomingRounds(current, count) {
    var info = T.ROUND_INFO;
    var parsed = parseRound(current);
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
