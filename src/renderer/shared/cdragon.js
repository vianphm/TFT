/**
 * Doc du lieu TFT tu Community Dragon.
 * Dung chung cho ca tien trinh chinh cua app PC (require) va ban web tren dien thoai (script tag),
 * nen chi dung cu phap chay duoc o ca hai noi.
 */
(function (global) {
  'use strict';

  var CDRAGON_URL = 'https://raw.communitydragon.org/latest/cdragon/tft/en_us.json';
  var CDN_BASE = 'https://raw.communitydragon.org/latest/game/';

  /** Rut gon file en_us.json (rat nang) con dung nhung gi app can. */
  function parseCdragon(raw) {
    var sets = raw.sets || {};
    var setNumber = Object.keys(sets)
      .map(Number)
      .filter(function (n) { return !isNaN(n); })
      .sort(function (a, b) { return b - a; })[0];
    var set = sets[String(setNumber)] || { champions: [], traits: [] };

    var champions = (set.champions || [])
      .filter(function (c) { return c.cost > 0 && c.traits && c.traits.length; })
      .map(function (c) {
        return {
          apiName: c.apiName,
          name: c.name,
          cost: c.cost,
          traits: c.traits,
          icon: toCdn(c.squareIcon || c.tileIcon)
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
    var items = allItems
      .filter(function (i) { return i.composition && i.composition.length === 2; })
      .map(function (i) {
        return {
          apiName: i.apiName,
          name: i.name,
          composition: i.composition,
          icon: toCdn(i.icon),
          desc: stripTags(i.desc || '')
        };
      });

    var components = allItems
      .filter(function (i) { return (!i.composition || !i.composition.length) && i.icon && /items\/hexcore/i.test(i.icon); })
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
      setName: set.name || ('Set ' + setNumber),
      champions: champions,
      traits: traits,
      items: items,
      components: components,
      augments: augments
    };
  }

  function toCdn(iconPath) {
    if (!iconPath) return null;
    return CDN_BASE + String(iconPath).toLowerCase().replace(/\.(tex|dds)$/, '.png');
  }

  function stripTags(text) {
    return String(text).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }

  var api = { CDRAGON_URL: CDRAGON_URL, parseCdragon: parseCdragon, toCdn: toCdn, stripTags: stripTags };
  global.TFT = global.TFT || {};
  global.TFT.cdragon = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
