# Đánh giá module Vendor — DATN

Tài liệu rà soát điểm mạnh / điểm cần cải thiện của phần Vendor (người bán) trong repo, kèm đề xuất ưu tiên. Phục vụ cho việc bảo trì và mở rộng giai đoạn tiếp theo.

## 1. Phạm vi rà soát

### Backend
- `backend/middleware/vendorAuth.js`
- `backend/models/userModel.js` (vendor là `role: 'vendor'` trên cùng schema user)
- `backend/services/userService.js` — `registerVendorService`
- `backend/services/productService.js` — ownership check, `getVendorShopPublicService`, `listVendorProductsService`
- `backend/services/order/orderStatusService.js` — `vendorOrdersService`, `updateVendorOrderStatusService`, `deriveOrderStatusFromVendors`
- `backend/services/order/orderAnalyticsService.js` — `vendorStatsService`
- `backend/routes/productRoute.js`, `backend/routes/orderRoute.js`, `backend/routes/userRoute.js`

### Frontend storefront
- `frontend/src/pages/auth/VendorRegis.jsx`
- `frontend/src/pages/main/VendorShop.jsx`

### Admin (vendor dashboard)
- `admin/src/App.jsx`
- `admin/src/components/VendorValidator.jsx`
- `admin/src/components/Login.jsx`
- `admin/src/pages/Stats.jsx`, `Orders.jsx`, `Add.jsx`

### Tài liệu liên quan
- `docs/auth-unified-user-vendor.md`

## 2. Điểm mạnh

1. **Mô hình tài khoản hợp nhất user/vendor đúng hướng nghiệp vụ.**
   - Cùng một `userModel`, chỉ nâng cấp `role: 'vendor'` khi đăng ký bán hàng (`userService.js` — `registerVendorService`).
   - Không có flow login admin riêng, theo đúng quyết định trong `docs/auth-unified-user-vendor.md`. Giảm attack surface, đơn giản UX.

2. **Auth dashboard đã chuẩn hóa.**
   - Dùng HttpOnly cookie + refresh token (`admin/src/App.jsx` — `restoreAuth`, `vendorAuth.js` đọc `cookies.accessToken`).
   - Không còn rò token qua URL query như các phiên bản cũ.

3. **Kiểm soát ownership rõ ràng.**
   - Mọi mutation product đều check `product.vendorId === req.vendorId` (`productService.js` ở `removeProductService`, `toggleProductActiveService`, `updateProductService`).
   - Vendor A không thể sửa/xóa sản phẩm của vendor B.

4. **Multi-vendor order tốt.**
   - `orderModel` có `vendors[]` với `vendorStatus` riêng cho từng shop.
   - Hàm `deriveOrderStatusFromVendors` (`orderStatusService.js`) suy trạng thái tổng hợp từ trạng thái của từng vendor — mô hình giống Shopee.

5. **Vendor analytics gọn, dùng `Promise.all`.**
   - `vendorStatsService` tính revenue today/week/month/total, top/slow products, low-stock, category breakdown chỉ với 1 query orders + 1 query products.

6. **Bảo vệ tracking number.**
   - Bắt buộc nhập mã vận đơn khi chuyển sang Shipped/Delivered (`orderStatusService.js` — `TRACKING_REQUIRED_*`). Chống lỗi nghiệp vụ.

7. **SSE notification cho vendor dashboard.**
   - `admin/src/App.jsx` mở `EventSource(/api/notification/stream)` — UX real-time khi có đơn mới.

8. **Có tài liệu kiến trúc auth** (`docs/auth-unified-user-vendor.md`) — hiếm gặp ở repo đồ án.

## 3. Điểm cần cải thiện

### 3.1. Quy trình duyệt vendor không tồn tại
- `VendorRegis.jsx` (mục Lưu ý) ghi "Thông tin sẽ được admin xem xét và phê duyệt".
- Thực tế `registerVendorService` set thẳng `role = 'vendor'` ngay lập tức, không có state trung gian.
- **Đề xuất:** thêm `vendor_status: 'pending' | 'approved' | 'rejected'` + admin moderation; hoặc bỏ dòng lưu ý gây hiểu nhầm.

### 3.2. Thiếu trường nghiệp vụ cốt lõi
- `userModel` chỉ có `shopName / shopAddress / phone`.
- Thiếu: logo/avatar shop, mô tả shop, giấy phép kinh doanh, mã số thuế, tài khoản ngân hàng nhận tiền, trạng thái shop (`active/suspended`), chính sách (đổi trả/vận chuyển).
- Khó mở rộng sang giai đoạn thanh toán & moderation.

### 3.3. Hard-code và placeholder trong VendorShop UI
- `VendorShop.jsx` hard-code "Đang theo dõi: 13".
- `replyRate ?? 94`, `replyTimeText ?? 'trong vài giờ'` — fallback ảo không phản ánh dữ liệu thật.
- Tab `toy` filter theo `name.includes('đồ chơi')` — kiến trúc category đã đầy đủ thì không nên filter bằng tên.

### 3.4. Vendor dashboard URL hard-code
- `VendorRegis.jsx` hard-code `http://localhost:5174/add` khi vendor đã đăng ký.
- Không config-able theo môi trường, vỡ trên production.
- **Đề xuất:** lấy từ `import.meta.env.VITE_ADMIN_URL`.

