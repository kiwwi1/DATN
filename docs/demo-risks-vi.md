# Rủi ro khi Demo Đồ án — DATN

Tài liệu liệt kê các luồng hiện có có thể gây lỗi/khó xử khi demo trực tiếp, kèm cách phòng tránh hoặc né. Mục đích: chạy demo mượt, không vướng câu hỏi phản biện do lỗi vận hành.

> Cập nhật: 2026-05-29 · Branch: `feature/HR03` (repo mint-app — đánh giá DATN ở `d:\Code\DATN`).

## 1. Mức ưu tiên & cách đọc

- 🔴 **CAO** — gần như chắc chắn sẽ vấp phải nếu demo theo kịch bản thông thường.
- 🟡 **TRUNG** — chỉ xảy ra ở edge case hoặc khi mạng/cấu hình lệch.
- 🟢 **THẤP** — hiếm gặp, nhưng nên biết để giải thích nếu hội đồng thấy.

Mỗi mục có: **Triệu chứng → Nguyên nhân → Cách phòng tránh khi demo**.

---

## 2. Auth & Đăng ký

### 2.1. 🔴 Đăng ký → OTP không vào hộp thư đúng giờ
- **Triệu chứng:** demo "đăng ký + xác minh email" mà OTP chưa đến → bị treo ở màn nhập OTP.
- **Nguyên nhân:** `userService.js` gọi Gmail SMTP (`MAIL_USER` + App Password). Mạng wifi trường + Gmail có thể delay 30s–2 phút; nếu App Password sai hoặc 2FA Google bị disable → `sendVerificationEmail` throw nhưng user đã được tạo, OTP đã lưu DB.
- **Phòng tránh:**
  - Tạo sẵn 1–2 tài khoản đã verified trước demo.
  - Hoặc giữ trang đăng ký để demo "form đẹp", thực tế chỉ login.
  - Nếu vẫn muốn demo OTP: chuẩn bị email đã test trước 10 phút.

