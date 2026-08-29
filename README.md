# TFT Companion

Tool hỗ trợ chơi Teamfight Tactics: một lớp **overlay trong suốt nằm đè lên game** (kiểu Blitz)
và một **dashboard đầy đủ để đặt ở màn hình phụ**. Viết bằng Electron, chạy trên Windows / macOS / Linux.

Toàn bộ dữ liệu nằm trên máy bạn. App **không đọc bộ nhớ game, không giả lập thao tác, không can thiệp
vào client** — chỉ hiển thị thông tin bạn nhập cùng dữ liệu công khai của Riot (qua Community Dragon),
nên không đụng tới điều khoản của Riot.

## Tính năng

**Overlay (đè lên game)**
- 6 widget kéo thả, bật/tắt riêng từng cái, nhớ vị trí: Tỉ lệ roll, Kinh tế, Vòng đấu, Công thức đồ, Đội hình, Ghi chú.
- Xuyên chuột: khi khoá, chuột đi thẳng vào game; rê vào widget thì tự bắt lại để bấm được, rời ra là trả lại cho game.
- Chỉnh độ mờ, chuyển overlay sang màn hình khác, tất cả bằng phím tắt toàn cục.
- Tự bật khi phát hiện tiến trình game đang chạy (đọc danh sách tiến trình, không đụng vào game).

**Dashboard (màn hình phụ)**
- *Đội hình*: bàn cờ 4×7 ô lục giác để lưu vị trí đứng, gắn trang bị cho từng tướng, đánh dấu carry,
  ghi mốc roll/giữ vàng, nhập từ web hoặc JSON, xuất JSON.
- *Trang bị*: bảng ghép 9×9 đầy đủ 45 công thức, "túi đồ" gợi ý ghép được gì ngay và còn thiếu gì.
- *Tỉ lệ roll*: xác suất theo cấp + độ sâu kho tướng, tính cả số bản sao người khác đang cầm;
  cho biết cần bao nhiêu vàng để đạt 50/75/90/95% chắc chắn.
- *Kinh tế & cấp*: lãi, chuỗi, dự báo vàng vài vòng tới, chi phí XP lên cấp, lộ trình cấp tham khảo.
- *Tướng trong set*: danh sách tướng theo giá kèm tộc/hệ, tìm kiếm, đồng bộ dữ liệu set mới.

## Cài đặt

Cần Node.js 18 trở lên.

```bash
npm install
npm start          # chạy app
npm test           # chạy kiểm thử phần tính toán (không cần Electron)
npm run dist       # đóng gói (nsis / dmg / AppImage) bằng electron-builder
```

Lần đầu chạy, vào tab **Tướng trong set** hoặc cửa sổ **Cài đặt** bấm *Đồng bộ dữ liệu set* để tải
danh sách tướng, tộc hệ, trang bị của set đang chơi từ Community Dragon (cache lại trong thư mục
cấu hình, lần sau mở là có ngay). Chưa đồng bộ thì app vẫn dùng được với dữ liệu đóng gói sẵn
(45 công thức ghép đồ, bảng tỉ lệ, bảng kinh tế/XP).

## Phím tắt mặc định

| Phím | Tác dụng |
|---|---|
| `Ctrl+Shift+T` | Bật/tắt overlay |
| `Ctrl+Shift+E` | Khoá / mở chuột trên overlay |
| `Ctrl+Shift+D` | Bật/tắt dashboard |
| `Ctrl+Shift+R` | Đếm ngược 30 giây (giai đoạn chuẩn bị) |
| `Ctrl+Shift+↑ / ↓` | Tăng / giảm độ mờ overlay |
| `Ctrl+Shift+M` | Chuyển overlay sang màn hình kế tiếp |

Đổi phím trong cửa sổ **Cài đặt** (bấm vào ô rồi nhấn tổ hợp mới). Phím nào bị ứng dụng khác chiếm
thì app báo lại ngay để bạn chọn phím khác.

## Dùng thế nào cho tiện

1. Để **dashboard ở màn hình phụ** (Cài đặt → *Màn hình cho dashboard*), **overlay ở màn hình chơi game**.
2. Trong game chạy chế độ **Borderless / Windowed** — chế độ Fullscreen độc quyền sẽ che mất mọi overlay.
3. Lúc đánh nhau cứ để overlay **khoá** (chuột xuyên qua). Cần gõ ghi chú thì `Ctrl+Shift+E` mở khoá.
4. Chỉ bật widget nào thật sự cần — bấm các nút trên thanh HUD ở giữa trên màn hình.

## Nhập đội hình từ trang meta

Tab **Đội hình → Nhập từ web / văn bản**:

- Dán URL (metatft.gg, doihinhtft.vn, mobalytics…) rồi bấm *Tải về*, hoặc copy nội dung trang dán thẳng vào ô văn bản.
- App dò tên tướng theo dữ liệu set đã đồng bộ, dò tên trang bị theo bảng công thức, gom theo từng tiêu đề
  trên trang, rồi tạo đội hình nháp: tướng nào đứng đâu, cầm đồ gì.
- Kết quả là **bản nháp** — mỗi trang có cách trình bày khác nhau, nên xem lại vị trí đứng và trang bị
  trước khi dùng. JSON xuất từ chính app này thì nhập lại chính xác 100%.

## Cấu trúc

```
src/main/          tiến trình chính: cửa sổ, phím tắt, cấu hình, đồng bộ dữ liệu, nhập đội hình
src/preload/       cầu nối IPC an toàn (contextIsolation, renderer không có Node)
src/renderer/      giao diện: overlay/, dashboard/, settings/, shared/ (bảng số liệu + logic tính)
src/shared/data/   dữ liệu đóng gói sẵn (đội hình mẫu, bộ dữ liệu dự phòng)
scripts/           tạo icon, tạo dữ liệu dự phòng, smoke test giao diện
test/              kiểm thử logic tính toán
```

Cấu hình + cache lưu tại thư mục userData của Electron (Cài đặt → *Mở thư mục cấu hình*).

## Số liệu trong app

Bảng tỉ lệ cửa hàng theo cấp, kho tướng, XP, lãi và thưởng chuỗi nằm ở
`src/renderer/shared/tables.js`. Riot có chỉnh các con số này giữa các set — sửa trực tiếp file đó
là mọi phần tính toán cập nhật theo, không cần đổi gì khác.

## Chưa làm (nếu cần thì làm tiếp)

- Bộ đọc riêng cho từng trang meta (chính xác hơn cách dò theo từ khoá hiện tại).
- Lịch sử đấu / thống kê qua Riot API (cần API key).
- Tự nhận diện vòng đấu và số vàng bằng OCR.
