'use strict';
/**
 * Kiem thu logic tinh toan - chay bang: npm test  (khong can Electron)
 */
const assert = require('assert');
const calc = require('../src/renderer/shared/calc.js');
const tables = require('../src/renderer/shared/tables.js');
const importer = require('../src/main/comp-importer.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (err) {
    failed++;
    console.error('  LOI ' + name + '\n      ' + err.message);
    process.exitCode = 1;
  }
}
const near = (a, b, eps) => assert.ok(Math.abs(a - b) < (eps || 1e-9), `${a} != ${b}`);

console.log('\nTi le cua hang');
test('cap 8 co 22% ra tuong 4 vang', () => near(calc.shopOdds(8)[3], 0.22));
test('cap ngoai bang bi kep lai', () => assert.deepStrictEqual(calc.shopOdds(99), calc.shopOdds(11)));
test('tong ti le moi cap = 100%', () => {
  Object.keys(tables.SHOP_ODDS).forEach((lv) => {
    near(calc.shopOdds(lv).reduce((a, b) => a + b, 0), 1, 1e-9);
  });
});

console.log('\nXac suat roll');
test('o cua hang: 22% * 10/120 khi chua ai lay', () => {
  const p = calc.slotProbability({ cost: 4, level: 8, copiesOwnedByYou: 0, copiesTakenByOthers: 0, championsOutOfPool: 0 });
  near(p, 0.22 * (10 / 120), 1e-12);
});
test('minh cam 2 ban sao thi kho con 8', () => {
  const p = calc.slotProbability({ cost: 4, level: 8, copiesOwnedByYou: 2 });
  near(p, 0.22 * (8 / 118), 1e-12);
});
test('het sach ban sao thi xac suat = 0', () => {
  near(calc.slotProbability({ cost: 4, level: 8, copiesOwnedByYou: 10 }), 0);
});
test('roll cang nhieu, xac suat cang cao va khong vuot 1', () => {
  const a = calc.rollOutcome({ cost: 4, level: 8, rolls: 5, copiesNeeded: 1 });
  const b = calc.rollOutcome({ cost: 4, level: 8, rolls: 20, copiesNeeded: 1 });
  assert.ok(b.probabilityAtLeastOne > a.probabilityAtLeastOne);
  assert.ok(b.probabilityAtLeastOne <= 1);
  assert.strictEqual(b.goldSpent, 40);
});
test('P(>=1) khop cong thuc nhi thuc', () => {
  const o = calc.rollOutcome({ cost: 4, level: 8, rolls: 10, copiesNeeded: 1 });
  near(o.probabilityAtLeastOne, o.probabilityAtLeastNeeded, 1e-12);
});
test('can 3 ban sao thi kho hon can 1', () => {
  const o = calc.rollOutcome({ cost: 4, level: 8, rolls: 10, copiesNeeded: 3 });
  assert.ok(o.probabilityAtLeastNeeded < o.probabilityAtLeastOne);
});
test('binomialAtLeast(n,p,0) = 1', () => near(calc.binomialAtLeast(10, 0.3, 0), 1));
test('vang de dat 75% > vang de dat 50%', () => {
  const opts = { cost: 4, level: 8 };
  assert.ok(calc.goldForConfidence(opts, 0.75) > calc.goldForConfidence(opts, 0.5));
});

console.log('\nKinh te');
test('lai toi da 5 vang', () => { assert.strictEqual(calc.interest(52), 5); assert.strictEqual(calc.interest(120), 5); });
test('lai 3 vang khi co 30-39', () => assert.strictEqual(calc.interest(37), 3));
test('chuoi 5 tran = 3 vang', () => assert.strictEqual(calc.streakGold(5), 3));
test('chuoi thua cung tinh', () => assert.strictEqual(calc.streakGold(-4), 2));
test('thu nhap vong sau', () => {
  const r = calc.incomeNextRound({ gold: 50, streak: 5, win: true });
  assert.strictEqual(r.total, 5 + 5 + 3 + 1);
});
test('du bao vang tang dan khi khong tieu', () => {
  const rows = calc.projectGold({ gold: 20, streak: 0, win: false, rounds: 3, spendPerRound: 0 });
  assert.strictEqual(rows.length, 3);
  assert.ok(rows[2].gold > rows[0].gold);
});

