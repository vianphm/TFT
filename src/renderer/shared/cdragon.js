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

    if (raw && Array.isArray(raw.champions) && raw.champions.length) {
      out.push({
        source: 'root',
        mutator: raw.mutator || null,
        name: raw.name || null,
        number: Number(raw.number) || 18,
        plainMutator: true,
        entry: raw,
        champions: raw.champions.length
      });
    }

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
        var variantGroup = String(c.name || '').replace(/\s*\(.*\)\s*$/, '');
        return {
          apiName: c.apiName,
          name: c.name,
          variantGroup: variantGroup,
          isVariant: variantGroup !== c.name,
          cost: c.cost,
          traits: c.traits,
          icon: toCdn(c.squareIcon || c.tileIcon),
          role: c.role || null,
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
        desc: stripTags(t.desc || ''),
        breakpoints: (t.effects || []).map(function (e) { return e.minUnits; }),
        effects: (t.effects || []).map(function (e) {
          return {
            minUnits: e.minUnits,
            maxUnits: e.maxUnits,
            style: e.style,
            variables: e.variables || {}
          };
        })
      };
    });

    // File CDragon gom trang bi cua rat nhieu set. Uu tien namespace cua set da
    // chon (mua 18 la DA_) de khong tron Mercenary set 6 va an cua cac mua cu.
    var allItems = itemsForSet(raw.items || [], set.champions || []);
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
          effects: i.effects || {},
          unique: Boolean(i.unique),
          tags: i.tags || [],
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
      .filter(function (i) { return (i.isAugment || /augment/i.test(i.apiName || '')) && i.name; })
      .map(function (i) {
        var assoc = i.associatedTraits && i.associatedTraits.length
          ? i.associatedTraits
          : guessAssociatedTraits(i, traitNames);
        return {
          apiName: i.apiName,
          name: i.name,
          icon: toCdn(i.icon),
          desc: stripTags(i.desc || ''),
          tier: augmentTier(i),
          tags: augmentTags(i, traitNames),
          effects: i.effects || {},
          associatedTraits: assoc
        };
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
      critMultiplier: st.critMultiplier || null,
      range: st.range || null,
      mana: st.mana || null,
      initialMana: st.initialMana || null
    };
  }

  function itemsForSet(items, champions) {
    var counts = {};
    (champions || []).forEach(function (champ) {
      var match = /^([^_]+)_/.exec(champ.apiName || '');
      if (match) counts[match[1]] = (counts[match[1]] || 0) + 1;
    });
    var namespace = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    if (!namespace) return items;
    var prefix = namespace + '_';
    var scoped = items.filter(function (item) { return String(item.apiName || '').indexOf(prefix) === 0; });
    // Neu namespace do khong co du bo trang bi thi giu cach cu de ho tro set legacy.
    return scoped.filter(function (i) { return i.composition && i.composition.length === 2; }).length >= 30
      ? scoped
      : items;
  }

  function augmentTier(item) {
    if (!item) return 'gold';
    var tags = item.tags || [];
    if (tags.indexOf('{cf1fd3af}') >= 0) return 'prismatic';
    if (tags.indexOf('{ce1fd21c}') >= 0) return 'gold';
    if (tags.indexOf('{d11fd6d5}') >= 0) return 'silver';

    var value = (String(item.icon || '') + ' ' + String(item.apiName || '') + ' ' + String(item.name || '')).toLowerCase();
    if (/(?:_iii\b|-iii\b|\biii\b|tier3|prismatic|-t3\b|3\.png|3\.tex|_3\b)/i.test(value)) return 'prismatic';
    if (/(?:_ii\b|-ii\b|\bii\b|tier2|gold|-t2\b|2\.png|2\.tex|_2\b)/i.test(value)) return 'gold';
    if (/(?:_i\b|-i\b|\bi\b|tier1|silver|-t1\b|1\.png|1\.tex|_1\b)/i.test(value)) return 'silver';
    if (/emblem/i.test(value)) return 'gold';
    return 'gold';
  }

  function augmentTags(item, traitNames) {
    var tags = [];
    var text = (String(item.name || '') + ' ' + String(item.desc || '') + ' ' + String(item.apiName || '')).toLowerCase();
    if (/emblem|crest|crown|heart|soul|\+1 |trait/i.test(text) || (item.associatedTraits && item.associatedTraits.length > 0)) {
      tags.push('emblem');
    }
    if (/\bgold\b|interest|streak|rich|fund|coin|gain \d+ gold|economy|tiền|vàng|lãi/i.test(text)) {
      tags.push('econ');
    }
    if (/\bxp\b|experience|level up|reach level|level \d+|kinh nghiệm|cấp/i.test(text)) {
      tags.push('xp');
    }
    if (/reroll|refresh|free shop|roll|đổi lại/i.test(text)) {
      tags.push('reroll');
    }
    if (/component|item|anvil|reforger|remover|glove|sword|bow|rod|tear|vest|cloak|belt|spatula|trang bị|món|đồ/i.test(text)) {
      tags.push('items');
    }
    if (/damage|health|armor|resist|attack speed|shield|heal|execute|combat|team gains|bonus stats|sát thương|máu|giáp|kháng/i.test(text)) {
      tags.push('combat');
    }
    if (tags.length === 0) tags.push('combat');
    return tags;
  }

  function guessAssociatedTraits(item, traitNames) {
    var text = (String(item.name || '') + ' ' + String(item.desc || '') + ' ' + String(item.apiName || '')).toLowerCase();
    var matched = [];
    Object.keys(traitNames || {}).forEach(function (trait) {
      if (text.indexOf(trait.toLowerCase()) >= 0) {
        matched.push(trait);
      }
    });
    return matched;
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
