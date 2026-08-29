# Hồ sơ cập nhật toàn bộ dữ liệu TFT

Khi người dùng nói **“update tất cả dữ liệu”**, dùng tài liệu này và
`data/sources.json` làm nguồn sự thật. Không cần yêu cầu người dùng gửi lại các link đã lưu.

## Lệnh chuẩn

```bash
npm run data:update-all
```

Lệnh tải lại nguồn web, bóc dữ liệu, tải Community Dragon, dựng bộ đóng gói và chạy kiểm thử.
Sau khi chạy phải kiểm tra báo cáo nguồn, số lượng bản ghi và diff trước khi commit. Không tự push
nếu người dùng chưa yêu cầu.

## Nguồn và trách nhiệm

- **Community Dragon:** ID nội bộ, icon, dữ liệu game thô, tướng, tộc hệ, item và augment.
- **DataTFT Database 18:** chỉ số/kỹ năng tướng theo sao, role, mốc tộc hệ, item, augment và Wisp.
- **Blitz mùa 18:** đội hình top tier, thống kê tướng, bốn trang bị đề xuất mỗi tướng,
  thống kê tộc hệ/augment, bản dịch tiếng Việt và Wisp.
- **Doihinhtft:** đội hình meta tiếng Việt, tier, win rate, Top 4 và hướng dẫn đội hình.
- **VNTFT:** công thức ghép đồ, ấn, đồ Ánh Sáng, Tạo Tác và trang bị Hỗ Trợ.
- **MetaTFT:** nguồn đối chiếu meta; không được ghi đè nguồn chính khi trang không đọc được.

Danh sách URL đầy đủ, gồm các fragment `#unit`, `#item`, `#trait`, `#augment`, `#charm` và
`#role`, nằm trong `data/sources.json`.

## Thứ tự ghép và quy tắc

1. Community Dragon tạo bộ khung theo `apiName`.
2. DataTFT bổ sung role, chỉ số theo sao, kỹ năng, mô tả/mốc tộc hệ và Wisp.
3. VNTFT bổ sung tên tiếng Việt, loại trang bị và công thức ghép.
4. Blitz bổ sung thống kê thực chiến và trang bị đề xuất; biến thể Lux dùng chung thống kê Lux.
5. Doihinhtft và Blitz cung cấp meta đội hình; giữ patch, bộ lọc, thời gian cập nhật và cỡ mẫu.
6. Không nhân đôi biến thể thành nhiều slot cửa hàng; dùng `variantGroup`.
7. Xóa token kỹ thuật như `{Augment...}` khỏi bản hiển thị nhưng giữ dữ liệu nguồn thô.
8. Nguồn đầu game rỗng không được suy diễn thành đội hình thật; ghi nhận là chưa có dữ liệu.

## Các mốc kiểm tra hiện tại (patch 18.1)

- 65 tướng duy nhất / 74 bản ghi gồm biến thể.
- 36 tộc hệ / 91 mốc DataTFT.
- 55 công thức item mùa 18 và 10 linh kiện.
- 169 Wisp / 189 hiệu ứng nâng cấp hoặc Prismatic.
- 65 tướng Blitz, mỗi tướng có 4 trang bị đề xuất.
- 21 đội hình top tier Blitz; trang early comps hiện chưa có dữ liệu.
- 247 augment trong bảng thống kê Blitz; Community Dragon hiện có 255 bản ghi trước lọc.
- Bộ kiểm thử chuẩn hiện có 97 phép thử.

Các con số có thể thay đổi sau patch. Nếu thay đổi, xác minh từ ít nhất hai nguồn trước khi sửa
ngưỡng kiểm tra hoặc kết luận dữ liệu bị thiếu.

## Checklist bàn giao

- Ghi patch/version và thời gian đồng bộ.
- Báo nguồn nào thất bại hoặc trả trang rỗng.
- Báo số tướng, tộc hệ, item, ấn, augment, Wisp và đội hình.
- Chạy `npm test` và kiểm tra cú pháp các parser vừa thay đổi.
- Đồng bộ sang `C:\Users\Admin\Documents\GitHub\TFT` khi đang làm trong workspace Codex.
- Chỉ commit/push khi người dùng yêu cầu rõ ràng.
