/* eslint-disable no-var */
/**
 * Bang so lieu TFT dung chung cho overlay va dashboard.
 * Cac bang nay theo chuan cac set gan day; neu Riot doi so, sua truc tiep o day
 * hoac trong file config.json (muc "tables") ma khong can build lai app.
 */
(function (global) {
  'use strict';

  // Ti le xuat hien theo cap (level -> [gia 1, 2, 3, 4, 5] tinh theo %)
  var SHOP_ODDS = {
    1:  [100, 0, 0, 0, 0],
    2:  [100, 0, 0, 0, 0],
    3:  [75, 25, 0, 0, 0],
    4:  [55, 30, 15, 0, 0],
    5:  [45, 33, 20, 2, 0],
    6:  [30, 40, 25, 5, 0],
    7:  [19, 30, 35, 15, 1],
    8:  [18, 25, 32, 22, 3],
    9:  [10, 20, 25, 35, 10],
    10: [5, 10, 20, 40, 25],
    11: [1, 2, 12, 50, 35]
  };

  // Kho tuong chung cua ca ban (cost -> so ban sao moi tuong / so tuong cung gia)
  var POOL = {
    1: { copies: 22, champions: 14 },
    2: { copies: 20, champions: 13 },
    3: { copies: 17, champions: 13 },
    4: { copies: 10, champions: 12 },
    5: { copies: 9,  champions: 8 }
  };

  // XP can de len cap tiep theo (tu cap N len N+1)
  var XP_TO_NEXT = { 1: 2, 2: 2, 3: 6, 4: 10, 5: 20, 6: 36, 7: 48, 8: 76, 9: 84, 10: 100 };
  var XP_PER_BUY = 4;      // 4 vang = 4 XP
  var GOLD_PER_BUY = 4;
  var XP_PER_ROUND = 2;    // moi vong tu cong 2 XP
  var ROLL_COST = 2;

  // Kinh te
  var BASE_INCOME = 5;
  var WIN_BONUS = 1;
  var MAX_INTEREST = 5;
  var STREAK_TABLE = [
    { min: 5, gold: 3 },
    { min: 4, gold: 2 },
    { min: 2, gold: 1 },
    { min: 0, gold: 0 }
  ];

  // 9 mon do co ban
  var COMPONENTS = [
    { id: 'bf',    name: 'B.F. Sword',            vi: 'Kiem B.F.',        stat: '+10% Suc manh cong kich' },
    { id: 'bow',   name: 'Recurve Bow',           vi: 'Cung Cong',        stat: '+10% Toc do danh' },
    { id: 'rod',   name: 'Needlessly Large Rod',  vi: 'Gay Phep Lon',     stat: '+10 Suc manh phep thuat' },
    { id: 'tear',  name: 'Tear of the Goddess',   vi: 'Giot Le Nu Than',  stat: '+15 Nang luong' },
    { id: 'vest',  name: 'Chain Vest',            vi: 'Ao Choang Xich',   stat: '+20 Giap' },
    { id: 'cloak', name: 'Negatron Cloak',        vi: 'Ao Choang Negatron', stat: '+20 Khang phep' },
    { id: 'belt',  name: "Giant's Belt",          vi: 'Dai Lung Khong Lo', stat: '+150 Mau' },
    { id: 'glove', name: 'Sparring Gloves',       vi: 'Gang Tay Tap Luyen', stat: '+5% Chi mang, +5% Ne' },
    { id: 'spat',  name: 'Spatula',               vi: 'Xeng',             stat: 'Ghep ra Bieu tuong toc' }
  ];

  // Cong thuc ghep. Khoa la 2 id sap xep theo thu tu trong COMPONENTS.
  var RECIPES = {
    'bf+bf': 'Deathblade',
    'bf+bow': 'Giant Slayer',
    'bf+rod': 'Hextech Gunblade',
    'bf+tear': 'Spear of Shojin',
    'bf+vest': 'Edge of Night',
    'bf+cloak': 'Bloodthirster',
    'bf+belt': "Sterak's Gage",
    'bf+glove': 'Infinity Edge',
    'bow+bow': 'Rapid Firecannon',
    'bow+rod': "Guinsoo's Rageblade",
    'bow+tear': 'Statikk Shiv',
    'bow+vest': "Titan's Resolve",
    'bow+cloak': "Runaan's Hurricane",
    'bow+belt': "Nashor's Tooth",
    'bow+glove': 'Last Whisper',
    'rod+rod': "Rabadon's Deathcap",
    'rod+tear': "Archangel's Staff",
    'rod+vest': 'Crownguard',
    'rod+cloak': 'Ionic Spark',
    'rod+belt': 'Morellonomicon',
    'rod+glove': 'Jeweled Gauntlet',
    'tear+tear': 'Blue Buff',
    'tear+vest': "Protector's Vow",
    'tear+cloak': 'Adaptive Helm',
    'tear+belt': 'Redemption',
    'tear+glove': 'Hand of Justice',
    'vest+vest': 'Bramble Vest',
    'vest+cloak': 'Gargoyle Stoneplate',
    'vest+belt': 'Sunfire Cape',
    'vest+glove': 'Steadfast Heart',
    'cloak+cloak': "Dragon's Claw",
    'cloak+belt': 'Evenshroud',
    'cloak+glove': 'Quicksilver',
    'belt+belt': "Warmog's Armor",
    'belt+glove': 'Guardbreaker',
    'glove+glove': "Thief's Gloves",
    'bf+spat': 'Bieu tuong (tuy set)',
    'bow+spat': 'Bieu tuong (tuy set)',
    'rod+spat': 'Bieu tuong (tuy set)',
    'tear+spat': 'Bieu tuong (tuy set)',
    'vest+spat': 'Bieu tuong (tuy set)',
    'cloak+spat': 'Bieu tuong (tuy set)',
    'belt+spat': 'Bieu tuong (tuy set)',
    'glove+spat': 'Bieu tuong (tuy set)',
    'spat+spat': 'Force of Nature'
  };

  // Mot vai goi y trang bi hay dung, hien khi bam vao o trong bang ghep.
  var ITEM_NOTES = {
    'Infinity Edge': 'Chuan cho xa thu chi mang. Can them chi mang de khong phi.',
    "Guinsoo's Rageblade": 'Cong don toc do danh, hop tuong danh nhanh len 3 sao.',
    'Blue Buff': 'Cho phap su ton it nang luong, giam thoi gian len chieu.',
    "Titan's Resolve": 'Chong chiu + sat thuong, hop tuong dung tuyen dau lau.',
    'Bramble Vest': 'Chan sat thuong chi mang, khac che doi thuong.',
    "Dragon's Claw": 'Chong phap su, dung khi doi thu danh phep manh.',
    'Quicksilver': 'Mien khong che dau tran, cuu carry manh.',
    'Redemption': 'Hoi mau vung, tot cho do dan dung tuyen.',
    'Ionic Spark': 'Giam khang phep ca vung, khac che doi phap su.',
    "Thief's Gloves": 'Random 2 trang bi moi vong, hop tuong 1 vang len 3 sao.'
  };

  // Cau truc van dau: giai doan 2..7, moi giai doan 7 vong (x-4 la vong chon do).
  var ROUND_INFO = {
    augmentRounds: ['2-1', '3-2', '4-2'],
    carouselRound: 4,
    pveRound: 7,
    roundsPerStage: 7,
    stage1Rounds: 4,
    planningSeconds: 30
  };

  // Lo trinh len cap tham khao (sua duoc trong dashboard).
  var LEVEL_ROADMAP = [
    { round: '2-1', level: 4, note: 'Nhan lo bai tang dau, giu mau, gom do' },
    { round: '2-5', level: 5, note: 'Len 5 neu dang thang chuoi' },
    { round: '3-2', level: 6, note: 'Len 6 truoc lo bai tang thu hai' },
    { round: '4-1', level: 7, note: 'Len 7, chuan bi roll tim carry 4 vang' },
    { round: '4-5', level: 8, note: 'Len 8 va roll xuong ~20-30 vang' },
    { round: '5-5', level: 9, note: 'Len 9 khi doi hinh da on va con >50 vang' }
  ];

  global.TFT = global.TFT || {};
  global.TFT.tables = {
    SHOP_ODDS: SHOP_ODDS,
    POOL: POOL,
    XP_TO_NEXT: XP_TO_NEXT,
    XP_PER_BUY: XP_PER_BUY,
    GOLD_PER_BUY: GOLD_PER_BUY,
    XP_PER_ROUND: XP_PER_ROUND,
    ROLL_COST: ROLL_COST,
    BASE_INCOME: BASE_INCOME,
    WIN_BONUS: WIN_BONUS,
    MAX_INTEREST: MAX_INTEREST,
    STREAK_TABLE: STREAK_TABLE,
    COMPONENTS: COMPONENTS,
    RECIPES: RECIPES,
    ITEM_NOTES: ITEM_NOTES,
    ROUND_INFO: ROUND_INFO,
    LEVEL_ROADMAP: LEVEL_ROADMAP
  };
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = (typeof window !== 'undefined' ? window : globalThis).TFT.tables;
}
