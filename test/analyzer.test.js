'use strict';
/** Kiem thu bo may phan tich doi hinh + ke hoach ghep do. */
const assert = require('assert');
const analyzer = require('../src/renderer/shared/analyzer.js');
const calc = require('../src/renderer/shared/calc.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (err) { failed++; console.error('  LOI ' + name + '\n      ' + err.message); process.exitCode = 1; }
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

console.log('\nCham diem nhanh dung trong vong lap toi uu');
test('scoreUnits cho ket qua giong het traitBreakdown', () => {
  const units = [dataset.champions[0], dataset.champions[2], dataset.champions[5], dataset.champions[6]];
  const slow = analyzer.traitBreakdown(units, dataset).score;
  const fast = analyzer.scoreUnits(units, analyzer.prepare(dataset),
    Object.assign({}, analyzer.DEFAULT_WEIGHTS), null);
  assert.ok(Math.abs(slow - fast) < 1e-9, `${slow} khac ${fast}`);
});
test('scoreUnits cong diem cho toc he duoc chi dinh', () => {
  const units = [dataset.champions[0], dataset.champions[1]];
  const prep = analyzer.prepare(dataset);
  const plain = analyzer.scoreUnits(units, prep, Object.assign({}, analyzer.DEFAULT_WEIGHTS), null);
  const wanted = analyzer.scoreUnits(units, prep, Object.assign({}, analyzer.DEFAULT_WEIGHTS), { 'sat thu': true });
  assert.ok(wanted > plain);
});
test('ep choi mot toc he thi doi hinh toi uu phai bat toc he do', () => {
  const out = analyzer.optimizeComp(dataset, { size: 4, wantTraits: ['Ve Binh'] });
  const veBinh = out.traits.active.find((t) => t.name === 'Ve Binh');
  assert.ok(veBinh, 'phai bat duoc Ve Binh: ' + out.units.map((u) => u.name).join(','));
});

console.log('\nNen chuyen doi hinh nao');
const compLib = [
  { id: 'a', name: 'Dang danh do', units: [{ name: 'A', star: 3 }, { name: 'B', star: 3 }, { name: 'C', star: 2 }] },
  { id: 'b', name: 'Lam lai tu dau', units: [{ name: 'E', star: 2 }, { name: 'F', star: 2 }, { name: 'G', star: 2 }] }
];
test('doi hinh da co san nhieu tuong duoc xep tren', () => {
  const out = analyzer.pivotSuggestions([{ name: 'A' }, { name: 'B' }], compLib, dataset, { level: 8 });
  assert.strictEqual(out[0].id, 'a');
  assert.ok(out[0].rank > out[1].rank);
});
test('tinh dung ti le tuong da co va tuong con thieu', () => {
  const out = analyzer.pivotSuggestions([{ name: 'A' }, { name: 'B' }], compLib, dataset, { level: 8 });
  const first = out.find((x) => x.id === 'a');
  assert.strictEqual(first.overlap, 67);
  assert.deepStrictEqual(first.missing, ['C']);
});
test('gom tuong 3 sao ton nhieu vang hon 2 sao', () => {
  const cheap = analyzer.pivotSuggestions([], [{ id: 'x', name: 'x', units: [{ name: 'A', star: 2 }] }], dataset, { level: 8 });
  const pricey = analyzer.pivotSuggestions([], [{ id: 'y', name: 'y', units: [{ name: 'A', star: 3 }] }], dataset, { level: 8 });
  assert.ok(pricey[0].estGold > cheap[0].estGold);
});
test('thu vien rong thi tra ve rong', () => {
  assert.deepStrictEqual(analyzer.pivotSuggestions([{ name: 'A' }], [], dataset, {}), []);
});

console.log('\nRoll hay len cap');
test('ba phuong an deu co xac suat trong khoang 0..1', () => {
  const r = calc.rollVsLevel({ gold: 50, level: 7, xp: 0, cost: 4, copiesNeeded: 2 });
  assert.strictEqual(r.options.length, 3);
  r.options.forEach((o) => {
    assert.ok(o.probability >= 0 && o.probability <= 1, o.label + ': ' + o.probability);
  });
});
test('len cap 8 tu 0 XP ton 48 vang nen gan het vang de roll', () => {
  const r = calc.rollVsLevel({ gold: 50, level: 7, xp: 0, cost: 4, copiesNeeded: 1 });
  const lv = r.options.find((o) => o.key === 'level');
  assert.strictEqual(lv.levelGold, 48);
  assert.strictEqual(lv.rolls, 1);
});
test('gan du XP thi len cap roi roll an dut roll o cap thap', () => {
  // Con 4 XP nua la len 8 -> chi ton 4 vang, doi lai ti le tuong 4 vang tu 15% len 22%
  const r = calc.rollVsLevel({ gold: 60, level: 7, xp: 44, cost: 4, copiesNeeded: 2 });
  const now = r.options.find((o) => o.key === 'roll');
  const lv = r.options.find((o) => o.key === 'level');
  assert.strictEqual(lv.levelGold, 4);
  assert.ok(lv.probability > now.probability, `${lv.probability} phai > ${now.probability}`);
  assert.strictEqual(r.best, 'level');
});
test('tu 0 XP thi 48 vang tien len cap dat hon la roll them', () => {
  // Ket qua do duoc: voi 60-120 vang, roll thang o cap 7 van hon len 8 truoc;
  // phai tren khoang 150 vang len cap moi bat dau co loi.
  const little = calc.rollVsLevel({ gold: 60, level: 7, xp: 0, cost: 4, copiesNeeded: 2, copiesTakenByOthers: 3 });
  const rollSmall = little.options.find((o) => o.key === 'roll');
  const lvSmall = little.options.find((o) => o.key === 'level');
  assert.ok(rollSmall.probability > lvSmall.probability,
    `${rollSmall.probability} phai > ${lvSmall.probability}`);
  const lots = calc.rollVsLevel({ gold: 200, level: 7, xp: 0, cost: 4, copiesNeeded: 2, copiesTakenByOthers: 3 });
  const lvBig = lots.options.find((o) => o.key === 'level');
  const rollBig = lots.options.find((o) => o.key === 'roll');
  assert.ok(lvBig.probability > rollBig.probability);
});
test('giu vang lai thi so lan roll giam', () => {
  const all = calc.rollVsLevel({ gold: 60, level: 8, cost: 4, copiesNeeded: 1, keepGold: 0 });
  const keep = calc.rollVsLevel({ gold: 60, level: 8, cost: 4, copiesNeeded: 1, keepGold: 30 });
  assert.ok(keep.options[0].rolls < all.options[0].rolls);
});
test('cho mot vong thi doi thu vet bot ban sao', () => {
  const safe = calc.rollVsLevel({ gold: 40, level: 8, cost: 4, copiesNeeded: 1, expectedExtraTaken: 0 });
  const risky = calc.rollVsLevel({ gold: 40, level: 8, cost: 4, copiesNeeded: 1, expectedExtraTaken: 4 });
  const a = safe.options.find((o) => o.key === 'wait').probability;
  const b = risky.options.find((o) => o.key === 'wait').probability;
  assert.ok(b < a);
});

console.log('\nChia trang bi cho tung tuong');
const board = [
  { name: 'Carry', carry: true, items: ['Infinity Edge', 'Last Whisper'] },
  { name: 'Tank', carry: false, items: ['Bramble Vest'] }
];
test('carry duoc uu tien nhan do truoc', () => {
  const plan = calc.assignItems(board, ['bf', 'glove', 'vest', 'vest']);
  assert.strictEqual(plan.units[0].unit, 'Carry');
  assert.strictEqual(plan.units[0].done[0].item, 'Infinity Edge');
});
test('bao dung tuong nao con thieu do gi', () => {
  const plan = calc.assignItems(board, ['bf', 'glove']);
  const tank = plan.units.find((u) => u.unit === 'Tank');
  assert.strictEqual(tank.done.length, 0);
  assert.strictEqual(tank.missing[0].item, 'Bramble Vest');
});
test('mon co ban thua duoc tra ve', () => {
  const plan = calc.assignItems(board, ['bf', 'glove', 'vest', 'vest', 'belt']);
  assert.deepStrictEqual(plan.leftover, ['belt']);
});
test('khong dung chung mot mon cho hai tuong', () => {
  const plan = calc.assignItems(
    [{ name: 'A', carry: true, items: ['Blue Buff'] }, { name: 'B', items: ['Blue Buff'] }],
    ['tear', 'tear']
  );
  assert.strictEqual(plan.units[0].done.length, 1);
  assert.strictEqual(plan.units[1].done.length, 0);
});

console.log('\nGoi y an va toi uu theo trang thai tran');
test('uu tien an ghep duoc va kich moc toc he', () => {
  const withEmblems = Object.assign({}, dataset, {
    emblems: [
      { name: 'An Sat Thu', trait: 'Sat Thu', composition: ['spat', 'bf'] },
      { name: 'An Ve Binh', trait: 'Ve Binh', composition: ['pan', 'vest'] }
    ]
  });
  const rows = analyzer.recommendEmblems({
    units: [{ name: 'A' }, { name: 'E' }],
    components: ['spat', 'bf']
  }, withEmblems);
  const assassin = rows.find((row) => row.trait === 'Sat Thu');
  assert.ok(assassin.craftable);
  assert.ok(assassin.holder);
  assert.ok(assassin.scoreGain > 0);
});
test('tra ve mot goi phan tich day du theo cap va tuong dang giu', () => {
  const result = analyzer.optimizeForState({
    level: 5,
    gold: 40,
    units: [{ name: 'A', carry: true }, { name: 'B' }],
    components: []
  }, dataset);
  assert.strictEqual(result.strongest.units.length, 5);
  assert.ok(result.nextUnits.length > 0);
  assert.deepStrictEqual(result.assumptions.required, ['A']);
});

console.log('\nXep hang va danh gia Loi (Augments)');
test('xep hang loi dau tran (2-1) uu tien loi kinh te/xp', () => {
  const augs = [
    { name: 'Kinh te dau tran', tier: 'silver', tags: ['econ'], desc: 'Nhan 20 vang' },
    { name: 'Giao tranh', tier: 'silver', tags: ['combat'], desc: 'Tang 10% sat thuong' }
  ];
  const ranked = analyzer.rankAugments(augs, { stage: '2-1', hp: 100, gold: 10, board: [] }, dataset);
  assert.strictEqual(ranked[0].augment.name, 'Kinh te dau tran');
  assert.ok(ranked[0].score > ranked[1].score);
  assert.ok(ranked[0].reason.includes('2-1'));
});

test('xep hang loi cuoi tran khi mau thap (<40) uu tien giao tranh va tranh loi kinh te cham', () => {
  const augs = [
    { name: 'Kinh te cham', tier: 'gold', tags: ['econ'], desc: 'Moi vong nhan lai' },
    { name: 'Giao tranh ngay', tier: 'gold', tags: ['combat'], desc: 'Tang 30% giap va khang phep' }
  ];
  const ranked = analyzer.rankAugments(augs, { stage: '4-2', hp: 30, gold: 20, board: [{ name: 'A' }] }, dataset);
  assert.strictEqual(ranked[0].augment.name, 'Giao tranh ngay');
  assert.ok(ranked[0].score >= 70);
  assert.ok(ranked[1].score < ranked[0].score);
  assert.ok(ranked[1].reason.includes('Máu quá thấp') || ranked[1].reason.includes('Máu thấp'));
});

test('loi kich hoat dung toc he dang choi duoc diem cao', () => {
  const augs = [
    { name: 'An Ve Binh', tier: 'gold', tags: ['emblem'], associatedTraits: ['Ve Binh'], desc: 'Nhan 1 An Ve Binh' },
    { name: 'An Sat Thu', tier: 'gold', tags: ['emblem'], associatedTraits: ['Sat Thu'], desc: 'Nhan 1 An Sat Thu' }
  ];
  const ranked = analyzer.rankAugments(augs, { stage: '3-2', hp: 75, board: [{ name: 'C', traits: ['Ve Binh'] }] }, dataset);
  assert.strictEqual(ranked[0].augment.name, 'An Ve Binh');
  assert.ok(ranked[0].score > ranked[1].score);
  assert.ok(ranked[0].reason.includes('Ve Binh') || ranked[0].reason.includes('ve binh'));
});

console.log('\nGoi y doi hinh dau game');
test('goi y chuoi thang khi co tuong 2 sao va do slam duoc', () => {
  const board = [{ name: 'Leona', star: 2 }, { name: 'Shen', star: 2 }, { name: 'Tristana', star: 1 }];
  const components = ['vest', 'belt']; // Ghep Sunfire Cape
  const out = analyzer.suggestEarlyGameComps(board, [], components, dataset);
  assert.strictEqual(out.strategy.type, 'win_streak');
  assert.ok(out.boardStrength >= 45);
  assert.strictEqual(out.suggestedArchetypes[0].name, 'Vệ Quân + Xạ Thủ (AD/Tank)');
  assert.ok(out.suggestedArchetypes[0].score > 50);
});

test('goi y chuoi thua/tich tien khi bai yeu toan 1 sao va khong co do', () => {
  const board = [{ name: 'Kobuko', star: 1 }];
  const out = analyzer.suggestEarlyGameComps(board, [], [], dataset);
  assert.strictEqual(out.strategy.type, 'loss_streak');
  assert.ok(out.strategy.levelAdvice.includes('Không up cấp sớm'));
});

console.log('\nXep hang Wisp / Linh hon');
test('xep hang wisp theo mau thap (<35) uu tien linh hon giao tranh, tranh mat mau', () => {
  const wisps = [
    { id: 'sinister-deal', name: 'Sinister Deal', cost: 0, category: 'risky' },
    { id: 'prolific-power', name: 'Prolific Power', cost: 0, category: 'combat' }
  ];
  const ranked = analyzer.rankWisps(wisps, { hp: 20, gold: 20, stage: '4-2' });
  assert.strictEqual(ranked[0].wisp.id, 'prolific-power');
  assert.ok(ranked[0].score > ranked[1].score);
  assert.strictEqual(ranked[1].recommendation, 'skip');
  assert.ok(ranked[1].reason.includes('nguy hiểm'));
});

test('wisp 0 vang duoc uu tien khi it tien', () => {
  const wisps = [
    { id: 'early-fix', name: 'Early Fix', cost: 0, category: 'items' },
    { id: 'artifactinate', name: 'Artifactinate', cost: 2, category: 'items' }
  ];
  const ranked = analyzer.rankWisps(wisps, { hp: 80, gold: 0, stage: '2-3' });
  assert.strictEqual(ranked[0].wisp.id, 'early-fix');
  assert.ok(ranked[0].score > ranked[1].score);
});

console.log('\nBo khuyen nghi tong hop');
test('generateComprehensiveAdvice tra ve day du loi khuyen comp, shop, do, loi, wisp va kinh te', () => {
  const compList = [
    { id: 'c1', name: 'Cassiopeia Comp', units: [{ name: 'Cassiopeia', carry: true, items: ['Blue Buff'] }, { name: 'Shen' }] }
  ];
  const gameState = {
    board: [{ name: 'Cassiopeia', star: 2 }],
    bench: [{ name: 'Shen', star: 1 }],
    shop: ['Cassiopeia', 'Leona', 'Yasuo'],
    components: ['tear', 'tear'],
    hp: 80,
    gold: 50,
    round: '3-2'
  };
  const advice = analyzer.generateComprehensiveAdvice(gameState, dataset, compList);
  assert.strictEqual(advice.targetComp.name, 'Cassiopeia Comp');
  assert.strictEqual(advice.shopAdvice[0].name, 'Cassiopeia');
  assert.strictEqual(advice.shopAdvice[0].action, 'buy');
  assert.strictEqual(advice.econDecision.action, 'slow_roll_or_level');
});

console.log('\nPhan tich Lobby & Soi doi thu it trung bai');
test('analyzeLobbyComps uu tien doi hinh tier cao khong bi tranh trong lobby', () => {
  const comps = [
    { name: 'Comp A', tier: 'S', units: [{ name: 'Cassiopeia', carry: true }] },
    { name: 'Comp B', tier: 'S', units: [{ name: 'Tristana', carry: true }] },
    { name: 'Comp C', tier: 'A', units: [{ name: 'Veigar', carry: true }] }
  ];
  // 3 nha doi thu dang choi Comp A (Cassiopeia), khong ai choi Comp B (Tristana)
  const opponents = [
    { compName: 'Comp A', carry: 'Cassiopeia' },
    { compName: 'Comp A', carry: 'Cassiopeia' },
    { compName: 'Comp A', carry: 'Cassiopeia' }
  ];

  const analysis = analyzer.analyzeLobbyComps(opponents, comps, dataset);
  assert.strictEqual(analysis.topRecommendedComps[0].comp.name, 'Comp B');
  assert.strictEqual(analysis.topRecommendedComps[0].isFree, true);
  assert.strictEqual(analysis.freeComps.length, 2); // Comp B & Comp C
  assert.ok(analysis.topRecommendedComps[0].lobbyScore > analysis.allEvaluatedComps.find(c => c.comp.name === 'Comp A').lobbyScore);
});

console.log(`\n${passed} phep thu da qua, ${failed} phep thu LOI.\n`);
if (failed) console.error(`==> CO ${failed} PHEP THU KHONG QUA <==\n`);





