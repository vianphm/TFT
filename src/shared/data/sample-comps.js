'use strict';

/**
 * Doi hinh mau di kem app.
 * Day la KHUNG (template) theo vai tro, khong phai danh sach tuong cua mot set cu the -
 * moi set Riot doi tuong nen ten tuong that duoc dien vao sau khi ban bam "Dong bo du lieu"
 * hoac nhap doi hinh tu trang meta ban hay xem.
 */
const SAMPLE_COMPS = [
  {
    id: 'tpl-reroll-1c',
    name: 'Mau: Reroll tuong 1 vang',
    tier: 'A',
    style: 'Reroll cap 6-7',
    traits: [],
    econ: { levelAt: { '2-1': 4, '3-2': 6, '4-1': 7 }, rollDownAt: '3-2', keepGold: 50 },
    notes: 'Giu chuoi thang som, cap 6 o 3-2 roi roll xuong ~30 vang tim 3 tuong 1 vang len 3 sao. Len 7 khi da co 3 sao.',
    units: [
      { name: 'Carry 1 vang chinh', cost: 1, star: 3, carry: true, items: ['Infinity Edge', "Guinsoo's Rageblade", 'Last Whisper'], row: 3, col: 5 },
      { name: 'Carry phu', cost: 1, star: 3, carry: false, items: ['Blue Buff'], row: 3, col: 2 },
      { name: 'Do dan chinh', cost: 2, star: 2, carry: false, items: ['Bramble Vest', 'Warmog\'s Armor'], row: 0, col: 3 },
      { name: 'Do dan phu', cost: 1, star: 3, carry: false, items: [], row: 0, col: 2 },
      { name: 'Ho tro', cost: 2, star: 2, carry: false, items: ['Redemption'], row: 1, col: 4 },
      { name: 'Kich toc 1', cost: 1, star: 2, carry: false, items: [], row: 1, col: 1 },
      { name: 'Kich toc 2', cost: 3, star: 2, carry: false, items: [], row: 2, col: 6 }
    ]
  },
  {
    id: 'tpl-fast8',
    name: 'Mau: Fast 8 - carry 4 vang',
    tier: 'S',
    style: 'Len cap nhanh',
    traits: [],
    econ: { levelAt: { '2-1': 4, '3-2': 6, '4-1': 7, '4-5': 8 }, rollDownAt: '4-5', keepGold: 30 },
    notes: 'Giu 50 vang an lai, len 8 o 4-5 roi roll xuong 20-30 tim carry 4 vang. Uu tien do cho carry truoc.',
    units: [
      { name: 'Carry 4 vang', cost: 4, star: 2, carry: true, items: ['Infinity Edge', 'Giant Slayer', 'Last Whisper'], row: 3, col: 6 },
      { name: 'Tanker 4 vang', cost: 4, star: 2, carry: false, items: ['Gargoyle Stoneplate', 'Warmog\'s Armor'], row: 0, col: 3 },
      { name: 'Phap su phu', cost: 3, star: 2, carry: false, items: ['Blue Buff'], row: 2, col: 2 },
      { name: 'Ho tro hoi mau', cost: 3, star: 2, carry: false, items: ['Redemption'], row: 1, col: 4 },
      { name: 'Kich toc 1', cost: 2, star: 2, carry: false, items: [], row: 1, col: 1 },
      { name: 'Kich toc 2', cost: 2, star: 2, carry: false, items: [], row: 0, col: 5 },
      { name: 'Kich toc 3', cost: 1, star: 2, carry: false, items: [], row: 2, col: 0 },
      { name: 'Kich toc 4', cost: 5, star: 1, carry: false, items: [], row: 0, col: 4 }
    ]
  },
  {
    id: 'tpl-level9',
    name: 'Mau: Len cap 9 - doi hinh 5 vang',
    tier: 'A',
    style: 'Kinh te manh',
    traits: [],
    econ: { levelAt: { '3-2': 6, '4-1': 7, '4-5': 8, '5-5': 9 }, rollDownAt: '5-5', keepGold: 50 },
    notes: 'Chi choi khi mau con cao va vang tren 60. Len 9 roi tha tuong 5 vang vao, khong can roll nhieu.',
    units: [
      { name: 'Carry 5 vang', cost: 5, star: 2, carry: true, items: ["Rabadon's Deathcap", 'Jeweled Gauntlet', 'Blue Buff'], row: 3, col: 3 },
      { name: 'Tanker 5 vang', cost: 5, star: 1, carry: false, items: ['Bramble Vest'], row: 0, col: 3 },
      { name: 'Carry phu 4 vang', cost: 4, star: 2, carry: false, items: ['Deathblade'], row: 3, col: 5 },
      { name: 'Tanker phu', cost: 4, star: 2, carry: false, items: ["Dragon's Claw"], row: 0, col: 2 },
      { name: 'Ho tro', cost: 3, star: 2, carry: false, items: ['Redemption'], row: 1, col: 4 },
      { name: 'Kich toc 1', cost: 5, star: 1, carry: false, items: [], row: 1, col: 1 },
      { name: 'Kich toc 2', cost: 4, star: 2, carry: false, items: [], row: 2, col: 6 },
      { name: 'Kich toc 3', cost: 3, star: 2, carry: false, items: [], row: 2, col: 0 },
      { name: 'Kich toc 4', cost: 2, star: 2, carry: false, items: [], row: 1, col: 5 }
    ]
  }
];

module.exports = { SAMPLE_COMPS };
