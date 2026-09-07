'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- KIỂM THỬ BLITZ TFT COMPANION ---');

// 1. Kiểm thử Data Layer
{
  const tables = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'tables.json'), 'utf8'));
  assert(tables.SHOP_ODDS, 'Thieu bang SHOP_ODDS');
  for (let lv = 1; lv <= 11; lv++) {
    const odds = tables.SHOP_ODDS[String(lv)];
    assert(Array.isArray(odds) && odds.length === 5, `SHOP_ODDS cap ${lv} phai co 5 bac tuong`);
    const sum = odds.reduce((a, b) => a + b, 0);
    assert(Math.abs(sum - 1.0) < 0.01, `Tong ti le cap ${lv} phai bang 100%`);
  }
  console.log('✓ Bang ti le roll SHOP_ODDS 1-11 hop le');

  const items = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'items.json'), 'utf8'));
  assert(Array.isArray(items.COMPONENTS) && items.COMPONENTS.length >= 8, 'Thieu danh sach linh kien');
  assert(Array.isArray(items.RECIPES) && items.RECIPES.length >= 20, 'Thieu danh sach cong thuc do');
  const compIds = items.COMPONENTS.map((c) => c.id);
  items.RECIPES.forEach((r) => {
    assert(r.from && r.from.length === 2, `Trang bi ${r.name} phai ghep tu 2 linh kien`);
    r.from.forEach((id) => assert(compIds.includes(id), `Linh kien ${id} khong ton tai`));
  });
  console.log('✓ Bang cong thuc trang bi hop le');

  const comps = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'comps.json'), 'utf8'));
  assert(Array.isArray(comps) && comps.length >= 3, 'Phai co it nhat 3 doi hinh meta');
  comps.forEach((c) => {
    assert(c.id && c.name && c.tier, `Doi hinh ${c.name} phai co id, name va tier`);
    assert(Array.isArray(c.units) && c.units.length >= 6, `Doi hinh ${c.name} phai co it nhat 6 tuong`);
  });
  console.log('✓ Danh sach doi hinh meta hop le');
}

// 2. Kiểm thử Store Service
{
  const { Store } = require('../src/main/services/store');
  const tmpFile = path.join(__dirname, 'temp-config.json');
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);

  const store = new Store(tmpFile, { initial: 123, nested: { value: 'blitz' } });
  assert.strictEqual(store.get('initial'), 123);
  assert.strictEqual(store.get('nested.value'), 'blitz');

  store.set('nested.value', 'pro');
  assert.strictEqual(store.get('nested.value'), 'pro');

  store.set('newKey.deep.val', 999);
  assert.strictEqual(store.get('newKey.deep.val'), 999);

  // Doc lai tu dia
  const reloaded = new Store(tmpFile);
  assert.strictEqual(reloaded.get('newKey.deep.val'), 999);

  fs.unlinkSync(tmpFile);
  console.log('✓ Store service luu va doc cau hinh hoan hao');
}

// 3. Kiểm thử GameWatcher Service
{
  const { GameWatcher } = require('../src/main/services/gameWatcher');
  let notified = false;
  const watcher = new GameWatcher({
    onChange: (status) => { notified = true; }
  });
  assert(watcher.getState(), 'Watcher phai co state ban dau');
  console.log('✓ GameWatcher khoi tao thanh cong');
}

// 4. Kiểm thử RiotLiveClient Parser
{
  const { RiotLiveClient } = require('../src/main/services/riotLiveClient');
  const client = new RiotLiveClient();
  const mockData = {
    activePlayer: {
      summonerName: 'ProPlayer',
      level: 7,
      currentGold: 48
    },
    gameData: {
      gameTime: 400 // ~6.6 phut = round 3-x
    },
    allPlayers: [
      { summonerName: 'ProPlayer', health: 82, level: 7 }
    ]
  };
  const parsed = client._parse(mockData);
  assert.strictEqual(parsed.summonerName, 'ProPlayer');
  assert.strictEqual(parsed.level, 7);
  assert.strictEqual(parsed.gold, 48);
  assert.strictEqual(parsed.health, 82);
  assert(parsed.round.startsWith('3-'), `Round phai o stage 3, nhan duoc: ${parsed.round}`);
  console.log('✓ RiotLiveClient phan tich du lieu tran dau Riot Port 2999 chinh xac');
}

console.log('\n🎉 TOÀN BỘ KIỂM THỬ ĐÃ ĐẠT (PASS 100%)!\n');