console.log('\nXP / len cap');
test('tu cap 7 (0 xp) len 8 het 48 xp = 48 vang', () => {
  const r = calc.levelCost(7, 0, 8);
  assert.strictEqual(r.xp, 48);
  assert.strictEqual(r.gold, 48);
});
test('da co xp thi tru di', () => assert.strictEqual(calc.levelCost(7, 20, 8).xp, 28));
test('muc tieu thap hon cap hien tai = 0', () => assert.strictEqual(calc.levelCost(8, 0, 7).gold, 0));
test('cong don nhieu cap', () => {
  assert.strictEqual(calc.levelCost(7, 0, 9).xp, 48 + 76);
});

console.log('\nTrang bi');
test('BF + Gang = Vo Cuc Kiem', () => assert.strictEqual(calc.combine('bf', 'glove'), 'Infinity Edge'));
test('ghep khong phu thuoc thu tu', () => assert.strictEqual(calc.combine('glove', 'bf'), calc.combine('bf', 'glove')));
test('du 45 cong thuc', () => assert.strictEqual(Object.keys(tables.RECIPES).length, 45));
test('luoi ghep 9x9', () => {
  const grid = calc.recipeGrid();
  assert.strictEqual(grid.length, 9);
  assert.strictEqual(grid[0].cells.length, 9);
  assert.ok(grid.every((row) => row.cells.every((c) => c.item)));
});
test('goi y do ghep duoc tu tui do', () => {
  const list = calc.craftable(['bf', 'glove', 'bow']);
  const names = list.map((x) => x.item);
  assert.ok(names.includes('Infinity Edge'));
  assert.ok(names.includes('Giant Slayer'));
  assert.strictEqual(list.length, 3);
});
test('thieu gi de co Blue Buff', () => {
  const r = calc.missingFor('Blue Buff', ['tear']);
  assert.deepStrictEqual(r.missing, ['tear']);
});

console.log('\nVong dau');
test('doc duoc ma vong', () => assert.deepStrictEqual(calc.parseRound('4-2'), { stage: 4, round: 2 }));
test('sau 2-7 la 3-1', () => assert.strictEqual(calc.upcomingRounds('2-7', 1)[0].label, '3-1'));
test('danh dau vong chon do va lo bai tang', () => {
  const rounds = calc.upcomingRounds('3-1', 6);
  assert.ok(rounds.find((r) => r.label === '3-2').augment);
  assert.ok(rounds.find((r) => r.label === '3-4').carousel);
  assert.ok(rounds.find((r) => r.label === '3-7').pve);
});

console.log('\nNhap doi hinh');
test('nhan ra tuong va trang bi tu HTML', () => {
  const dataset = { champions: [{ name: 'Ahri', cost: 4 }, { name: 'Yasuo', cost: 2 }, { name: 'Garen', cost: 1 }, { name: 'Lux', cost: 3 }] };
  const comps = importer.importFromText(
    "<h2>Doi hinh A</h2><p>Ahri cam Blue Buff. Yasuo di Titan's Resolve. Garen. Lux.</p>", dataset);
  assert.strictEqual(comps.length, 1);
  assert.strictEqual(comps[0].units.length, 4);
  assert.deepStrictEqual(comps[0].units[0].items, ['Blue Buff']);
  assert.strictEqual(comps[0].units[0].carry, true);
});
test('nhan JSON xuat tu app', () => {
  const comps = importer.importFromText(JSON.stringify([{ name: 'Test', units: [{ name: 'A', cost: 2 }] }]), { champions: [{ name: 'A', cost: 1 }] });
  assert.strictEqual(comps[0].name, 'Test');
});
test('bao loi ro rang khi chua co du lieu set', () => {
  assert.throws(() => importer.importFromText('Ahri Yasuo Garen Lux', { champions: [] }), /Dong bo du lieu/);
});

console.log(`\n${passed} phep thu da qua, ${failed} phep thu LOI.\n`);
if (failed) console.error(`==> CO ${failed} PHEP THU KHONG QUA <==\n`);
