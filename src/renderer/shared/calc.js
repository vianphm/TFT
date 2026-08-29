/**
 * Toan bo phan tinh toan ho tro: ti le roll, kho tuong, kinh te, XP, ghep do.
 * Khong dung DOM -> chay duoc ca trong node de kiem thu.
 */
(function (global) {
  'use strict';

  var T = (global.TFT && global.TFT.tables) || require('./tables.js');

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
    var pool = T.POOL[cost];
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
      copiesLeftInPool: Math.max(0, T.POOL[clampInt(opts.cost, 1, 5)].copies -
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
    upcomingRounds: upcomingRounds,
    parseRound: parseRound,
    percent: percent
  };

  global.TFT = global.TFT || {};
  global.TFT.calc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
