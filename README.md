# ⚡ Blitz TFT Companion (Desktop App & Overlay)

Phiên bản Clone **Blitz.gg** dành riêng cho Đấu Trường Chân Lý (Teamfight Tactics) chạy trực tiếp trên máy tính Windows. Được tối ưu siêu nhẹ, giao diện Hextech Obsidian sang trọng, tích hợp đầy đủ Client tra cứu và In-Game Transparent Overlay ghim nổi trực tiếp trên trận đấu.

---

## 🌟 Tính Năng Nổi Bật

1. **Client Desktop Hiện Đại (Hextech Obsidian)**:
   - **Meta Tier List**: Danh sách bài chuẩn meta (Tier S, A, B) với đầy đủ tướng, cấp sao, trang bị chuẩn (BiS), tỉ lệ thắng, top 4.
   - **Công thức trang bị**: Tra cứu nhanh 36+ món trang bị hoàn chỉnh từ 9 mảnh linh kiện cơ bản.
   - **Xác suất Roll & Kinh tế**: Bảng tỉ lệ roll tướng 1-5 vàng theo cấp 1-11, máy tính tính mốc lợi tức và dự báo vàng vòng kế tiếp.
   - **Lịch trình vòng đấu**: Mốc chọn Lõi Nâng Cấp (Augments), Vòng Đi Chợ (Carousel) và vòng Quái (PvE).
   - **Tự tạo đội hình mới**: Form trực quan giúp bạn tự tay thêm bài tủ và ghim ngay lên Overlay trong trận.

2. **In-Game Transparent Overlay (Chuẩn Blitz / MetaTFT)**:
   - **100% trong suốt**: Không che màn hình game TFT, tự động nhận diện khi trận đấu bắt đầu (`TFTClient-Win64-Shipping.exe`).
   - **Smart Click-Through**: Rê chuột vào widget để xem/kéo thả; rê chuột ra ngoài sàn đấu là bấm thẳng vào game với độ trễ bằng 0.
   - **Phím tắt toàn cầu**:
     - `F2`: Bật / Tắt nhanh Overlay trong game.
     - `F3`: Khóa / Mở xuyên chuột thủ công.
     - `Ctrl + Shift + D`: Bật / Tắt cửa sổ Client chính.

3. **Mã Nguồn Cực Kỳ Dễ Tự Chỉnh Sửa**:
   - Toàn bộ dữ liệu đội hình nằm trong file JSON mở: [`src/data/comps.json`](src/data/comps.json). Bạn chỉ cần mở file sửa tên tướng, đồ theo ý thích.
   - Bảng tỉ lệ và trang bị nằm trong [`src/data/tables.json`](src/data/tables.json) và [`src/data/items.json`](src/data/items.json).

---

## 🚀 Cấu Trúc Dự Án

```
TFT/
├── package.json                   # Cấu hình dự án & electron-builder
├── src/
│   ├── main/                      # Backend Electron
│   │   ├── index.js               # Entry point chính & System Tray
│   │   ├── shortcuts.js           # Phím tắt toàn cầu (F2, F3)
│   │   ├── windows/               # Quản lý cửa sổ (Client & Overlay)
│   │   │   ├── mainWindow.js      # Cửa sổ Client (1280x820)
│   │   │   └── overlayWindow.js   # Cửa sổ Overlay trong suốt in-game
│   │   └── services/              # Dịch vụ nền
│   │       ├── gameWatcher.js     # Tự động quét tiến trình TFTClient-Win64-Shipping.exe
│   │       ├── riotLiveClient.js  # Kết nối Riot Live Client API (Port 2999)
│   │       └── store.js           # Lưu cấu hình người dùng
│   │
│   ├── preload/                   # Cầu nối IPC an toàn
│   │   └── preload.js
│   │
│   ├── renderer/                  # Giao diện người dùng
│   │   ├── shared/                # Theme Hextech Obsidian dùng chung
│   │   │   └── blitz.css
│   │   ├── app/                   # Cửa sổ Client chính
│   │   │   ├── index.html
│   │   │   ├── app.css
│   │   │   └── app.js
│   │   └── overlay/               # Lớp phủ nổi trong trận đấu
│   │       ├── overlay.html
│   │       ├── overlay.css
│   │       └── overlay.js
│   │
│   └── data/                      # Dữ liệu TFT mở (JSON sạch)
│       ├── comps.json             # Danh sách đội hình meta
│       ├── items.json             # Công thức ghép trang bị
│       └── tables.json            # Tỉ lệ roll & mốc kinh tế
└── test/
    └── app.test.js                # Bộ kiểm thử tự động
```

---

## 🛠️ Hướng Dẫn Sử Dụng

### 1. Chạy trong môi trường phát triển:
```bash
npm start
```

### 2. Đóng gói thành phần mềm Desktop (.exe):
```bash
# Đóng gói bản chạy trực tiếp không cần cài đặt:
npm run pack

# Đóng gói file cài đặt Setup (.exe):
npm run dist
```
File thực thi sau khi đóng gói sẽ nằm tại: `dist/win-unpacked/Blitz TFT Companion.exe`.

### 3. Chạy kiểm thử tự động:
```bash
npm test
```

---

## 📄 Bản Quyền
Dự án phát triển mã nguồn mở theo giấy phép MIT.
