# TFT Companion

Tool hỗ trợ chơi Teamfight Tactics: một lớp **overlay trong suốt nằm đè lên game** (kiểu Blitz)
và một **dashboard đầy đủ để đặt ở màn hình phụ** cùng **bản Web App / PWA cho điện thoại**. Viết bằng Electron, chạy trên Windows / macOS / Linux.

Toàn bộ dữ liệu nằm trên máy bạn. App **không đọc bộ nhớ game, không giả lập thao tác, không can thiệp
vào client** — chỉ hiển thị thông tin bạn nhập cùng dữ liệu công khai của Riot (qua Community Dragon),
nên hoàn toàn an toàn và không vi phạm điều khoản của Riot.

---

## Tính năng

### 🪟 In-Game Overlay (đè lên game)
- **8 widget kéo thả độc lập**, bật/tắt riêng từng cái, tự nhớ vị trí: Tỉ lệ roll, Kinh tế, Vòng đấu, Công thức đồ, Lõi nâng cấp, Tư vấn realtime, Đội hình, Ghi chú.
- **Xuyên chuột (Click-through)**: khi khoá, chuột đi thẳng vào game; rê vào widget thì tự bắt lại để bấm được, rời ra là trả lại cho game.
- Chỉnh độ mờ, chuyển overlay sang màn hình khác, tất cả bằng phím tắt toàn cục (`Ctrl+Shift+T`, `Ctrl+Shift+E`, `Ctrl+Shift+D`, `Ctrl+Shift+R`).
- Tự bật khi phát hiện tiến trình game đang chạy.

### 🖥️ Dashboard (màn hình phụ) & 📱 Mobile App (PWA)
- **Lõi nâng cấp (Augments)**: Xếp hạng và chấm điểm 255 lõi Set 18 theo vòng đấu (`2-1`, `3-2`, `4-2`), lượng máu, vàng và tộc hệ đang kích hoạt, hiển thị lý do chi tiết bằng tiếng Việt.
- **Tư vấn tổng hợp (Realtime Advisor)**: Phân tích toàn bộ trạng thái trong trận, đưa ra đội hình mục tiêu, gợi ý Mua / Bán / Giữ từng tướng trong cửa hàng, món đồ nên ghép ngay và quyết định kinh tế (Roll / Tích tiền / Lên cấp).
- **Khung bài giữ máu đầu game**: Gợi ý chiến thuật chuỗi thắng (up cấp sớm 2-1/2-5, slam đồ) hoặc chuỗi thua (tích 10-20 vàng sớm, nhặt đồ chợ 2-4) và các khung bài giữ máu cơ bản.
- **Trang bị theo đồ rơi**: Bảng ghép 10×10 đầy đủ 55 công thức Mùa 18, phân loại nhóm thuộc tính (`ad`, `ap`, `tank`, `as`, `mana`, `sustain`), chấm điểm tương thích role tướng, cảnh báo khóa hướng chơi.
- **Wisp / Linh hồn**: Đầy đủ 27 Linh hồn Set 18 với phân loại, hiệu ứng nâng cấp và thuật toán xếp hạng theo máu/vàng.
- **Đội hình meta**: Bàn cờ 4×7 ô lục giác lưu vị trí đứng, gắn trang bị cho từng tướng, đánh dấu carry, mốc roll/giữ vàng, nhập từ web hoặc JSON.
- **Tỉ lệ roll**: Xác suất theo cấp + độ sâu kho tướng thật, tính số bản sao bị đối thủ giữ, tính vàng cần để đạt 50/75/90/95% chắc chắn.

---

## Cài đặt & Khởi chạy

Yêu cầu Node.js 18 trở lên.

```bash
npm install
npm start          # chạy ứng dụng Electron (Dashboard + Overlay)
npm test           # chạy toàn bộ kiểm thử logic (calc, analyzer, db)
npm run dist       # đóng gói ứng dụng (nsis / dmg / AppImage)
npm run build:mobile          # gom bản web cho điện thoại vào dist-mobile/
npm run build:mobile:android  # nhồi bản web vào assets của app Android
```

---

## Phím tắt mặc định

| Phím | Tác dụng |
|---|---|
| `Ctrl+Shift+T` | Bật / tắt overlay |
| `Ctrl+Shift+E` | Khoá / mở chuột trên overlay (Click-through) |
| `Ctrl+Shift+D` | Bật / tắt dashboard |
| `Ctrl+Shift+R` | Đếm ngược 30 giây (giai đoạn chuẩn bị) |
| `Ctrl+Shift+↑ / ↓` | Tăng / giảm độ mờ overlay |
| `Ctrl+Shift+M` | Chuyển overlay sang màn hình kế tiếp |

Đổi phím trong tab **Overlay & cài đặt** trên Dashboard.

---

## Bản điện thoại (PWA & Android)

1. **Web App (PWA)**: Mở tab **Overlay & cài đặt** → bật **Cho điện thoại truy cập**. Mở địa chỉ IP hiện trên màn hình bằng điện thoại (cùng mạng Wi-Fi). Bấm *Thêm vào màn hình chính* để dùng như app độc lập.
2. **Triển khai lên Vercel / GitHub Pages**: Repo có sẵn `vercel.json` và `api/tft-data.js` phục vụ dữ liệu set cắt gọn nhẹ không dính CORS.
3. **App Android (Bong bóng nổi)**: Mã nguồn tại thư mục `android/` hỗ trợ cửa sổ nổi đè lên TFT Mobile.

---

## Cấu trúc thư mục

```
src/main/             Tiến trình chính: cửa sổ, phím tắt, cấu hình, đồng bộ dữ liệu, LAN server
src/preload/          Cầu nối IPC an toàn giữa Main và Renderer
src/renderer/         Giao diện PC: overlay/, dashboard/, settings/
src/renderer/shared/  Logic lõi dùng chung: tables.js, calc.js, analyzer.js, db.js, cdragon.js
src/mobile/           Giao diện Web App / PWA cho điện thoại
src/shared/data/      Dữ liệu fallback đóng gói sẵn (set18-raw, wisps, sample comps)
test/                 Kiểm thử logic tính toán, phân tích đội hình và database
```
