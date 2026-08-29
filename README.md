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
npm run build:mobile          # gom bản web cho điện thoại vào dist-mobile/
npm run build:mobile:android  # nhồi bản web đó vào assets của app Android
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

## Bản điện thoại

Có hai cách dùng trên điện thoại, dùng chung y hệt phần tính toán với bản PC.

### 1a. Đưa lên Vercel — link dùng được cho cả Android lẫn iPhone

Repo có sẵn `vercel.json` và một serverless function, import phát là chạy:

1. Vào [vercel.com/new](https://vercel.com/new), chọn **Import Git Repository** → `vianphm/TFT`.
2. Framework để **Other**; build command và output directory Vercel tự đọc từ `vercel.json`
   (`node scripts/build-mobile.js dist-mobile` → `dist-mobile`). Bấm **Deploy**.
3. Xong, mở link `*.vercel.app` trên điện thoại → **Thêm vào màn hình chính**. iPhone cũng cài được
   theo cách này (Safari → nút Chia sẻ → Thêm vào MH chính).

Kèm theo là `api/tft-data.js`: nó tải file dữ liệu của Community Dragon ở phía máy chủ, cắt còn vài
trăm KB rồi trả về cho điện thoại kèm CORS và cache CDN 6 tiếng. Nhờ vậy điện thoại không phải tải
file 10-30 MB và không dính chặn CORS. Bản web tự gọi endpoint này ngay lần mở đầu tiên.

Muốn deploy bằng dòng lệnh: `npx vercel --prod` trong thư mục repo.

### 1b. Web app (PWA) — chạy trên mọi máy, kể cả iPhone

Trong app PC, tab **Overlay & cài đặt → Cho điện thoại truy cập → Bật**. App hiện địa chỉ dạng
`http://192.168.1.x:7333`; gõ địa chỉ đó vào trình duyệt điện thoại (cùng wifi) là có ngay bản mobile,
kèm toàn bộ đội hình và dữ liệu set đang dùng trên PC. Bấm *Thêm vào màn hình chính* để nó chạy như app
thật, có icon riêng, mở được cả khi tắt máy tính (service worker giữ lại bản đã tải, dữ liệu nằm trong máy).

Không muốn bật máy tính thì `npm run build:mobile` ra thư mục `dist-mobile/` — đưa lên GitHub Pages
hay bất kỳ chỗ nào phục vụ file tĩnh là dùng được độc lập; đội hình nhập bằng cách dán JSON.

### 2. App Android — bong bóng nổi đè lên TFT Mobile

Đây mới là overlay thật trên điện thoại: một bong bóng luôn nổi trên game, kéo đi được, chạm vào thì
bung ra bảng trợ thủ; nhấn Back hoặc nút – để thu lại, ✕ để tắt hẳn.

- **Tải APK:** [github.com/vianphm/TFT/releases/tag/android-latest](https://github.com/vianphm/TFT/releases/tag/android-latest)
  — mở link đó bằng trình duyệt điện thoại, tải file `.apk`, mở ra cài (Android sẽ hỏi cho phép cài từ
  nguồn này). Mỗi lần push, GitHub Actions build lại và cập nhật đúng release đó.
- **Tự build:** mở thư mục `android/` bằng Android Studio, chạy `npm run build:mobile:android` trước
  để nhồi bản web vào assets, rồi Run.
- Lần đầu chạy, app xin quyền **"Hiển thị trên ứng dụng khác"** — đây là quyền Android bắt buộc để vẽ
  đè lên game. Cấp xong bấm *Bật bong bóng nổi trên game* rồi mở TFT.
- App không đọc màn hình, không chạm hộ, không nối vào game — chỉ là một cửa sổ nổi hiển thị bảng tính
  của chính bạn.

> **iPhone không làm được overlay.** iOS không cho phép app vẽ đè lên app khác, không có cách nào lách.
> Trên iPhone chỉ dùng được bản PWA ở mục 1 (chuyển qua lại giữa hai app, hoặc để trên iPad ở chế độ Slide Over).

## Cấu trúc

```
src/main/          tiến trình chính: cửa sổ, phím tắt, cấu hình, đồng bộ dữ liệu, nhập đội hình,
                   máy chủ LAN cho điện thoại
src/preload/       cầu nối IPC an toàn (contextIsolation, renderer không có Node)
src/renderer/      giao diện PC: overlay/, dashboard/, settings/
src/renderer/shared/  dùng chung cho tất cả: tables.js (số liệu), calc.js (xác suất, kinh tế, đồ),
                   analyzer.js (tộc hệ, tối ưu đội hình), cdragon.js (đọc dữ liệu set)
src/mobile/        bản web cho điện thoại (PWA), cũng là ruột của app Android
api/               serverless function của Vercel: cầu lấy dữ liệu set, cắt gọn cho điện thoại
src/shared/data/   dữ liệu đóng gói sẵn (đội hình mẫu, bộ dữ liệu dự phòng)
android/           app Android: bong bóng nổi đè lên game (Kotlin + WebView)
scripts/           tạo icon, dữ liệu dự phòng, gom bản mobile, smoke test giao diện
test/              kiểm thử logic tính toán và bộ phân tích đội hình
```

Cấu hình + cache lưu tại thư mục userData của Electron (Cài đặt → *Mở thư mục cấu hình*).

## Số liệu trong app

Bảng tỉ lệ cửa hàng theo cấp, kho tướng, XP, lãi và thưởng chuỗi nằm ở
`src/renderer/shared/tables.js`. Riot có chỉnh các con số này giữa các set — sửa trực tiếp file đó
là mọi phần tính toán cập nhật theo, không cần đổi gì khác.

## Bộ phân tích đội hình

`src/renderer/shared/analyzer.js` làm việc trên dữ liệu chính thức của set (tướng + tộc hệ), không cần
trang meta nào:

- **Tộc hệ đang bật**: đếm theo từng mốc, chỉ ra tộc hệ nào chỉ còn thiếu 1 tướng là lên mốc.
- **Nên thêm tướng nào**: xếp hạng theo mức điểm tăng thêm, ưu tiên tướng rẻ khi điểm ngang nhau.
- **Tự tìm tổ hợp tối ưu**: beam search chọn N tướng (N = cấp của bạn), giữ lại carry bạn đang cầm,
  chặn theo giá tối đa. Cách chấm điểm: mốc càng cao điểm tăng càng nhanh (nên nó ưu tiên bật sâu thay
  vì bật rộng), tướng không đóng góp mốc nào bị trừ điểm, tổng giá cao bị trừ nhẹ.
- **Kế hoạch ghép đồ** (`calc.bestItemPlan`): từ túi đồ hiện có và danh sách trang bị của đội hình,
  tính ghép được món nào trước, còn thiếu đúng món cơ bản nào, thừa gì.
- **Chia đồ cho cả đội** (`calc.assignItems`): rải món cơ bản cho từng tướng, carry được ưu tiên,
  không dùng trùng một món cho hai tướng.
- **Nên chuyển sang đội hình nào** (`analyzer.pivotSuggestions`): với những tướng đang cầm, ước lượng
  số vàng còn phải bỏ ra để gom đủ từng đội hình trong thư viện (theo tỉ lệ roll ở cấp hiện tại và số
  bản sao cần cho mức sao), rồi xếp hạng theo điểm tộc hệ chia cho chi phí.
- **Roll ngay, lên cấp, hay chờ** (`calc.rollVsLevel`): tính xác suất trúng của cả ba phương án với
  cùng số vàng đang có.

Vài con số rút ra từ chính mô hình này (săn tướng 4 vàng, cần 2 bản sao, 3 bản đã bị người khác cầm):

| Vàng | Roll ở cấp 7 | Lên 8 (tốn 48v) rồi roll |
|---|---|---|
| 60 | 39.0% | 5.9% |
| 100 | 65.7% | 51.2% |
| 150 | 85.0% | 85.0% |
| 200 | 93.9% | 96.1% |

Nghĩa là từ 0 XP, tiền mua XP đắt đến mức phải trên khoảng 150 vàng thì lên cấp mới bắt đầu có lợi.
Ngược lại nếu chỉ còn 4 XP nữa là lên cấp, lên cấp thắng ở mọi mức vàng (60v: 55.1% so với 39.0%).

Muốn đổi khẩu vị thì sửa `DEFAULT_WEIGHTS` trong `analyzer.js`.

## Chưa làm (nếu cần thì làm tiếp)

- Bộ đọc riêng cho từng trang meta (chính xác hơn cách dò theo từ khoá hiện tại).
- Lịch sử đấu / thống kê qua Riot API (cần API key).
- Tự nhận diện vòng đấu và số vàng bằng OCR.
- Gửi ngược đội hình sửa trên điện thoại về PC (hiện đang một chiều PC → điện thoại).