### 3.5. Truy vấn đơn hàng kém scale
- `vendorOrdersService` thực hiện `orderModel.find({})` rồi `.filter()` toàn bộ orders trong memory.
- Với DB lớn sẽ chết về mặt hiệu năng.
- **Đề xuất:** dùng `find({ "items.vendorId": vendorId })` và đảm bảo index trên `items.vendorId` / `vendors.vendorId`. (Phần analytics đã làm đúng — áp dụng tương tự.)

### 3.6. Suspend/downgrade vendor không nhất quán
- Không có cơ chế "suspend vendor → ẩn toàn bộ SP".
- Nếu admin downgrade `role` về `user`, `getVendorShopPublicService` filter theo `role: 'vendor'` sẽ 404 toàn shop, nhưng `listProductsService` (listing chung) vẫn hiển thị sản phẩm cũ.
- **Đề xuất:** thêm soft-flag trên product hoặc filter join với user role.

### 3.7. Kiểm tra tên shop trùng yếu
- `userService.js` so sánh `shopName` exact, case-sensitive, không trim/normalize.
- "Shop ABC" và "shop abc" qua được.
- Không có unique index trên `shopName`.
- **Đề xuất:** normalize lower/trim + unique partial index `{ shopName: 1 }` (chỉ với role=vendor).

### 3.8. Duplicate request profile khi mount admin
- `App.jsx` đã gọi `/api/user/profile` để load vendor info.
- `VendorValidator.jsx` lại gọi `/api/user/profile` một lần nữa để validate role.
- **Đề xuất:** dùng 1 nguồn truth, truyền `user` đã có xuống `VendorValidator`.

### 3.9. Logging chưa chuẩn
- `vendorAuth.js` dùng `console.log(error)` — leak stack trace vào server log production, không có log level.
- **Đề xuất:** thay bằng logger có level (winston/pino) như các service khác trong dự án.

### 3.10. Thiếu rate-limit cho vendor APIs
- Mới có rate-limit cho `login / verify-email / refresh / forgot-password / reset-password`.
- `register-vendor` và các vendor mutations không có rate-limit.
- **Đề xuất:** thêm rate-limit cho `register-vendor` và các endpoint nặng (`vendor-stats`, `vendor-list`).

### 3.11. Stats còn thiếu chỉ số quan trọng
- UI đẹp nhưng còn thiếu: doanh thu theo từng SP chi tiết, conversion rate, AOV, tỷ lệ hoàn đơn, doanh thu theo voucher.
- **Đề xuất:** mở rộng `vendorStatsService` hoặc tách thành endpoint riêng theo chỉ số.

### 3.12. Không có vendor payout / settlement
- Đây là phần lõi của marketplace.
- Có thể nằm ngoài scope đồ án — nên ghi rõ trong README "không bao gồm".

### 3.13. Chat reply rate/time chỉ là placeholder
- UI hiển thị nhưng backend không tính.
- **Đề xuất:** ẩn 2 chỉ số này nếu chưa làm, tránh hiểu nhầm cho người dùng cuối/giảng viên.

### 3.14. Thiếu test cho vendor flow
- Mới có `voucherService.test.js`, `interactionService.test.js`.
- Không có test cho vendor ownership, multi-vendor order split, suspend flow — đây là vùng dễ regression.

## 4. Ưu tiên đề xuất

| Ưu tiên | Việc | Phạm vi sửa |
|---|---|---|
| Cao | Tối ưu `vendorOrdersService` dùng filter query + index | `backend/services/order/orderStatusService.js`, `orderModel.js` |
| Cao | Unique + normalize `shopName` | `userModel.js`, `userService.js` |
| Cao | Thêm vendor approval state | `userModel.js`, `userService.js`, admin route mới |
| Trung | Mở rộng vendor profile (logo/desc/bank/status) | `userModel.js` + form đăng ký |
| Trung | Suspend flow ẩn SP toàn shop | `productService.js` listing logic |
| Trung | Bỏ hard-code/placeholder trong `VendorShop.jsx` | `frontend/src/pages/main/VendorShop.jsx` |
| Trung | Config-able vendor dashboard URL | `VendorRegis.jsx` đọc env |
| Thấp | Gộp request profile khi mount admin | `App.jsx` + `VendorValidator.jsx` |
| Thấp | Thay `console.log` bằng logger có level | `vendorAuth.js` |
| Thấp | Rate-limit cho vendor APIs | `middleware/authRateLimit.js` + routes |
| Thấp | Bổ sung test cho vendor ownership & order split | `services/tests/` |

## 5. Kết luận

Kiến trúc vendor đi đúng hướng: tài khoản hợp nhất, multi-vendor order, cookie auth, ownership check. Tuy nhiên còn nhiều chỗ "đẹp ở UI nhưng mỏng ở logic" — đặc biệt approval/suspend, scaling truy vấn order, và data thật vs placeholder. Nếu xử lý mục Ưu tiên Cao trước (scaling order + unique shopName + approval state), module này đã đủ vững để phòng vệ trước câu hỏi phản biện.

## 6. Tài liệu liên quan
- `docs/auth-unified-user-vendor.md` — quyết định kiến trúc auth user/vendor.
- `docs/voucher-discount-system-plan-vi.md` — voucher shop-level liên quan vendor.
- `docs/concurrent-purchase-stock-plan-vi.md` — đụng tới logic order multi-vendor.
