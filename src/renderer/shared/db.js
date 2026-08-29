/**
 * Lop truy van database cua set.
 *
 * Du lieu tho tu Community Dragon chi la hai danh sach phang (tuong, toc he).
 * File nay dung chi muc de tra cuu nhanh, va quan trong hon: SUY NGUOC vai con so
 * ma bang cung trong tables.js hay bi lac hau sau moi set - so tuong moi muc gia,
 * cac moc cua tung toc he, tuong nao thuoc toc he nao, va chi muc loi nang cap (Augments).
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
    var uniqueByCost = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} };

    champions.forEach(function (champ) {
      var cost = Math.min(5, Math.max(1, champ.cost || 1));
      byCost[cost].push(champ);
      uniqueByCost[cost][String(champ.variantGroup || champ.name).toLowerCase()] = true;
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

    var augments = (dataset && dataset.augments) || [];
    var augmentsByTier = { silver: [], gold: [], prismatic: [] };
    var augmentsByTag = { econ: [], combat: [], items: [], emblem: [], reroll: [], xp: [] };
    var augmentsByName = {};

    augments.forEach(function (aug) {
      var tier = aug.tier || 'gold';
      if (augmentsByTier[tier]) augmentsByTier[tier].push(aug);
      (aug.tags || []).forEach(function (tag) {
        if (augmentsByTag[tag]) augmentsByTag[tag].push(aug);
      });
      if (aug.name) augmentsByName[aug.name.toLowerCase()] = aug;
      if (aug.apiName) augmentsByName[aug.apiName.toLowerCase()] = aug;
    });

    return {
      setName: (dataset && dataset.setName) || null,
      setNumber: (dataset && dataset.setNumber) || null,
      champions: champions,
      traits: traits,
      augments: augments,
      augmentsByTier: augmentsByTier,
      augmentsByTag: augmentsByTag,
      augmentsByName: augmentsByName,
      byCost: byCost,
      byTrait: byTrait,
      byName: byName,
      traitDefs: traitDefs,
      countByCost: {
        1: Object.keys(uniqueByCost[1]).length, 2: Object.keys(uniqueByCost[2]).length,
        3: Object.keys(uniqueByCost[3]).length, 4: Object.keys(uniqueByCost[4]).length,
        5: Object.keys(uniqueByCost[5]).length
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

  /** Tra cuu hoac loc Augments theo dieu kien. */
  function searchAugments(dataset, query, options) {
    var opts = options || {};
    var idx = dataset.augmentsByName ? dataset : index(dataset);
    var list = idx.augments || [];

    if (opts.tier) {
      list = list.filter(function (a) { return a.tier === opts.tier; });
    }
    if (opts.tag) {
      list = list.filter(function (a) { return (a.tags || []).indexOf(opts.tag) >= 0; });
    }
    if (opts.trait) {
      var tLower = opts.trait.toLowerCase();
      list = list.filter(function (a) {
        return (a.associatedTraits || []).some(function (t) { return t.toLowerCase() === tLower; });
      });
    }

    if (query && query.trim()) {
      var q = query.trim().toLowerCase();
      list = list.filter(function (a) {
        return (a.name && a.name.toLowerCase().indexOf(q) >= 0) ||
               (a.desc && a.desc.toLowerCase().indexOf(q) >= 0) ||
               (a.apiName && a.apiName.toLowerCase().indexOf(q) >= 0);
      });
    }

    return list;
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
      augments: (idx.augments || []).length,
      augmentsByTier: {
        silver: idx.augmentsByTier.silver.length,
        gold: idx.augmentsByTier.gold.length,
        prismatic: idx.augmentsByTier.prismatic.length
      },
      biggestTraits: traitNames
        .map(function (name) { return { name: name, champions: idx.traitDefs[name].champions.length }; })
        .sort(function (a, b) { return b.champions - a.champions; })
        .slice(0, 5)
    };
  }

  var TRAIT_NAMES_VI = {
    'Fae': 'Tiên Linh', 'Inferno': 'Hỏa Ngục', 'Blossom': 'Hoa Linh', 'Lunar': 'Mặt Trăng',
    'Elderwood': 'Thần Rừng', 'Sprykin': 'Tinh Nghịch', 'Blackthorn': 'Gai Đen', 'Primal': 'Nguyên Sinh',
    'Hunter': 'Thợ Săn', 'Rapidfire': 'Liên Kích', 'Spellweaver': 'Thuật Sư', 'Invoker': 'Thuật Sĩ',
    'Vanguard': 'Vệ Quân', 'Ravager': 'Tàn Phá', 'Brawler': 'Đấu Sĩ', 'Executioner': 'Đao Phủ',
    'Adaptor': 'Thích Ứng', 'Defender': 'Hộ Vệ', 'Sorcerer': 'Pháp Sư', 'Monolith': 'Cự Thạch',
    'Old Growth': 'Cổ Thụ', 'Harvester': 'Kẻ Thu Hoạch', 'Rebel': 'Nổi Loạn', 'Sentinel': 'Vệ Binh',
    'Caretaker': 'Người Nuôi Dưỡng', 'Wild': 'Hoang Dã', 'Mystic': 'Bí Ẩn'
  };

  /** Tra cuu toc he theo tu khoa ten hoac mo ta. */
  function searchTraits(dataset, query) {
    var idx = index(dataset);
    var traits = (dataset && dataset.traits) || [];
    var q = (query || '').trim().toLowerCase();

    var list = traits.map(function (t) {
      var nameVi = TRAIT_NAMES_VI[t.name] || t.name;
      var champs = idx.byTrait[t.name] || [];
      return {
        name: t.name,
        nameVi: nameVi,
        icon: t.icon || null,
        desc: t.desc || t.description || '',
        breakpoints: (t.breakpoints || []).filter(function (b) { return b > 0; }),
        levels: (t.datatft && t.datatft.levels) || (t.effects || []),
        champions: champs
      };
    });

    if (q) {
      list = list.filter(function (t) {
        return t.name.toLowerCase().indexOf(q) >= 0 ||
               t.nameVi.toLowerCase().indexOf(q) >= 0 ||
               t.desc.toLowerCase().indexOf(q) >= 0;
      });
    }

    return list;
  }

  var api = {
    index: index,
    poolFromDataset: poolFromDataset,
    poolDiff: poolDiff,
    traitsOf: traitsOf,
    cheapestForTrait: cheapestForTrait,
    searchAugments: searchAugments,
    searchTraits: searchTraits,
    TRAIT_NAMES_VI: TRAIT_NAMES_VI,
    summary: summary
  };

  global.TFT = global.TFT || {};
  global.TFT.db = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
