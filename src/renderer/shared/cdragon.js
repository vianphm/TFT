/**
 * Doc du lieu TFT tu Community Dragon.
 * Dung chung cho ca tien trinh chinh cua app PC (require) va ban web tren dien thoai (script tag),
 * nen chi dung cu phap chay duoc o ca hai noi.
 */
(function (global) {
  'use strict';

  var CDRAGON_URL = 'https://raw.communitydragon.org/latest/cdragon/tft/en_us.json';
  var CDN_BASE = 'https://raw.communitydragon.org/latest/game/';

  /**
   * Liet ke cac nhanh du lieu co the la "set dang choi", de con chon va de soi khi sai.
   *
   * File en_us.json co hai cho chua set:
   *   - raw.setData: mang, moi phan tu co mutator kieu "TFTSet14" (ban chinh) hoac
   *     "TFTSet14_Stage2" (ban giua mua), day moi la du lieu dang chay.
   *   - raw.sets: doi tuong dat theo so, con giu ca cac set cu va mot so muc rac
   *     (vi du muc chua ca chuc phien ban Lux cua nhieu mua gop lai).
   * Uu tien setData voi mutator "TFTSet<so>" thuan, so lon nhat.
   */
  function listSetCandidates(raw) {
    var out = [];

    (raw.setData || []).forEach(function (entry) {
      if (!entry || !entry.champions || !entry.champions.length) return;
      var match = /^TFTSet(\d+)(.*)$/.exec(entry.mutator || '');
      out.push({
        source: 'setData',
        mutator: entry.mutator || null,
        name: entry.name || null,
        number: match ? Number(match[1]) : (Number(entry.number) || 0),
        plainMutator: Boolean(match && !match[2]),
        entry: entry,
        champions: entry.champions.length
      });
    });

    var sets = raw.sets || {};
    Object.keys(sets).forEach(function (key) {
      var entry = sets[key];
      if (!entry || !entry.champions || !entry.champions.length) return;
      out.push({
        source: 'sets',
        mutator: null,
        name: entry.name || null,
        number: Number(key) || 0,
        plainMutator: false,
        entry: entry,
        champions: entry.champions.length
      });
    });

    // setData truoc, mutator thuan truoc, roi den so set lon hon
    return out.sort(function (a, b) {
      if (a.source !== b.source) return a.source === 'setData' ? -1 : 1;
      if (a.plainMutator !== b.plainMutator) return a.plainMutator ? -1 : 1;
      return b.number - a.number;
    });
  }

  /** Tom tat de in ra log CI: moi nhanh co bao nhieu tuong tung muc gia. */
  function diagnose(raw) {
    return listSetCandidates(raw).map(function (c) {
      var byCost = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      (c.entry.champions || []).forEach(function (champ) {
        if (byCost[champ.cost] !== undefined) byCost[champ.cost]++;
      });
      return {
        source: c.source,
        mutator: c.mutator,
        name: c.name,
        number: c.number,
        champions: c.champions,
        byCost: byCost,
        traits: (c.entry.traits || []).length
      };
    });
  }

  /** Rut gon file en_us.json (rat nang) con dung nhung gi app can. */
  function parseCdragon(raw, options) {
    var opts = options || {};
    var candidates = listSetCandidates(raw);
    var chosen = null;

    if (opts.mutator) {
      chosen = candidates.find(function (c) { return c.mutator === opts.mutator; }) || null;
    }
    if (!chosen && opts.setNumber) {
      chosen = candidates.find(function (c) { return c.number === Number(opts.setNumber); }) || null;
    }
    if (!chosen) chosen = candidates[0] || null;

    var set = chosen ? chosen.entry : { champions: [], traits: [] };
    var setNumber = chosen ? chosen.number : null;

    var champions = (set.champions || [])
      .filter(function (c) { return c.cost > 0 && c.traits && c.traits.length; })
      .map(function (c) {
        return {
          apiName: c.apiName,
          name: c.name,
          cost: c.cost,
          traits: c.traits,
          icon: toCdn(c.squareIcon || c.tileIcon),
          ability: readAbility(c),
          stats: readStats(c)
        };
      })
      .sort(function (a, b) { return a.cost - b.cost || a.name.localeCompare(b.name); });

    var traits = (set.traits || []).map(function (t) {
      return {
        apiName: t.apiName,
        name: t.name,
        icon: toCdn(t.icon),
        breakpoints: (t.effects || []).map(function (e) { return e.minUnits; })
      };
    });

    var allItems = raw.items || [];
    var traitNames = {};
    (set.traits || []).forEach(function (t) { traitNames[t.name] = true; });
    var items = allItems
      .filter(function (i) { return i.composition && i.composition.length === 2; })
      .map(function (i) {
        return {
          apiName: i.apiName,
          name: i.name,
          composition: i.composition,
          icon: toCdn(i.icon),
          desc: stripTags(i.desc || ''),
          emblem: isEmblem(i)
        };
      });

    // An (bieu tuong toc he): ghep tu Xeng, cho tuong mang them mot toc he
    var emblems = allItems
      .filter(isEmblem)
      .map(function (i) {
        return {
          apiName: i.apiName,
          name: i.name,
          icon: toCdn(i.icon),
          composition: i.composition || [],
          trait: guessTrait(i, traitNames),
          desc: stripTags(i.desc || '')
        };
      });

    // Mon co ban = mon duoc dung lam nguyen lieu trong cong thuc cua mon khac.
    // Suy ra tu chinh du lieu, khong doan theo duong dan icon (moi set Riot doi mot kieu).
    var usedAsPart = {};
    allItems.forEach(function (i) {
      (i.composition || []).forEach(function (part) { usedAsPart[part] = true; });
    });
    var components = allItems
      .filter(function (i) { return usedAsPart[i.apiName]; })
      .map(function (i) { return { apiName: i.apiName, name: i.name, icon: toCdn(i.icon) }; });

    var augments = allItems
      .filter(function (i) { return /augment/i.test(i.apiName || '') && i.name; })
      .map(function (i) {
        return { apiName: i.apiName, name: i.name, icon: toCdn(i.icon), desc: stripTags(i.desc || '') };
      });

    return {
      source: 'communitydragon',
      syncedAt: new Date().toISOString(),
      setNumber: setNumber,
      setMutator: chosen ? chosen.mutator : null,
      setName: set.name || ('Set ' + setNumber),
      champions: champions,
      traits: traits,
      items: items,
      emblems: emblems,
      components: components,
      augments: augments
    };
  }

  /** Chieu thuc: ten, mo ta, anh, va cac chi so cua chieu neu co. */
  function readAbility(champ) {
    var ability = champ.ability;
    if (!ability) return null;
    return {
      name: ability.name || null,
      desc: stripTags(ability.desc || ''),
      icon: toCdn(ability.icon),
      variables: (ability.variables || [])
        .filter(function (v) { return v && v.name && v.value; })
        .map(function (v) { return { name: v.name, values: v.value }; })
    };
  }

  /** Chi so co ban (mau, sat thuong, giap, khang phep, tam danh...). */
  function readStats(champ) {
    var st = champ.stats || {};
    return {
      hp: st.hp || null,
      damage: st.damage || null,
      armor: st.armor || null,
      magicResist: st.magicResist || null,
      attackSpeed: st.attackSpeed ? Math.round(st.attackSpeed * 100) / 100 : null,
      critChance: st.critChance || null,
      range: st.range || null,
      mana: st.mana || null,
      initialMana: st.initialMana || null
    };
  }

  function isEmblem(item) {
    if (!item || !item.name) return false;
    return /emblem/i.test(item.apiName || '') || /\bEmblem\b/i.test(item.name);
  }

  /** Doan toc he ma an nay cho: lay ten toc he xuat hien trong ten an. */
  function guessTrait(item, traitNames) {
    var name = String(item.name || '');
    var found = Object.keys(traitNames).filter(function (trait) {
      return name.toLowerCase().indexOf(trait.toLowerCase()) >= 0;
    });
    return found.sort(function (a, b) { return b.length - a.length; })[0] || null;
  }

  function toCdn(iconPath) {
    if (!iconPath) return null;
    return CDN_BASE + String(iconPath).toLowerCase().replace(/\.(tex|dds)$/, '.png');
  }

  function stripTags(text) {
    return String(text).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }

  var api = {
    CDRAGON_URL: CDRAGON_URL,
    parseCdragon: parseCdragon,
    listSetCandidates: listSetCandidates,
    diagnose: diagnose,
    toCdn: toCdn,
    stripTags: stripTags
  };
  global.TFT = global.TFT || {};
  global.TFT.cdragon = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
