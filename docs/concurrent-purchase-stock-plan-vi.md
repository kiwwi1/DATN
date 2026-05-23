# Kế Hoạch Xử Lý Nhiều User Cùng Mua 1 Sản Phẩm (Chống Oversell)

## Trạng thái triển khai (cập nhật 2026-05-21)
- [x] Phase 1: Reserve/release stock theo hướng atomic trong `orderService`.
- [x] Phase 2: COD/Stripe/VNPay chuyển sang reserve trước, callback payment chỉ confirm.
- [x] Phase 3: Có job quét timeout để release stock đơn chờ thanh toán quá hạn.
- [x] Phase 4: Đã thêm `idempotencyKey` + unique index theo `(userId, idempotencyKey)`.
- [ ] Phase 5: Redis lock theo SKU nóng (chưa triển khai, sẽ làm sau khi ổn định production metrics).

## 1) Mục tiêu
- Không cho tồn kho âm khi nhiều người checkout cùng lúc.
- Không tạo đơn vượt quá số lượng tồn thực tế.
- Luồng COD, Stripe, VNPay dùng cùng một cơ chế giữ kho rõ ràng và idempotent.
- Có khả năng scale nhiều instance backend.

## 2) Hiện trạng và rủi ro trong code
- Đơn đang được tạo trước, trừ kho sau:
  - `backend/services/orderService.js` (`placeOrderService`, `placeOrderStripeService`, `placeOrderVNPayService`)
- Trừ kho variant theo kiểu read-modify-write:
  - Đọc product -> sửa `variants[].stock` -> `save()`
  - Không có điều kiện atomic kiểu `stock >= quantity`
- Online payment (Stripe/VNPay) chỉ trừ kho sau callback thanh toán:
  - Nếu nhiều user thanh toán gần đồng thời có thể oversell.

## 3) Nguyên tắc kỹ thuật
1. Database là source of truth cho tồn kho.
2. Mọi thao tác giảm kho phải atomic, có điều kiện đủ hàng.
3. Không trừ kho ở nhiều nơi cho cùng một đơn.
4. Callback thanh toán phải idempotent.
5. Có cơ chế tự hoàn kho khi đơn chờ thanh toán quá hạn.

## 4) Thiết kế trạng thái đơn hàng
- `PENDING_PAYMENT`: đã giữ kho, đang chờ thanh toán.
- `CONFIRMED`: thanh toán thành công hoặc COD xác nhận.
- `CANCELLED`: hủy bởi user/vendor/admin.
- `EXPIRED`: quá thời gian thanh toán, hệ thống tự hủy.

Ghi chú:
- COD: có thể đi thẳng `CONFIRMED` sau khi giữ kho thành công.
- Stripe/VNPay: bắt buộc qua `PENDING_PAYMENT` rồi chuyển `CONFIRMED` khi callback thành công.

## 5) Kế hoạch triển khai theo phase

## Phase 1 - Chặn oversell ngay (ưu tiên cao)
1. Tạo hàm `reserveStock(items)` trong `orderService`:
   - Với từng item, dùng update atomic với điều kiện đủ hàng.
   - Nếu thiếu hàng ở bất kỳ item nào, rollback các item đã giữ trước đó.
2. Tạo hàm `releaseStock(items)`:
   - Hoàn kho atomic khi rollback hoặc khi đơn fail.
3. Thay luồng đặt đơn:
   - Reserve kho thành công rồi mới tạo order.
   - Reserve fail thì trả lỗi `OUT_OF_STOCK`.

Kết quả mong đợi:
- Không còn trường hợp cùng lúc mua dẫn đến tồn âm.

## Phase 2 - Chuẩn hóa payment flow
1. Stripe/VNPay:
   - `placeOrder*`: reserve trước, tạo đơn `PENDING_PAYMENT`, lưu `reservationExpiresAt`.
   - `verify*`: chỉ đổi trạng thái sang `CONFIRMED`, không trừ kho lần nữa.
