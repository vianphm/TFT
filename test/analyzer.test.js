'use strict';
/** Kiem thu bo may phan tich doi hinh + ke hoach ghep do. */
const assert = require('assert');
const analyzer = require('../src/renderer/shared/analyzer.js');
const calc = require('../src/renderer/shared/calc.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (err) { console.error('  LOI ' + name + '\n      ' + err.message); process.exitCode = 1; }
}

// Set gia lap: 3 toc he, moc 2/4/6 va 2/4
const dataset = {
  traits: [
    { name: 'Sat Thu', breakpoints: [2, 4, 6] },
    { name: 'Phap Su', breakpoints: [2, 4] },
    { name: 'Ve Binh', breakpoints: [2, 4] }
  ],
  champions: [
    { name: 'A', cost: 1, traits: ['Sat Thu', 'Ve Binh'] },
    { name: 'B', cost: 1, traits: ['Sat Thu'] },
    { name: 'C', cost: 2, traits: ['Sat Thu', 'Phap Su'] },
    { name: 'D', cost: 2, traits: ['Phap Su'] },
    { name: 'E', cost: 3, traits: ['Ve Binh'] },
    { name: 'F', cost: 4, traits: ['Sat Thu', 'Phap Su'] },
    { name: 'G', cost: 5, traits: ['Ve Binh', 'Phap Su'] },
    { name: 'H', cost: 1, traits: ['Ve Binh'] }
  ]
};

console.log('\nToc he dang bat');
test('dem dung so tuong moi toc he', () => {
  const r = analyzer.traitBreakdown([{ name: 'A' }, { name: 'B' }], dataset);
  const satThu = r.all.find((x) => x.name === 'Sat Thu');
  assert.strictEqual(satThu.count, 2);
  assert.strictEqual(satThu.activeAt, 2);
  assert.strictEqual(satThu.tier, 1);
});
test('chua du thi bao con thieu may tuong', () => {
  const r = analyzer.traitBreakdown([{ name: 'A' }], dataset);
  const satThu = r.all.find((x) => x.name === 'Sat Thu');
  assert.strictEqual(satThu.tier, 0);
  assert.strictEqual(satThu.missing, 1);
  assert.strictEqual(satThu.next, 2);
});
test('trung tuong khong duoc tinh hai lan', () => {
  const r = analyzer.traitBreakdown([{ name: 'A' }, { name: 'A' }, { name: 'B' }], dataset);
  assert.strictEqual(r.all.find((x) => x.name === 'Sat Thu').count, 2);
});
test('tuong khong co trong set thi bo qua', () => {
  const r = analyzer.traitBreakdown([{ name: 'Khong Ton Tai' }], dataset);
  assert.strictEqual(r.active.length, 0);
});
test('bat moc cao hon thi diem cao hon', () => {
  const two = analyzer.traitBreakdown([{ name: 'A' }, { name: 'B' }], dataset).score;
  const four = analyzer.traitBreakdown(
    [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'F' }], dataset).score;
  assert.ok(four > two, `${four} phai lon hon ${two}`);
});

console.log('\nGoi y tuong tiep theo');
test('goi y tuong mo duoc moc moi', () => {
  const list = analyzer.suggestNextUnit([{ name: 'A' }], dataset, { limit: 3 });
  assert.ok(list.length > 0);
  assert.ok(list[0].gain > 0);
  assert.ok(list.some((x) => x.unlocks.length > 0));
});
test('khong goi y tuong da co trong doi hinh', () => {
  const list = analyzer.suggestNextUnit([{ name: 'A' }], dataset, { limit: 8 });
  assert.ok(!list.some((x) => x.name === 'A'));
});
test('gioi han gia tuong duoc ton trong', () => {
  const list = analyzer.suggestNextUnit([{ name: 'A' }], dataset, { maxCost: 2, limit: 8 });
  assert.ok(list.every((x) => x.cost <= 2));
});

console.log('\nToi uu doi hinh');
test('tra ve dung so o yeu cau', () => {
  const r = analyzer.optimizeComp(dataset, { size: 5 });
  assert.strictEqual(r.units.length, 5);
});
test('khong lap tuong', () => {
  const r = analyzer.optimizeComp(dataset, { size: 6 });
  const names = r.units.map((u) => u.name);
  assert.strictEqual(new Set(names).size, names.length);
});
test('giu tuong bat buoc', () => {
  const r = analyzer.optimizeComp(dataset, { size: 4, required: ['G'] });
  assert.ok(r.units.some((u) => u.name === 'G'));
});
test('loai tuong bi cam va tuong qua dat', () => {
  const r = analyzer.optimizeComp(dataset, { size: 4, exclude: ['A'], maxCost: 3 });
  assert.ok(!r.units.some((u) => u.name === 'A'));
  assert.ok(r.units.every((u) => u.cost <= 3));
});
test('doi hinh toi uu bat duoc it nhat mot moc', () => {
  const r = analyzer.optimizeComp(dataset, { size: 6 });
  assert.ok(r.traits.active.length >= 1);
  assert.ok(r.score > 0);
});
test('doi hinh toi uu khong te hon doi hinh ngau nhien cung co', () => {
  const best = analyzer.optimizeComp(dataset, { size: 5 }).score;
  const random = analyzer.traitBreakdown(
    [{ name: 'A' }, { name: 'D' }, { name: 'E' }, { name: 'H' }, { name: 'B' }], dataset).score;
  assert.ok(best >= random, `${best} phai >= ${random}`);
});
test('kho tuong rong thi tra ve rong, khong nem loi', () => {
  const r = analyzer.optimizeComp({ champions: [], traits: [] }, { size: 5 });
  assert.deepStrictEqual(r.units, []);
});

console.log('\nKe hoach ghep do');
test('ghep du bo do uu tien', () => {
  const plan = calc.bestItemPlan(['bf', 'glove', 'tear', 'tear'], ['Infinity Edge', 'Blue Buff']);
  assert.strictEqual(plan.crafted.length, 2);
  assert.strictEqual(plan.missing.length, 0);
  assert.strictEqual(plan.leftover.length, 0);
});
test('bao dung mon con thieu', () => {
  const plan = calc.bestItemPlan(['bf'], ['Infinity Edge']);
  assert.strictEqual(plan.crafted.length, 0);
  assert.deepStrictEqual(plan.missing[0].need, ['glove']);
});
test('mon do uu tien truoc duoc ghep truoc', () => {
  const plan = calc.bestItemPlan(['bf', 'glove'], ['Infinity Edge', 'Hextech Gunblade']);
  assert.strictEqual(plan.crafted[0].item, 'Infinity Edge');
  assert.strictEqual(plan.missing[0].item, 'Hextech Gunblade');
});
test('mon co ban thua duoc bao lai', () => {
  const plan = calc.bestItemPlan(['bf', 'glove', 'belt'], ['Infinity Edge']);
  assert.deepStrictEqual(plan.leftover, ['belt']);
});

console.log(`\n${passed} phep thu da qua.\n`);