### 2.2. 🔴 Email đã đăng ký nhưng `emailVerified=false` → login fail im lặng
- **Triệu chứng:** đăng ký nhưng quên xác minh, lần sau login báo "Email chưa được xác minh".
- **Nguyên nhân:** `loginUserService` ([userService.js:27](DATN/backend/services/userService.js#L27)) chặn user chưa verify.
- **Phòng tránh:** demo tài khoản đã verify; tránh tạo mới tại chỗ.

### 2.3. 🟡 Rate-limit login bằng IP
- **Triệu chứng:** thử sai password vài lần → bị 429.
- **Nguyên nhân:** `loginRateLimit` mặc định `AUTH_RL_MAX_LOGIN_IP=20` / 15 phút. Nếu Redis không up → fallback `Map` in-memory, vẫn chặn.
- **Phòng tránh:** nhập đúng password ngay; nếu lỡ sai nhiều, restart backend để reset fallback Map.

### 2.4. 🟡 Google login fail vì `GOOGLE_CLIENT_ID` mismatch domain
- **Triệu chứng:** popup Google login rồi báo "Đăng nhập Google thất bại".
- **Nguyên nhân:** `GOOGLE_CLIENT_ID` chỉ accept origin đã đăng ký trên Google Console. `localhost:5173` cần được liệt kê.
- **Phòng tránh:** test Google login trước demo; nếu chạy IP khác hoặc tunnel ngrok → fallback dùng login email/password.

### 2.5. 🟡 Quên mật khẩu → link reset trỏ về `localhost:5173`
- **Triệu chứng:** demo trên máy khác, click link reset từ email → 404 vì máy đó không có dev server.
- **Nguyên nhân:** `userService.js` build `resetUrl` từ `FRONTEND_URL` env. Nếu env chưa set, dùng `http://localhost:5173`.
- **Phòng tránh:** nếu demo qua mạng → set `FRONTEND_URL` đúng IP/domain trước.

---

## 3. Cart & Stock

### 3.1. 🔴 Thêm vào giỏ KHÔNG check stock
- **Triệu chứng:** thêm 999 sản phẩm vào giỏ, demo "giỏ đã có" không lỗi, nhưng đến checkout mới báo `OUT_OF_STOCK`.
- **Nguyên nhân:** `addToCartService` ([cartService.js:54](DATN/backend/services/cartService.js#L54)) không check stock; chỉ trừ stock thật khi `reserveStockByUnits` ở orderService.
- **Phòng tránh:** demo số lượng nhỏ (1–2), đảm bảo product seed có stock đủ.

### 3.2. 🔴 Variant chọn sai → đến checkout mới báo "Variant not found"
- **Triệu chứng:** sản phẩm có biến thể (Size/Màu), bỏ chọn → checkout fail "Missing variant selection".
- **Nguyên nhân:** `enrichItemsWithVariantKey` ([orderService.js:235](DATN/backend/services/orderService.js#L235)) bắt buộc có `variantKey` cho product có variants.
- **Phòng tránh:** trên Product page, luôn click chọn đủ Size/Màu trước khi `Add to cart`.

### 3.3. 🟡 Sản phẩm bị `isActive=false` còn nằm trong giỏ cũ
- **Triệu chứng:** vendor ẩn sản phẩm sau khi user đã add → checkout báo "Product unavailable".
- **Phòng tránh:** không ẩn product trong demo; nếu cần demo ẩn → demo ở tài khoản khác chưa add.

### 3.4. 🟢 Cart bị `sanitizeCartData` xoá item không tồn tại
- Hard-delete product (Vendor → Remove) khi không có order tham chiếu → item biến mất khỏi giỏ user khác. Không hiển thị thông báo.

---

## 4. Checkout & Voucher

### 4.1. 🔴 Voucher hết lượt giữa demo
- **Triệu chứng:** voucher demo dùng nhiều lần khi rehearsal → demo chính báo "Voucher đã hết lượt".
- **Nguyên nhân:** `claimVoucherUsage` tăng `usedCount`; nếu `usageLimit` thấp, dễ hết.
- **Phòng tránh:** trước demo, vào DB hoặc admin reset `usedCount = 0` và `usageLimit ≥ 50`. Tốt nhất tạo voucher mới riêng cho demo, code dễ nhớ (ví dụ `DEMO50`).

### 4.2. 🔴 Voucher SHOP không thuộc đơn → reject im lặng
- **Triệu chứng:** áp voucher shop A nhưng giỏ chỉ có sản phẩm shop B → "Voucher shop khong thuoc don hang nay".
- **Phòng tránh:** demo voucher đúng vendor, hoặc voucher PLATFORM/SHIPPING cho an toàn.

### 4.3. 🟡 Preview pricing có 250ms debounce → race với click "ĐẶT HÀNG"
- Trong [usePlaceOrderCheckout.js:161](DATN/frontend/src/hooks/usePlaceOrderCheckout.js#L161), preview chạy sau 250ms khi voucher thay đổi. Nếu user áp voucher rồi bấm "ĐẶT HÀNG" cực nhanh → submit dùng giá cũ, nhưng backend re-validate strict nên sẽ throw `INVALID_VOUCHER` nếu rejected.
- **Phòng tránh:** chờ 0.5–1s sau khi áp voucher mới bấm đặt hàng.

### 4.4. 🟡 Address book trống → bắt buộc nhập form thủ công
- **Triệu chứng:** demo COD bằng tài khoản mới, không có address → phải nhập đủ tỉnh/phường/đường/SĐT.
- **Phòng tránh:** trước demo seed sẵn 1 default address cho tài khoản demo.

### 4.5. 🟡 Tỉnh/phường load qua `/api/location/provinces` — phụ thuộc nguồn ngoài
- Nếu service trả null/lỗi → dropdown trống, không validate ward được.
- **Phòng tránh:** test `/api/location/provinces` ngay trước demo; chuẩn bị default address để né.

---

## 5. Thanh toán — RỦI RO LỚN NHẤT

### 5.1. 🔴 Stripe — webhook không cấu hình → đơn TREO ở "chờ xác nhận thanh toán"
- **Triệu chứng:** user thanh toán Stripe thành công, redirect về `/verify`, polling 6 lần × 1.5s = 9s, vẫn không thấy `paid=true` → "Thanh toan dang duoc xu ly, vui long kiem tra lai trong don hang".
- **Nguyên nhân:** `verifyStripePayment` controller ([orderController.js:60](DATN/backend/controllers/orderController.js#L60)) chỉ ĐỌC `order.payment`. Field này CHỈ được set bởi `processStripeWebhookService` ([orderService.js:814](DATN/backend/services/orderService.js#L814)) khi Stripe gửi webhook `checkout.session.completed`. Localhost không nhận được webhook nếu chưa chạy `stripe listen --forward-to localhost:4000/api/order/stripe-webhook`.
- **Phòng tránh:**
  - **Trước demo:** chạy `stripe listen --forward-to localhost:4000/api/order/stripe-webhook` ở terminal riêng, copy `whsec_...` vào `STRIPE_WEBHOOK_SECRET`.
  - **Hoặc:** demo COD/VNPay thay vì Stripe.
  - **Hoặc:** chuẩn bị câu giải thích "Stripe production cần webhook URL public; demo local cần Stripe CLI relay" — phòng phản biện.

### 5.2. 🔴 VNPay sandbox — return URL `localhost` bị trình duyệt block khi demo qua tunnel
- **Triệu chứng:** thanh toán VNPay sandbox → khi redirect về `VNP_RETURN_URL=http://localhost:4000/...` bị block (CSP, browser, tunnel).
- **Nguyên nhân:** `VNP_RETURN_URL` mặc định `localhost:4000`. Nếu chạy demo qua ngrok thì VNPay sẽ redirect về localhost không tới được.
- **Phòng tránh:** demo trên cùng máy chạy backend; tránh tunnel. Nếu phải tunnel → set `VNP_RETURN_URL` trỏ tới URL public.

### 5.3. 🔴 Stripe limit ₫99,999,999 — đơn lớn fail
- **Triệu chứng:** đơn tổng vượt giới hạn → backend throw "Tổng đơn hàng vượt quá giới hạn thanh toán Stripe".
- **Nguyên nhân:** [orderService.js:687](DATN/backend/services/orderService.js#L687).
- **Phòng tránh:** demo đơn nhỏ; nếu cần demo đơn lớn → COD.

### 5.4. 🟡 Reservation sweep mỗi 60s — stock kẹt
- Đơn Stripe/VNPay tạo session nhưng user không thanh toán → stock vẫn bị giữ trong `PAYMENT_RESERVATION_TTL_MIN=15` phút. Sweep chỉ chạy mỗi `RESERVATION_SWEEP_INTERVAL_MS=60000`.
- **Phòng tránh:** nếu lỡ tạo session test rồi cancel, đợi 15 phút hoặc giảm `PAYMENT_RESERVATION_TTL_MIN=1` trong `.env` trước demo.

### 5.5. 🟡 Cancel đơn Stripe đã paid → refund chỉ best-effort log warn
- `cancelOrderService` ([orderService.js:945](DATN/backend/services/orderService.js#L945)) catch refund error chỉ log `console.warn`. Khách không biết refund fail.
- **Phòng tránh:** không demo refund Stripe trực tiếp; nếu hội đồng hỏi, giải thích "tích hợp refund qua Stripe Dashboard cho production".

### 5.6. 🟢 VNPay verify dùng `vnp_TransactionNo` truncate `orderInfo` — non-ASCII bị strip
- `buildVNPayUrl` strip ký tự non-ASCII trong `orderInfo`. Demo OK với mã đơn dạng số.

---

## 6. Chat (Socket.IO)

### 6.1. 🔴 Token Socket.IO chỉ dùng `accessToken` (15 phút) — chat đứt khi token hết hạn
- **Triệu chứng:** demo mở vendor dashboard + chat lâu (>15 phút) → socket báo `Unauthorized` khi reconnect.
- **Nguyên nhân:** `server.js` line 109–125 verify `socket.handshake.auth.token` 1 lần lúc connect. Nếu connect cũ disconnect, reconnect với token đã hết hạn → fail.
- **Phòng tránh:** demo chat nhanh trong vòng 10 phút sau login.

### 6.2. 🟡 `join_room` không emit ack — silently fail nếu user không phải member
- Nếu code chat client `join_room` với conversationId của user khác → server `return` không log, không báo. UI sẽ thấy không nhận tin nhắn realtime.
- **Phòng tránh:** chỉ demo chat giữa 2 tài khoản có conversation hợp lệ.

### 6.3. 🟡 Cannot chat with yourself
- Nếu vendor và buyer cùng đăng nhập trên 1 browser session, vendor mở shop của chính mình → `initConversationService` throw "Cannot create chat with yourself".
- **Phòng tránh:** demo bằng 2 trình duyệt khác nhau (Chrome thường + Incognito).

---

## 7. Notification (SSE)

### 7.1. 🔴 SSE đứt khi đổi tab, không auto-reconnect
- **Triệu chứng:** demo notification realtime → để tab background lâu → khi quay lại, không có notif mới.
- **Nguyên nhân:** `App.jsx` (admin) line 105 mở `EventSource`, `es.onerror = () => { es.close(); sseRef.current = null }` — đóng và KHÔNG reconnect.
- **Phòng tránh:** F5 trang admin trước khi demo gửi notification, không để tab background.

### 7.2. 🟡 SSE token query param fallback — bị log lộ trong access log
- `sseStream` ([notificationController.js:20](DATN/backend/controllers/notificationController.js#L20)) còn fallback `req.query.token`. Cookie path là chính nhưng demo qua URL có thể vô tình lộ.
- **Phòng tránh:** không quan trọng cho demo, biết để giải thích.

---

## 8. Vendor & Admin Dashboard

### 8.1. 🔴 Vendor URL hard-code `localhost:5174/add`
- **Triệu chứng:** demo trên máy không có admin app chạy port 5174 → click "đăng ký vendor" mở tab trắng.
- **Nguyên nhân:** [VendorRegis.jsx:24](DATN/frontend/src/pages/auth/VendorRegis.jsx#L24).
- **Phòng tránh:** đảm bảo admin app chạy port 5174 song song, hoặc dùng tài khoản ĐÃ là vendor để né flow này.

### 8.2. 🔴 Add Product — ảnh < 500px short side bị reject
- **Triệu chứng:** demo "thêm sản phẩm", upload ảnh nhỏ → "Image too small. Minimum short side is 500px".
- **Nguyên nhân:** `r2Upload.js` `ensureInputImageSize` ([r2Upload.js:44](DATN/backend/utils/r2Upload.js#L44)). Mặc định `IMAGE_MIN_SHORT_SIDE=500`.
- **Phòng tránh:** chuẩn bị sẵn 4 ảnh ≥ 800×800; nếu hội đồng đưa ảnh nhỏ → giải thích "ràng buộc chất lượng UX".

### 8.3. 🔴 Add Product — R2 không cấu hình → upload throw nhưng product KHÔNG được tạo
- Nếu `R2_ACCESS_KEY`/`R2_BUCKET` sai → `uploadToR2` throw, `addProductService` throw cùng → 500.
- **Phòng tránh:** test add product trước demo, đảm bảo R2 credentials còn valid.

### 8.4. 🔴 AI tạo mô tả — Gemini API timeout 12s → fallback im lặng
- **Triệu chứng:** click "AI tạo mô tả" → spinner xoay 12s → trả về mô tả template generic, người xem không biết là fallback.
- **Nguyên nhân:** `generateProductDescriptionService` timeout `12000ms`, fallback `fallbackDescription` không phân biệt với output AI thật trên UI.
- **Phòng tránh:** test AI tạo mô tả ngay trước demo (1–2 phút trước). Nếu Gemini API fail thì câu giới thiệu nên đổi sang "tính năng AI có sẵn template fallback".

### 8.5. 🔴 Vendor Stats — `vendorOrdersService` find toàn bộ orders
- Đã ghi trong [vendor-module-review-vi.md](DATN/docs/vendor-module-review-vi.md). Demo OK nếu DB nhỏ; nếu hội đồng hỏi "scale", chuẩn bị câu trả lời.

### 8.6. 🟡 Vendor dashboard tab "Đang theo dõi: 13" — hard-code
- Hội đồng tinh ý sẽ phát hiện. Sẵn câu giải thích "placeholder cho feature follow-back chưa hoàn thiện".

### 8.7. 🟡 Hủy đơn ở vendor — chỉ trạng thái `Order Placed` / `Packing` mới hủy được
- [orderService.js:866](DATN/backend/services/orderService.js#L866) hard-code `CANCELLABLE_STATUSES`. Nếu đơn đã `Shipped`, hủy sẽ throw.
- **Phòng tránh:** demo hủy đơn ngay sau khi đặt, đừng đổi trạng thái sang Shipped trước.

---

## 9. Review

### 9.1. 🔴 Chỉ review được khi `order.status === "Delivered"`
- **Triệu chứng:** demo review nhưng đơn còn `Packing` → "Bạn chỉ có thể đánh giá sản phẩm sau khi đã nhận hàng".
- **Phòng tránh:** chuẩn bị sẵn đơn `Delivered` trong DB cho tài khoản demo.

### 9.2. 🟡 Upload >5 ảnh review → 400
- [reviewService.js:53](DATN/backend/services/reviewService.js#L53). Tránh demo upload nhiều ảnh.

---

## 10. Shop Follow

### 10.1. 🟢 Self-follow chặn ở backend nhưng UI vẫn click được
- `followShopService` throw "Không thể tự theo dõi chính mình". Demo bằng tài khoản khác, không demo vendor follow chính shop mình.

---

## 11. Address Book

### 11.1. 🟡 Normalize phone bắt buộc bắt đầu `0`/`+84`/`84`
- Số nhập sai format → "Số điện thoại không hợp lệ".
- **Phòng tránh:** dùng số dạng `0901234567`.

### 11.2. 🟡 Delete default address → tự promote address mới làm default
- OK về logic, nhưng UI có thể không refresh ngay → giải thích nếu hội đồng thấy lạ.

---

## 12. Race Conditions & Idempotency

### 12.1. 🟡 Double-click "ĐẶT HÀNG" → bị `inFlightRef` chặn ở FE, idempotencyKey chặn ở BE
- Đã xử lý tốt — `checkoutKeyRef` + unique index `userId+idempotencyKey`. Mention được điểm này nếu hội đồng hỏi về concurrency.

### 12.2. 🟡 Reserve stock không atomic với tạo order
- Nếu `orderModel.create` fail sau khi `reserveStockByUnits` thành công → có `releaseStockByItems` rollback. Nhưng nếu Node process crash giữa chừng → stock kẹt cho đến `RESERVATION_SWEEP_INTERVAL_MS`.
- **Phòng tránh:** demo bình thường không trigger.

---

## 13. Môi trường / Cấu hình

### 13.1. 🔴 Redis không up → rate-limit fallback in-memory, OK; nhưng nếu restart backend trong demo → counter reset bất thường
- **Phòng tránh:** đảm bảo Redis chạy hoặc tránh restart backend giữa demo.

### 13.2. 🔴 CORS `allowedOrigins` chỉ accept origin trong `CORS_ORIGINS`
- Nếu demo trên IP khác `localhost`, request sẽ 403 CORS im lặng (frontend chỉ thấy "Network error").
- **Phòng tránh:** set `CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://<ip-demo>:5173` trước demo.

### 13.3. 🔴 `MONGODB_URI` MongoDB Atlas — IP demo phải nằm trong whitelist
- Trường demo IP khác máy dev → Atlas chặn → backend không connect được.
- **Phòng tránh:** trước demo bật Atlas IP whitelist `0.0.0.0/0` tạm thời (rủi ro bảo mật, gỡ sau).

### 13.4. 🔴 `JWT_SECRET` thiếu trên production mode → throw lúc start
- `server.js:50` enforce production check. Demo chạy `NODE_ENV !== production` để né.

### 13.5. 🟡 Frontend env chỉ có `VITE_BACKEND_URL` — không có flag toggle demo mode
- Không thể tắt Stripe/VNPay button nếu chưa cấu hình → click sẽ fail.
- **Phòng tránh:** demo chỉ click các phương thức đã chuẩn bị.

---

## 14. Kịch bản demo an toàn (đề xuất)

Theo thứ tự để né hết các 🔴 chính:

1. **Trang chủ** — show product list, search, filter danh mục.
2. **Login** bằng tài khoản đã verified sẵn (không demo đăng ký mới).
3. **Product detail** — chọn variant (Size+Màu), thêm vào giỏ.
4. **Cart** — chọn item, áp voucher `DEMO50` (PLATFORM, đã reset usedCount).
5. **Checkout** — dùng default address có sẵn, chọn **COD** (né Stripe/VNPay webhook).
6. **Orders** — show đơn vừa đặt.
7. **Hủy đơn** (status còn `Order Placed`) để demo cancel flow.
8. **Vendor dashboard** (mở tab admin port 5174) — login lại bằng tài khoản vendor, show Stats, Orders.
9. **Add Product** — chuẩn bị sẵn 4 ảnh ≥ 800×800, demo AI tạo mô tả.
10. **Chat** — mở 2 trình duyệt (1 buyer, 1 vendor), demo realtime trong < 10 phút.
11. **Review** — vào đơn `Delivered` đã seed sẵn, review 1 sản phẩm.

**Tránh:**
- ❌ Đăng ký mới + chờ OTP.
- ❌ Stripe nếu không có Stripe CLI chạy.
- ❌ VNPay nếu demo qua tunnel.
- ❌ Refund.
- ❌ Đơn lớn > ₫99,999,999.
- ❌ Để tab admin background quá lâu rồi quay lại demo SSE.

---

## 15. Checklist 30 phút trước demo

- [ ] Redis up (`redis-cli ping` → PONG).
- [ ] MongoDB Atlas IP whitelist mở.
- [ ] Backend chạy, log "Server is running on port 4000" + "[redis] Connected".
- [ ] Frontend chạy port 5173. Admin chạy port 5174.
- [ ] Login bằng tài khoản demo (buyer + vendor) → confirm cookie set OK.
- [ ] Default address tồn tại cho tài khoản buyer.
- [ ] Voucher `DEMO50` (hoặc tên khác) — `usedCount=0`, `usageLimit≥50`, `isActive=true`, in date range.
- [ ] Ít nhất 1 đơn `Delivered` đã có để demo review.
- [ ] Stripe CLI relay (nếu định demo Stripe): `stripe listen --forward-to localhost:4000/api/order/stripe-webhook` + cập nhật `STRIPE_WEBHOOK_SECRET`.
- [ ] Gemini API key còn quota (test 1 lần "AI tạo mô tả").
- [ ] R2 upload thử 1 ảnh ≥ 800×800 — OK.
- [ ] Chat thử giữa 2 tài khoản — tin nhắn realtime hoạt động.
- [ ] Khoá `CORS_ORIGINS` đúng tất cả origin demo.

---

## 16. Tài liệu liên quan
- [vendor-module-review-vi.md](DATN/docs/vendor-module-review-vi.md) — đánh giá module Vendor.
- [auth-unified-user-vendor.md](DATN/docs/auth-unified-user-vendor.md) — kiến trúc auth.
- [voucher-discount-system-plan-vi.md](DATN/docs/voucher-discount-system-plan-vi.md) — voucher system.
- [concurrent-purchase-stock-plan-vi.md](DATN/docs/concurrent-purchase-stock-plan-vi.md) — stock concurrency.
- [redis-auth-security-plan-vi.md](DATN/docs/redis-auth-security-plan-vi.md) — Redis security.