2. COD:
   - Reserve thành công -> tạo `CONFIRMED`.

Kết quả mong đợi:
- Chỉ có 1 điểm trừ kho duy nhất, tránh double decrement.

## Phase 3 - Timeout và auto release
1. Thêm job định kỳ (mỗi 1 phút):
   - Quét order `PENDING_PAYMENT` đã quá `reservationExpiresAt`.
   - Chuyển `EXPIRED` và gọi `releaseStock`.
2. Bảo vệ idempotent khi release:
   - Thêm cờ như `stockReleasedAt` để tránh hoàn kho lặp.

Kết quả mong đợi:
- Kho không bị giữ vô thời hạn bởi đơn chưa thanh toán.

## Phase 4 - Idempotency chống double submit/callback lặp
1. API đặt hàng nhận `idempotencyKey` từ client.
2. Tạo unique index `(userId, idempotencyKey)` trong order.
3. Callback Stripe/VNPay:
   - Dùng transaction/reference ID để bỏ qua callback trùng.

Kết quả mong đợi:
- Không tạo trùng đơn, không xử lý trùng callback.

## Phase 5 - Redis lock (tùy chọn, sau khi atomic DB đã ổn)
1. Dùng lock ngắn theo SKU nóng:
   - key gợi ý: `stock:lock:{productId}:{variantKey}`
2. TTL lock ngắn (ví dụ 3-5 giây), chỉ để giảm contention.
3. Vẫn phải giữ điều kiện atomic ở MongoDB.

Kết quả mong đợi:
- Giảm tranh chấp ở sản phẩm flash-sale/high traffic.

## 6) Điều chỉnh schema đề xuất
1. `orderModel`:
   - `idempotencyKey: String`
   - `reservationExpiresAt: Number`
   - `stockReservedAt: Number`
   - `stockReleasedAt: Number`
   - unique index `(userId, idempotencyKey)` (partial nếu cần)
2. `productModel`:
   - Chuẩn hóa định danh variant (`variantKey`) để update chính xác.
   - Hoặc tách tồn kho variant sang collection riêng nếu muốn scale mạnh hơn.

## 7) API/response contract đề xuất
- Khi thiếu hàng:
  - HTTP `409`
  - body:
  - `code: "OUT_OF_STOCK"`
  - `items: [{ productId, variantKey, requested, available }]`
- Khi callback trùng:
  - Trả thành công idempotent, không thay đổi tồn kho thêm lần nữa.

## 8) Kiểm thử bắt buộc
1. Concurrency test:
   - 50-200 request cùng mua 1 SKU có stock nhỏ (ví dụ 10).
2. Assertion:
   - `stock` không âm.
   - Số lượng đã bán + tồn kho luôn bảo toàn.
   - Số đơn thành công không vượt quá stock ban đầu.
3. Test callback lặp:
   - Gửi callback payment 2-3 lần, kết quả kho và trạng thái đơn không sai lệch.
4. Test timeout:
   - Đơn `PENDING_PAYMENT` hết hạn phải release kho chính xác.

## 9) Theo dõi vận hành
- Thêm metrics/log:
  - `stock_reserve_success`
  - `stock_reserve_fail`
  - `stock_release_success`
  - `payment_callback_duplicate`
  - `order_expired_release`
- Alert khi tỷ lệ `stock_reserve_fail` tăng bất thường.

## 10) Lộ trình thực thi ngắn
1. Hoàn thành `reserveStock/releaseStock` atomic.
2. Refactor luồng COD/Stripe/VNPay theo `reserve -> create/confirm`.
3. Bổ sung timeout job.
4. Bổ sung idempotency key + index.
5. Viết test đồng thời và test callback lặp.

## 11) Phạm vi ngoài kế hoạch này
- Chưa bao gồm phân bổ kho theo nhiều kho vật lý.
- Chưa bao gồm chiến lược pre-order/backorder.
- Chưa bao gồm event-driven tách riêng inventory service.
