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

  // 10 nguyen lieu mua 18: 8 mon co ban + Xeng Vang + Chao Vang.
  var COMPONENTS = [
    { id: 'bf',    name: 'B.F. Sword',            vi: 'Kiem B.F.',        stat: '+10% Suc manh cong kich' },
    { id: 'bow',   name: 'Recurve Bow',           vi: 'Cung Cong',        stat: '+10% Toc do danh' },
    { id: 'rod',   name: 'Needlessly Large Rod',  vi: 'Gay Phep Lon',     stat: '+10 Suc manh phep thuat' },
    { id: 'tear',  name: 'Tear of the Goddess',   vi: 'Giot Le Nu Than',  stat: '+15 Nang luong' },
    { id: 'vest',  name: 'Chain Vest',            vi: 'Ao Choang Xich',   stat: '+20 Giap' },
    { id: 'cloak', name: 'Negatron Cloat',        vi: 'Ao Choang Negatron', stat: '+20 Khang phep' },
    { id: 'belt',  name: "Giant's Belt",          vi: 'Dai Lung Khong Lo', stat: '+150 Mau' },
    { id: 'glove', name: 'Sparring Gloves',       vi: 'Găng Đấu Tập',      stat: '+20% Tỉ lệ chí mạng' },
    { id: 'spat',  name: 'Spatula',               vi: 'Xẻng Vàng',         stat: 'Ghép Ấn tộc mùa 18' },
    { id: 'pan',   name: 'Frying Pan',             vi: 'Chảo Vàng',         stat: 'Ghép Ấn hệ mùa 18' }
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
    'bow+bow': 'Red Buff',
    'bow+rod': "Guinsoo's Rageblade",
    'bow+tear': 'Void Staff',
    'bow+vest': "Titan's Resolve",
    'bow+cloak': "Kraken's Fury",
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
    'tear+belt': 'Spirit Visage',
    'tear+glove': 'Hand of Justice',
    'vest+vest': 'Bramble Vest',
    'vest+cloak': 'Gargoyle Stoneplate',
    'vest+belt': 'Sunfire Cape',
    'vest+glove': 'Steadfast Heart',
    'cloak+cloak': "Dragon's Claw",
    'cloak+belt': 'Evenshroud',
    'cloak+glove': 'Quicksilver',
    'belt+belt': "Warmog's Armor",
    'belt+glove': "Striker's Flail",
    'glove+glove': "Thief's Gloves",
    'bf+spat': 'Fae Emblem',
    'bow+spat': 'Inferno Emblem',
    'rod+spat': 'Blossom Emblem',
    'tear+spat': 'Lunar Emblem',
    'vest+spat': 'Elderwood Emblem',
    'cloak+spat': 'Sprykin Emblem',
    'belt+spat': 'Blackthorn Emblem',
    'glove+spat': 'Primal Emblem',
    'bf+pan': 'Hunter Emblem',
    'bow+pan': 'Rapidfire Emblem',
    'rod+pan': 'Spellweaver Emblem',
    'tear+pan': 'Invoker Emblem',
    'vest+pan': 'Vanguard Emblem',
    'cloak+pan': 'Ravager Emblem',
    'belt+pan': 'Brawler Emblem',
    'glove+pan': 'Executioner Emblem',
    'spat+spat': "Tactician's Crown",
    'spat+pan': "Tactician's Cape",
    'pan+pan': "Tactician's Shield"
  };

  // Ten hien thi tieng Viet lay tu VNTFT; khoa van la ten tieng Anh cua CDragon
  // de khong pha du lieu doi hinh cu va viec ghep voi API name.
  var ITEM_NAMES_VI = {
    'Red Buff': 'Bùa Đỏ', 'Spirit Visage': 'Giáp Tâm Linh',
    "Tactician's Shield": 'Lá Chắn Chiến Thuật', "Tactician's Cape": 'Áo Choàng Chiến Thuật',
    "Kraken's Fury": 'Thịnh Nộ Thủy Quái', 'Steadfast Heart': 'Trái Tim Kiên Định',
    "Sterak's Gage": 'Móng Vuốt Sterak', 'Crownguard': 'Vương Miện Hoàng Gia',
    'Evenshroud': 'Giáp Vai Nguyệt Thần', "Nashor's Tooth": 'Nanh Nashor',
    'Adaptive Helm': 'Mũ Thích Nghi', 'Infinity Edge': 'Vô Cực Kiếm',
    "Tactician's Crown": 'Vương Miện Chiến Thuật', 'Quicksilver': 'Áo Choàng Thủy Ngân',
    'Sunfire Cape': 'Áo Choàng Lửa', 'Bramble Vest': 'Áo Choàng Gai',
    'Edge of Night': 'Áo Choàng Bóng Tối', "Dragon's Claw": 'Vuốt Rồng',
    'Gargoyle Stoneplate': 'Thú Tượng Thạch Giáp', 'Morellonomicon': 'Quỷ Thư Morello',
    "Archangel's Staff": 'Quyền Trượng Thiên Thần', "Titan's Resolve": 'Quyền Năng Khổng Lồ',
    'Ionic Spark': 'Nỏ Sét', 'Spear of Shojin': 'Ngọn Giáo Shojin',
    "Rabadon's Deathcap": 'Mũ Phù Thủy Rabadon', "Protector's Vow": 'Lời Thề Hộ Vệ',
    'Deathblade': 'Kiếm Tử Thần', 'Hextech Gunblade': 'Kiếm Súng Hextech',
    'Bloodthirster': 'Huyết Kiếm', "Thief's Gloves": 'Găng Đạo Tặc',
    'Jeweled Gauntlet': 'Găng Bảo Thạch', "Warmog's Armor": 'Giáp Máu Warmog',
    'Giant Slayer': 'Diệt Khổng Lồ', 'Void Staff': 'Trượng Hư Vô',
    "Guinsoo's Rageblade": 'Cuồng Đao Guinsoo', 'Last Whisper': 'Cung Xanh',
    "Striker's Flail": 'Chùy Đoản Côn', 'Blue Buff': 'Bùa Xanh',
    'Hand of Justice': 'Bàn Tay Công Lý',
    'Fae Emblem': 'Ấn Tiên Linh', 'Inferno Emblem': 'Ấn Hỏa Ngục',
    'Blossom Emblem': 'Ấn Hoa Linh', 'Lunar Emblem': 'Ấn Mặt Trăng',
    'Elderwood Emblem': 'Ấn Thần Rừng', 'Sprykin Emblem': 'Ấn Tinh Nghịch',
    'Blackthorn Emblem': 'Ấn Gai Đen', 'Primal Emblem': 'Ấn Nguyên Sinh',
    'Hunter Emblem': 'Ấn Thợ Săn', 'Rapidfire Emblem': 'Ấn Liên Kích',
    'Spellweaver Emblem': 'Ấn Thuật Sư', 'Invoker Emblem': 'Ấn Thuật Sĩ',
    'Vanguard Emblem': 'Ấn Vệ Quân', 'Ravager Emblem': 'Ấn Tàn Phá',
    'Brawler Emblem': 'Ấn Đấu Sĩ', 'Executioner Emblem': 'Ấn Đao Phủ'
  };

  // Mot vai goi y trang bi hay dung, hien khi bam vao o trong bang ghep.
  var ITEM_NOTES = {
    'Infinity Edge': 'Chuẩn cho xạ thủ chí mạng. Cần thêm tỉ lệ chí mạng để tối ưu sát thương.',
    "Guinsoo's Rageblade": 'Cộng dồn tốc độ đánh, hợp tướng tay dài gây sát thương duy trì.',
    'Blue Buff': 'Cho tướng năng lượng thấp (<= 50) ra chiêu liên tục.',
    'Spear of Shojin': 'Cho tướng năng lượng trung bình/cao hồi phục mana nhanh.',
    "Titan's Resolve": 'Chống chịu + sát thương hỗn hợp, hợp đấu sĩ tuyến đầu.',
    'Bramble Vest': 'Chống sát thương vật lý và chặn chí mạng.',
    "Dragon's Claw": 'Kháng phép mạnh và hồi máu tối đa, khắc chế pháp sư.',
    'Quicksilver': 'Miễn khống chế đầu trận, bảo vệ chủ lực.',
    'Ionic Spark': 'Giảm kháng phép kẻ địch xung quanh, cực hợp đi cùng pháp sư.',
    'Last Whisper': 'Giảm giáp kẻ địch khi gây sát thương vật lý, bắt buộc cho đội hình AD.',
    'Sunfire Cape': 'Gây vết thương sâu và thiêu đốt đầu trận, giữ máu rất tốt.',
    "Thief's Gloves": 'Random 2 trang bị mỗi vòng, tối ưu cho tướng phụ damage hoặc tướng 3 sao.'
  };

  // Phân loại trang bị theo nhóm thuộc tính / vai trò
  var ITEM_CATEGORIES = {
    'Deathblade': ['ad'],
    'Infinity Edge': ['ad', 'crit'],
    'Last Whisper': ['ad', 'sunder'],
    'Giant Slayer': ['ad', 'ap', 'damage'],
    'Bloodthirster': ['ad', 'sustain', 'shield'],
    "Sterak's Gage": ['ad', 'tank', 'sustain'],
    'Edge of Night': ['ad', 'sustain'],
    "Kraken's Fury": ['ad', 'as'],
    "Striker's Flail": ['ad', 'tank'],
    "Rabadon's Deathcap": ['ap'],
    'Jeweled Gauntlet': ['ap', 'crit'],
    "Archangel's Staff": ['ap', 'mana'],
    'Hextech Gunblade': ['ap', 'ad', 'sustain'],
    'Morellonomicon': ['ap', 'burn'],
    'Crownguard': ['ap', 'tank', 'shield'],
    'Void Staff': ['ap', 'as'],
    "Guinsoo's Rageblade": ['as', 'ap', 'ad'],
    'Red Buff': ['as', 'burn'],
    "Nashor's Tooth": ['as', 'ap'],
    'Blue Buff': ['mana', 'damage'],
    'Spear of Shojin': ['mana', 'ad', 'ap'],
    'Adaptive Helm': ['mana', 'tank', 'ap'],
    "Warmog's Armor": ['tank', 'hp'],
    'Bramble Vest': ['tank', 'armor'],
    "Dragon's Claw": ['tank', 'mr', 'sustain'],
    'Gargoyle Stoneplate': ['tank', 'armor', 'mr'],
    'Sunfire Cape': ['tank', 'burn'],
    "Protector's Vow": ['tank', 'mana', 'shield'],
    'Steadfast Heart': ['tank', 'damage_reduction'],
    'Evenshroud': ['tank', 'sunder'],
    'Ionic Spark': ['tank', 'shred', 'ap'],
    'Spirit Visage': ['tank', 'sustain'],
    'Quicksilver': ['as', 'cc_immunity'],
    'Hand of Justice': ['ad', 'ap', 'sustain', 'mana'],
    "Thief's Gloves": ['crit', 'random']
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
    ITEM_CATEGORIES: ITEM_CATEGORIES,
    ITEM_NAMES_VI: ITEM_NAMES_VI,
    ITEM_NOTES: ITEM_NOTES,
    ROUND_INFO: ROUND_INFO,
    LEVEL_ROADMAP: LEVEL_ROADMAP
  };
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = (typeof window !== 'undefined' ? window : globalThis).TFT.tables;
}
