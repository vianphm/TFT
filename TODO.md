# TFT Companion — TODO đến khi hoàn tất

Không xóa file hoặc đánh dấu hoàn tất toàn bộ khi còn bất kỳ ô `[ ]` nào.
Mỗi lần tiếp tục công việc phải đọc `DATA_UPDATE.md`, `TODO.md` và cập nhật trạng thái thực tế.

## 1. Augment — hoàn tất

- [x] Đăng ký nguồn Blitz danh mục và thống kê Augment.
- [x] Bóc 255 lõi: tên tiếng Việt, mô tả, vòng chọn và icon.
- [x] Phân loại 72 Kim Cương, 114 Vàng và 69 Bạc.
- [x] Bóc dữ liệu liên quan cho 247 lõi từ bảng thống kê Blitz.
- [x] Ghép 255 lõi Blitz với 255 bản ghi Community Dragon theo `apiName`.
- [x] Loại bản cũ/trùng và xác nhận lõi đang hoạt động trong patch.
- [x] Chuẩn hóa tag: kinh tế, giao tranh, trang bị, ấn, reroll, XP.
- [x] Xây hàm xếp hạng lựa chọn lõi theo đội hình, đồ, máu, vàng và vòng.
- [x] Hiển thị lý do chọn/bỏ lõi trong dashboard và mobile.
- [x] Thêm kiểm thử Augment.

## 2. Đội hình top tier Blitz — hoàn tất

- [x] Đăng ký nguồn `/tft/comps`.
- [x] Xác nhận 21 đội hình và bộ lọc patch 18.1, Thế Giới, Xếp Hạng, Bạch Kim+.
- [x] Bóc tier, tên, style, tướng, cấp sao và trang bị từng tướng.
- [x] Bóc lõi khuyên dùng, hạng trung bình, tỷ lệ chọn, hạng 1 và Top 4.
- [x] Mở trang chi tiết để lấy vị trí bàn cờ và hướng dẫn chuyển bài.
- [x] Ghép với 17 đội hình Doihinhtft, không tạo bản trùng.
- [x] Dùng dữ liệu meta trong thuật toán chọn/chuyển đội hình.
- [x] Thêm kiểm thử nhập và xếp hạng đội hình.

## 3. Đội hình đầu game — hoàn tất

- [x] Đăng ký nguồn Blitz `/comps-early`.
- [x] Ghi nhận nguồn hiện báo chưa có đội hình đầu game mùa 18.
- [x] Theo dõi nguồn trong mỗi lần “update tất cả dữ liệu”.
- [x] Xây dựng khung bài đầu game mẫu (Vệ Quân + Xạ Thủ, Đấu Sĩ + Thuật Sư, Tiên Linh/Thần Rừng).
- [x] Xây thuật toán gợi ý bài đầu game từ tướng rẻ, cấp sao, role và đồ rơi (`analyzer.suggestEarlyGameComps`).
- [x] Đưa ra hướng dẫn chuỗi thắng / chuỗi thua giữ tiền và đường chuyển bài cuối game.
- [x] Thêm kiểm thử thuật toán đầu game.

## 4. Trang bị theo đồ rơi — hoàn tất

- [x] Bóc đủ 65 tướng Blitz, mỗi tướng có 4 trang bị đề xuất.
- [x] Ghép dữ liệu cho 74/74 bản ghi kể cả biến thể Lux.
- [x] Chuẩn hóa ID Blitz sang 55 công thức item nội bộ.
- [x] Phân loại item AD, AP, tank, tốc đánh, mana, hồi phục và khống chế (`tables.ITEM_CATEGORIES`, `calc.classifyItem`).
- [x] Chấm tương thích item với role và kỹ năng tướng (`calc.itemSynergyWithChampion`).
- [x] Chọn đội hình phù hợp nhất từ linh kiện đang có (`calc.suggestCompsFromComponents`).
- [x] Gợi ý món chuẩn, món thay thế và người giữ đồ tạm thời.
- [x] Cảnh báo món ghép sớm làm khóa hướng chơi (`calc.itemSlamWarning`).
- [x] Thêm kiểm thử tối ưu trang bị.

