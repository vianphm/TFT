/**
 * Lop truy van database cua set.
 *
 * Du lieu tho tu Community Dragon chi la hai danh sach phang (tuong, toc he).
 * File nay dung chi muc de tra cuu nhanh, va quan trong hon: SUY NGUOC vai con so
 * ma bang cung trong tables.js hay bi lac hau sau moi set - so tuong moi muc gia,
 * cac moc cua tung toc he, tuong nao thuoc toc he nao.
 *
 * Chay duoc ca trong Node lan trinh duyet.
 */
(function (global) {
  'use strict';

  var tables = (global.TFT && global.TFT.tables) ||
    (typeof require !== 'undefined' ? require('./tables.js') : null);

  /**
   * Danh chi muc mot bo du lieu set.
   * Tra ve doi tuong tra cuu, khong sua du lieu goc.
   */
  function index(dataset) {
    var champions = (dataset && dataset.champions) || [];
    var traits = (dataset && dataset.traits) || [];

    var byCost = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    var byTrait = {};
    var byName = {};

    champions.forEach(function (champ) {
      var cost = Math.min(5, Math.max(1, champ.cost || 1));
      byCost[cost].push(champ);
      byName[champ.name.toLowerCase()] = champ;
      (champ.traits || []).forEach(function (trait) {
        if (!byTrait[trait]) byTrait[trait] = [];
        byTrait[trait].push(champ);
      });
    });

    var traitDefs = {};
    traits.forEach(function (trait) {
      traitDefs[trait.name] = {
        name: trait.name,
        icon: trait.icon || null,
        breakpoints: (trait.breakpoints || []).filter(function (b) { return b > 0; })
          .sort(function (a, b) { return a - b; }),
        champions: byTrait[trait.name] || []
      };
    });

    // Toc he chi xuat hien o tuong ma khong co trong bang toc he (vd bieu tuong rieng)
    Object.keys(byTrait).forEach(function (name) {
      if (traitDefs[name]) return;
      traitDefs[name] = { name: name, icon: null, breakpoints: [], champions: byTrait[name] };
    });

    return {
      setName: (dataset && dataset.setName) || null,
      setNumber: (dataset && dataset.setNumber) || null,
      champions: champions,
      byCost: byCost,
      byTrait: byTrait,
      byName: byName,
      traitDefs: traitDefs,
      countByCost: {
        1: byCost[1].length, 2: byCost[2].length, 3: byCost[3].length,
        4: byCost[4].length, 5: byCost[5].length
      }
    };
  }

  /**
   * Kho tuong that cua set dang choi.
   *
   * So BAN SAO moi tuong (22/20/17/10/9) do Riot quy dinh, khong co trong du lieu
   * nen van lay tu tables.js; nhung SO TUONG moi muc gia thi dem thang tu du lieu
   * - moi set mot khac, va con so nay anh huong truc tiep den ti le roll ra dung con
   * tuong minh can.
   */
  function poolFromDataset(dataset) {
    var idx = dataset && dataset.byCost ? dataset : index(dataset);
    var pool = {};
    [1, 2, 3, 4, 5].forEach(function (cost) {
      var base = tables.POOL[cost] || { copies: 10, champions: 10 };
      var counted = idx.countByCost[cost];
      pool[cost] = {
        copies: base.copies,
        champions: counted || base.champions,
        // Danh dau de giao dien noi ro con so nay tu dau ra
        derived: Boolean(counted)
      };
    });
    return pool;
  }

  /** Bang doi chieu: bang cung trong tables.js so voi du lieu set that. */
  function poolDiff(dataset) {
    var derived = poolFromDataset(dataset);
    return [1, 2, 3, 4, 5].map(function (cost) {
      var base = tables.POOL[cost];
      return {
        cost: cost,
        hardcoded: base.champions,
        actual: derived[cost].champions,
        changed: derived[cost].derived && derived[cost].champions !== base.champions
      };
    });
  }

  /** Cac toc he ma tuong nay dong gop, kem moc gan nhat. */
  function traitsOf(dataset, championName) {
    var idx = dataset.byName ? dataset : index(dataset);
    var champ = idx.byName[String(championName || '').toLowerCase()];
    if (!champ) return [];
    return (champ.traits || []).map(function (name) {
      var def = idx.traitDefs[name] || { breakpoints: [] };
      return { name: name, breakpoints: def.breakpoints, poolSize: (idx.byTrait[name] || []).length };
    });
  }

  /**
   * Tuong re nhat de bat mot moc toc he.
   * Dung khi ban muon "con thieu 2 tuong nua la len Tinh Linh 6" thi nen mua ai.
   */
  function cheapestForTrait(dataset, traitName, count, options) {
    var opts = options || {};
    var idx = dataset.byTrait ? dataset : index(dataset);
    var pool = (idx.byTrait[traitName] || []).filter(function (c) {
      if (opts.maxCost && c.cost > opts.maxCost) return false;
      if (opts.exclude && opts.exclude.indexOf(c.name) >= 0) return false;
      return true;
    });
    return pool
      .slice()
      .sort(function (a, b) { return a.cost - b.cost || a.name.localeCompare(b.name); })
      .slice(0, count || 1);
  }

  /** Tom tat de hien len giao dien: set nay co gi. */
  function summary(dataset) {
    var idx = index(dataset);
    var traitNames = Object.keys(idx.traitDefs);
    return {
      setName: idx.setName,
      setNumber: idx.setNumber,
      champions: idx.champions.length,
      countByCost: idx.countByCost,
      traits: traitNames.length,
      biggestTraits: traitNames
        .map(function (name) { return { name: name, champions: idx.traitDefs[name].champions.length }; })
        .sort(function (a, b) { return b.champions - a.champions; })
        .slice(0, 5)
    };
  }

  var api = {
    index: index,
    poolFromDataset: poolFromDataset,
    poolDiff: poolDiff,
    traitsOf: traitsOf,
    cheapestForTrait: cheapestForTrait,
    summary: summary
  };

  global.TFT = global.TFT || {};
  global.TFT.db = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
