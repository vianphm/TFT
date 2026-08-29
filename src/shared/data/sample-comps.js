'use strict';

/**
 * Doi hinh meta mua 18 (Dai Ngan Ky Bi), phien ban 18.1.
 * Boc tach tu doihinhtft.vn (scripts/parse-doihinhtft-comps.js), tai ve boi CI
 * vi may chay phien lam viec bi chan mang. 17/30 doi hinh tren trang doi chieu
 * khop 100% voi ten tuong chinh thuc; 13 con lai dung ten Viet hoa cho quai rung
 * (Krug, Gromp, Elder Dragon...) chua co bang doi chieu dang tin nen bo qua thay
 * vi doan - xem data/sources/doihinhtft-comps.json de tu doi chieu them.
 *
 * Vi tri dung (row/col) la xep tam theo gia tien, trang bi con thieu - vao dashboard
 * de chinh lai cho dung y va gan do.
 */
const SAMPLE_COMPS = [
  {
    "id": "dhtft18-cassiopeia-v-qu-n",
    "name": "Cassiopeia Vệ Quân",
    "tier": "S",
    "style": "Lên cấp 7",
    "difficulty": "Trung Bình",
    "winRate": "12,6%",
    "top4": "56,1%",
    "traits": [],
    "econ": {
      "levelAt": {},
      "rollDownAt": "",
      "keepGold": 50
    },
    "notes": "Nguồn: doihinhtft.vn, tự động bóc từ trang. Win rate 12,6%, Top 4 56,1%.",
    "units": [
      {
        "name": "Cassiopeia",
        "star": 3,
        "carry": true,
        "cost": 3,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Fiddlesticks",
        "star": 3,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 1,
        "items": []
      },
      {
        "name": "Rammus",
        "star": 3,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 2,
        "items": []
      },
      {
        "name": "Lillia",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 3,
        "items": []
      },
      {
        "name": "Soraka",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 4,
        "items": []
      },
      {
        "name": "Shen",
        "star": 2,
        "carry": false,
        "cost": 2,
        "row": 0,
        "col": 0,
        "items": []
      },
      {
        "name": "Leona",
        "star": 2,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 1,
        "items": []
      },
      {
        "name": "Ornn",
        "star": 2,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 2,
        "items": []
      }
    ]
  },
  {
    "id": "dhtft18-rengar-tristana-ti-n-linh",
    "name": "Rengar Tristana Tiên Linh",
    "tier": "S",
    "style": "Lên cấp 7",
    "difficulty": "Trung Bình",
    "winRate": "23,4%",
    "top4": "53,5%",
    "traits": [],
    "econ": {
      "levelAt": {},
      "rollDownAt": "",
      "keepGold": 50
    },
    "notes": "Nguồn: doihinhtft.vn, tự động bóc từ trang. Win rate 23,4%, Top 4 53,5%.",
    "units": [
      {
        "name": "Tristana",
        "star": 3,
        "carry": true,
        "cost": 3,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Rengar",
        "star": 3,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 1,
        "items": []
      },
      {
        "name": "Rammus",
        "star": 3,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 2,
        "items": []
      },
      {
        "name": "Sivir",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 3,
        "items": []
      },
      {
        "name": "Lillia",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 4,
        "items": []
      },
      {
        "name": "Vi",
        "star": 3,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 5,
        "items": []
      },
      {
        "name": "Kobuko",
        "star": 2,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 0,
        "items": []
      },
      {
        "name": "Rakan",
        "star": 2,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 1,
        "items": []
      }
    ]
  },
  {
    "id": "dhtft18-veigar-tinh-ngh-ch",
    "name": "Veigar Tinh Nghịch",
    "tier": "S",
    "style": "Lên cấp 5",
    "difficulty": "Trung Bình",
    "winRate": "13,6%",
    "top4": "55,4%",
    "traits": [],
    "econ": {
      "levelAt": {},
      "rollDownAt": "",
      "keepGold": 50
    },
    "notes": "Nguồn: doihinhtft.vn, tự động bóc từ trang. Win rate 13,6%, Top 4 55,4%.",
    "units": [
      {
        "name": "Veigar",
        "star": 3,
        "carry": true,
        "cost": 1,
        "row": 0,
        "col": 0,
        "items": []
      },
      {
        "name": "Rek'Sai",
        "star": 3,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 1,
        "items": []
      },
      {
        "name": "Teemo",
        "star": 3,
        "carry": false,
        "cost": 2,
        "row": 0,
        "col": 2,
        "items": []
      },
      {
        "name": "Kobuko",
        "star": 3,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 3,
        "items": []
      },
      {
        "name": "Gnar",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Sett",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 1,
        "items": []
      },
      {
        "name": "Rammus",
        "star": 2,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 2,
        "items": []
      },
      {
        "name": "Fiddlesticks",
        "star": 2,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 3,
        "items": []
      }
    ]
  },
  {
    "id": "dhtft18-sivir-th-s-n",
    "name": "Sivir Thợ Săn",
    "tier": "A",
    "style": "Lên cấp 8",
    "difficulty": "Trung Bình",
    "winRate": "14,8%",
    "top4": "52,9%",
    "traits": [],
    "econ": {
      "levelAt": {},
      "rollDownAt": "",
      "keepGold": 50
    },
    "notes": "Nguồn: doihinhtft.vn, tự động bóc từ trang. Win rate 14,8%, Top 4 52,9%.",
    "units": [
      {
        "name": "Sivir",
        "star": 2,
        "carry": true,
        "cost": 4,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Amumu",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 1,
        "items": []
      },
      {
        "name": "Ashe",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 2,
        "items": []
      },
      {
        "name": "Lillia",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 3,
        "items": []
      },
      {
        "name": "Ivern",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 4,
        "items": []
      },
      {
        "name": "Kennen",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 5,
        "items": []
      },
      {
        "name": "Tristana",
        "star": 2,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 6,
        "items": []
      },
      {
        "name": "Vi",
        "star": 2,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Shen",
        "star": 2,
        "carry": false,
        "cost": 2,
        "row": 0,
        "col": 0,
        "items": []
      }
    ]
  },
  {
    "id": "dhtft18-sett-ao-ph",
    "name": "Sett Đao Phủ",
    "tier": "A",
    "style": "Lên cấp 8",
    "difficulty": "Dễ",
    "winRate": "10,6%",
    "top4": "53,4%",
    "traits": [],
    "econ": {
      "levelAt": {},
      "rollDownAt": "",
      "keepGold": 50
    },
    "notes": "Nguồn: doihinhtft.vn, tự động bóc từ trang. Win rate 10,6%, Top 4 53,4%.",
    "units": [
      {
        "name": "Sett",
        "star": 2,
        "carry": true,
        "cost": 4,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Ahri",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 1,
        "items": []
      },
      {
        "name": "Ezreal",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 2,
        "items": []
      },
      {
        "name": "Soraka",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 3,
        "items": []
      },
      {
        "name": "Gnar",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 4,
        "items": []
      },
      {
        "name": "Kennen",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 5,
        "items": []
      },
      {
        "name": "Fiddlesticks",
        "star": 2,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 6,
        "items": []
      },
      {
        "name": "Yunara",
        "star": 2,
        "carry": false,
        "cost": 2,
        "row": 0,
        "col": 0,
        "items": []
      },
      {
        "name": "Ornn",
        "star": 2,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 1,
        "items": []
      }
    ]
  },
  {
    "id": "dhtft18-draven-ezreal-ao-ph",
    "name": "Draven Ezreal Đao Phủ",
    "tier": "A",
    "style": "Lên cấp 9",
    "difficulty": "Khó",
    "winRate": "20,6%",
    "top4": "49,5%",
    "traits": [],
    "econ": {
      "levelAt": {},
      "rollDownAt": "",
      "keepGold": 50
    },
    "notes": "Nguồn: doihinhtft.vn, tự động bóc từ trang. Win rate 20,6%, Top 4 49,5%.",
    "units": [
      {
        "name": "Draven",
        "star": 2,
        "carry": true,
        "cost": 5,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Ezreal",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 1,
        "items": []
      },
      {
        "name": "Maokai",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 2,
        "items": []
      },
      {
        "name": "Kennen",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 3,
        "items": []
      },
      {
        "name": "Gnar",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 4,
        "items": []
      },
      {
        "name": "Ivern",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 5,
        "items": []
      },
      {
        "name": "Taric",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 6,
        "items": []
      },
      {
        "name": "Amumu",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Alistar",
        "star": 2,
        "carry": false,
        "cost": 2,
        "row": 0,
        "col": 0,
        "items": []
      }
    ]
  },
  {
    "id": "dhtft18-aphelios-th-n-r-ng",
    "name": "Aphelios Thần Rừng",
    "tier": "A",
    "style": "Fast 8",
    "difficulty": "Dễ",
    "winRate": "11,4%",
    "top4": "49,4%",
    "traits": [],
    "econ": {
      "levelAt": {},
      "rollDownAt": "",
      "keepGold": 50
    },
    "notes": "Nguồn: doihinhtft.vn, tự động bóc từ trang. Win rate 11,4%, Top 4 49,4%.",
    "units": [
      {
        "name": "Aphelios",
        "star": 2,
        "carry": true,
        "cost": 4,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Lillia",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 1,
        "items": []
      },
      {
        "name": "Alune",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 2,
        "items": []
      },
      {
        "name": "Gnar",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 3,
        "items": []
      },
      {
        "name": "Ivern",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 4,
        "items": []
      },
      {
        "name": "Alistar",
        "star": 2,
        "carry": false,
        "cost": 2,
        "row": 0,
        "col": 0,
        "items": []
      },
      {
        "name": "LeBlanc",
        "star": 2,
        "carry": false,
        "cost": 2,
        "row": 0,
        "col": 1,
        "items": []
      },
      {
        "name": "Ornn",
        "star": 2,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 2,
        "items": []
      },
      {
        "name": "Xayah",
        "star": 2,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 3,
        "items": []
      }
    ]
  },
  {
    "id": "dhtft18-sett-hoa-linh",
    "name": "Sett Hoa Linh",
    "tier": "A",
    "style": "Lên cấp 8",
    "difficulty": "Trung Bình",
    "winRate": "12,7%",
    "top4": "51,2%",
    "traits": [],
    "econ": {
      "levelAt": {},
      "rollDownAt": "",
      "keepGold": 50
    },
    "notes": "Nguồn: doihinhtft.vn, tự động bóc từ trang. Win rate 12,7%, Top 4 51,2%.",
    "units": [
      {
        "name": "Sett",
        "star": 2,
        "carry": true,
        "cost": 4,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Ahri",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 1,
        "items": []
      },
      {
        "name": "Ashe",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 2,
        "items": []
      },
      {
        "name": "Sivir",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 3,
        "items": []
      },
      {
        "name": "Gnar",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 4,
        "items": []
      },
      {
        "name": "Zyra",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 5,
        "items": []
      },
      {
        "name": "Vi",
        "star": 2,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 6,
        "items": []
      },
      {
        "name": "Yorick",
        "star": 2,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 0,
        "items": []
      },
      {
        "name": "Karma",
        "star": 2,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 1,
        "items": []
      }
    ]
  },
  {
    "id": "dhtft18-sett-ahri-thu-t-s",
    "name": "Sett Ahri Thuật Sư",
    "tier": "B",
    "style": "Lên cấp 9",
    "difficulty": "Khó",
    "winRate": "12,7%",
    "top4": "49,9%",
    "traits": [],
    "econ": {
      "levelAt": {},
      "rollDownAt": "",
      "keepGold": 50
    },
    "notes": "Nguồn: doihinhtft.vn, tự động bóc từ trang. Win rate 12,7%, Top 4 49,9%.",
    "units": [
      {
        "name": "Ahri",
        "star": 2,
        "carry": true,
        "cost": 4,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Sett",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 1,
        "items": []
      },
      {
        "name": "Alune",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 2,
        "items": []
      },
      {
        "name": "Ashe",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 3,
        "items": []
      },
      {
        "name": "Gnar",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 4,
        "items": []
      },
      {
        "name": "Lillia",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 5,
        "items": []
      },
      {
        "name": "Diana",
        "star": 2,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 6,
        "items": []
      },
      {
        "name": "Rammus",
        "star": 2,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Tristana",
        "star": 2,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 1,
        "items": []
      }
    ]
  },
  {
    "id": "dhtft18-kha-zix-kh-c-tinh",
    "name": "Kha'Zix Khắc Tinh",
    "tier": "B",
    "style": "Lên cấp 7",
    "difficulty": "Dễ",
    "winRate": "13,4%",
    "top4": "49,7%",
    "traits": [],
    "econ": {
      "levelAt": {},
      "rollDownAt": "",
      "keepGold": 50
    },
    "notes": "Nguồn: doihinhtft.vn, tự động bóc từ trang. Win rate 13,4%, Top 4 49,7%.",
    "units": [
      {
        "name": "Kha'Zix",
        "star": 3,
        "carry": true,
        "cost": 3,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Rengar",
        "star": 3,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 1,
        "items": []
      },
      {
        "name": "Hecarim",
        "star": 3,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 2,
        "items": []
      },
      {
        "name": "Diana",
        "star": 3,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 3,
        "items": []
      },
      {
        "name": "Kennen",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 4,
        "items": []
      },
      {
        "name": "Aphelios",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 5,
        "items": []
      },
      {
        "name": "Ezreal",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 6,
        "items": []
      },
      {
        "name": "LeBlanc",
        "star": 2,
        "carry": false,
        "cost": 2,
        "row": 0,
        "col": 0,
        "items": []
      }
    ]
  },
  {
    "id": "dhtft18-fiddlesticks-thu-t-s",
    "name": "Fiddlesticks Thuật Sư",
    "tier": "B",
    "style": "Lên cấp 7",
    "difficulty": "Dễ",
    "winRate": "11,1%",
    "top4": "49,4%",
    "traits": [],
    "econ": {
      "levelAt": {},
      "rollDownAt": "",
      "keepGold": 50
    },
    "notes": "Nguồn: doihinhtft.vn, tự động bóc từ trang. Win rate 11,1%, Top 4 49,4%.",
    "units": [
      {
        "name": "Fiddlesticks",
        "star": 3,
        "carry": true,
        "cost": 3,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Ahri",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 1,
        "items": []
      },
      {
        "name": "Cassiopeia",
        "star": 3,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 2,
        "items": []
      },
      {
        "name": "Lillia",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 3,
        "items": []
      },
      {
        "name": "Malphite",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 4,
        "items": []
      },
      {
        "name": "Rammus",
        "star": 2,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 5,
        "items": []
      },
      {
        "name": "Shen",
        "star": 2,
        "carry": false,
        "cost": 2,
        "row": 0,
        "col": 0,
        "items": []
      },
      {
        "name": "Veigar",
        "star": 3,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 1,
        "items": []
      }
    ]
  },
  {
    "id": "dhtft18-malphite-ao-ph",
    "name": "Malphite Đao Phủ",
    "tier": "B",
    "style": "Lên cấp 8",
    "difficulty": "Khó",
    "winRate": "9,5%",
    "top4": "49,5%",
    "traits": [],
    "econ": {
      "levelAt": {},
      "rollDownAt": "",
      "keepGold": 50
    },
    "notes": "Nguồn: doihinhtft.vn, tự động bóc từ trang. Win rate 9,5%, Top 4 49,5%.",
    "units": [
      {
        "name": "Malphite",
        "star": 2,
        "carry": true,
        "cost": 4,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Soraka",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 1,
        "items": []
      },
      {
        "name": "Zyra",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 2,
        "items": []
      },
      {
        "name": "Kennen",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 3,
        "items": []
      },
      {
        "name": "Amumu",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 4,
        "items": []
      },
      {
        "name": "Azir",
        "star": 2,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 5,
        "items": []
      },
      {
        "name": "Fiddlesticks",
        "star": 2,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 6,
        "items": []
      },
      {
        "name": "Yorick",
        "star": 2,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 0,
        "items": []
      }
    ]
  },
  {
    "id": "dhtft18-yunara-ao-ph",
    "name": "Yunara Đao Phủ",
    "tier": "B",
    "style": "Lên cấp 6",
    "difficulty": "Trung Bình",
    "winRate": "9,9%",
    "top4": "47,1%",
    "traits": [],
    "econ": {
      "levelAt": {},
      "rollDownAt": "",
      "keepGold": 50
    },
    "notes": "Nguồn: doihinhtft.vn, tự động bóc từ trang. Win rate 9,9%, Top 4 47,1%.",
    "units": [
      {
        "name": "Yunara",
        "star": 3,
        "carry": true,
        "cost": 2,
        "row": 0,
        "col": 0,
        "items": []
      },
      {
        "name": "Alistar",
        "star": 3,
        "carry": false,
        "cost": 2,
        "row": 0,
        "col": 1,
        "items": []
      },
      {
        "name": "Ezreal",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Sett",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 1,
        "items": []
      },
      {
        "name": "Ahri",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 2,
        "items": []
      },
      {
        "name": "Soraka",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 3,
        "items": []
      },
      {
        "name": "Azir",
        "star": 2,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 4,
        "items": []
      },
      {
        "name": "LeBlanc",
        "star": 3,
        "carry": false,
        "cost": 2,
        "row": 0,
        "col": 2,
        "items": []
      }
    ]
  },
  {
    "id": "dhtft18-kayle-li-n-k-ch",
    "name": "Kayle Liên Kích",
    "tier": "B",
    "style": "Lên cấp 6",
    "difficulty": "Trung Bình",
    "winRate": "15,8%",
    "top4": "48,4%",
    "traits": [],
    "econ": {
      "levelAt": {},
      "rollDownAt": "",
      "keepGold": 50
    },
    "notes": "Nguồn: doihinhtft.vn, tự động bóc từ trang. Win rate 15,8%, Top 4 48,4%.",
    "units": [
      {
        "name": "Kayle",
        "star": 3,
        "carry": true,
        "cost": 2,
        "row": 0,
        "col": 0,
        "items": []
      },
      {
        "name": "Xayah",
        "star": 3,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 1,
        "items": []
      },
      {
        "name": "Ornn",
        "star": 3,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 2,
        "items": []
      },
      {
        "name": "Sejuani",
        "star": 3,
        "carry": false,
        "cost": 2,
        "row": 0,
        "col": 3,
        "items": []
      },
      {
        "name": "Hecarim",
        "star": 2,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Leona",
        "star": 3,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 4,
        "items": []
      },
      {
        "name": "Rakan",
        "star": 3,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 5,
        "items": []
      }
    ]
  },
  {
    "id": "dhtft18-tristana-ti-n-linh",
    "name": "Tristana Tiên Linh",
    "tier": "B",
    "style": "Lên cấp 7",
    "difficulty": "Trung Bình",
    "winRate": "13,2%",
    "top4": "47,0%",
    "traits": [],
    "econ": {
      "levelAt": {},
      "rollDownAt": "",
      "keepGold": 50
    },
    "notes": "Nguồn: doihinhtft.vn, tự động bóc từ trang. Win rate 13,2%, Top 4 47,0%.",
    "units": [
      {
        "name": "Tristana",
        "star": 3,
        "carry": true,
        "cost": 3,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Rammus",
        "star": 3,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 1,
        "items": []
      },
      {
        "name": "Sivir",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 2,
        "items": []
      },
      {
        "name": "Lillia",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 3,
        "items": []
      },
      {
        "name": "Vi",
        "star": 3,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 4,
        "items": []
      },
      {
        "name": "Kobuko",
        "star": 2,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 0,
        "items": []
      },
      {
        "name": "Rakan",
        "star": 2,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 1,
        "items": []
      },
      {
        "name": "Xayah",
        "star": 2,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 2,
        "items": []
      }
    ]
  },
  {
    "id": "dhtft18-ahri-hoa-linh",
    "name": "Ahri Hoa Linh",
    "tier": "B",
    "style": "Cơ Bản",
    "difficulty": "Dễ",
    "winRate": "14,6%",
    "top4": "44,1%",
    "traits": [],
    "econ": {
      "levelAt": {},
      "rollDownAt": "",
      "keepGold": 50
    },
    "notes": "Nguồn: doihinhtft.vn, tự động bóc từ trang. Win rate 14,6%, Top 4 44,1%.",
    "units": [
      {
        "name": "Ahri",
        "star": 2,
        "carry": true,
        "cost": 4,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Sett",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 1,
        "items": []
      },
      {
        "name": "Ashe",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 2,
        "items": []
      },
      {
        "name": "Master Yi",
        "star": 2,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 3,
        "items": []
      },
      {
        "name": "Gnar",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 4,
        "items": []
      },
      {
        "name": "Maokai",
        "star": 2,
        "carry": false,
        "cost": 5,
        "row": 3,
        "col": 5,
        "items": []
      },
      {
        "name": "Yunara",
        "star": 2,
        "carry": false,
        "cost": 2,
        "row": 0,
        "col": 0,
        "items": []
      },
      {
        "name": "Yorick",
        "star": 2,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 1,
        "items": []
      },
      {
        "name": "Karma",
        "star": 2,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 2,
        "items": []
      }
    ]
  },
  {
    "id": "dhtft18-ezreal-ao-ph",
    "name": "Ezreal Đao Phủ",
    "tier": "B",
    "style": "Lên cấp 8",
    "difficulty": "Trung Bình",
    "winRate": "7,3%",
    "top4": "46,0%",
    "traits": [],
    "econ": {
      "levelAt": {},
      "rollDownAt": "",
      "keepGold": 50
    },
    "notes": "Nguồn: doihinhtft.vn, tự động bóc từ trang. Win rate 7,3%, Top 4 46,0%.",
    "units": [
      {
        "name": "Ezreal",
        "star": 2,
        "carry": true,
        "cost": 4,
        "row": 3,
        "col": 0,
        "items": []
      },
      {
        "name": "Malphite",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 1,
        "items": []
      },
      {
        "name": "Soraka",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 2,
        "items": []
      },
      {
        "name": "Azir",
        "star": 2,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 3,
        "items": []
      },
      {
        "name": "Zyra",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 4,
        "items": []
      },
      {
        "name": "Amumu",
        "star": 2,
        "carry": false,
        "cost": 4,
        "row": 3,
        "col": 5,
        "items": []
      },
      {
        "name": "Fiddlesticks",
        "star": 2,
        "carry": false,
        "cost": 3,
        "row": 3,
        "col": 6,
        "items": []
      },
      {
        "name": "Yorick",
        "star": 2,
        "carry": false,
        "cost": 1,
        "row": 0,
        "col": 0,
        "items": []
      }
    ]
  }
];

module.exports = { SAMPLE_COMPS };