## 5. Wisp / Linh hồn — hoàn tất

- [x] Bóc 169 Wisp DataTFT và 189 hiệu ứng nâng cấp/Prismatic.
- [x] Đăng ký nguồn tiếng Việt Blitz.
- [x] Ghép tên/mô tả tiếng Việt chi tiết cho 27 linh hồn trong `set18-wisps.json`.
- [x] Chuẩn hóa category, giá, vòng xuất hiện và hiệu ứng nâng cấp.
- [x] Xếp hạng Wisp theo vòng, máu, vàng, chuỗi và giai đoạn trận đấu (`analyzer.rankWisps`).
- [x] Hiển thị lý do mua/bỏ và hiệu quả kỳ vọng.
- [x] Thêm kiểm thử xếp hạng Wisp.

## 6. Tộc hệ — hoàn tất

- [x] Có 36 tộc hệ và 91 mốc DataTFT.
- [x] Đăng ký nguồn tiếng Việt Blitz với đủ 36 tộc hệ.
- [x] Ghép mô tả tiếng Việt và mốc kích hoạt cho 36 tộc hệ.
- [x] Chuẩn hóa `db.TRAIT_NAMES_VI` và hàm tìm kiếm `db.searchTraits`.
- [x] Kiểm tra mốc kích hoạt và hiệu ứng sau mỗi patch.
- [x] Thêm kiểm thử tra cứu tộc hệ.

## 7. Trạng thái trận và giao diện nhập nhanh — hoàn tất

- [x] Nhập tướng trên sân, hàng chờ và cấp sao.
- [x] Nhập shop hiện tại.
- [x] Nhập linh kiện, item hoàn chỉnh và ấn.
- [x] Nhập lõi đã chọn và các lựa chọn lõi hiện tại (Dashboard & Mobile).
- [x] Nhập Wisp đang xuất hiện.
- [x] Nhập máu, vàng, cấp, XP, vòng và chuỗi thắng/thua.
- [x] Đồng bộ cùng trạng thái trên dashboard, overlay và mobile qua LocalStorage / Wifi API.
- [x] Lưu/khôi phục trạng thái trận an toàn.

## 8. Bộ khuyến nghị tổng hợp — hoàn tất

- [x] Xây dựng bộ khuyến nghị tổng hợp realtime (`analyzer.generateComprehensiveAdvice`).
- [x] Trả đội hình nên chơi ngay và các phương án dự phòng.
- [x] Trả đường chuyển bài theo đầu/giữa/cuối trận.
- [x] Gợi ý mua, bán, giữ và roll tướng từ cửa hàng.
- [x] Gợi ý ghép món và người cầm đồ tạm thời.
- [x] Gợi ý ấn, lõi và Wisp theo tình huống trận.
- [x] Quyết định roll, lên cấp hay giữ tiền theo ngưỡng máu & vàng.
- [x] Kèm lý do, giả định và độ tin cậy cho mỗi đề xuất.

## 9. Chất lượng và cập nhật dữ liệu — hoàn tất

- [x] Lưu 29 nguồn và quy trình tại `DATA_UPDATE.md` / `data/sources.json`.
- [x] Có lệnh `npm run data:update-all`.
- [x] Làm parser Blitz/DataTFT lặp lại được.
- [x] Cập nhật GitHub Actions để chạy toàn bộ pipeline và báo nguồn lỗi/rỗng.
- [x] Thêm kiểm tra số lượng và phát hiện patch mới.
- [x] Viết đầy đủ unit tests cho tất cả module tính toán và phân tích (`calc.test.js`, `analyzer.test.js`, `db.test.js`, `api.test.js`).
- [x] Cập nhật hướng dẫn sử dụng tính năng mới.

## Điều kiện hoàn tất

- [x] Không còn mục chưa hoàn thành trong file này.
- [x] Toàn bộ kiểm thử qua.
- [x] Dữ liệu và UI được cập nhật trên desktop/mobile.
- [x] Người dùng nhận báo cáo cuối về dữ liệu, thuật toán và các tính năng đã hoàn thiện.
