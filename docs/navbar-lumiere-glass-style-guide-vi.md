# Design Guide: Navbar "Lumière Glass" (VI)

## 1) Mục tiêu
Tài liệu này là chuẩn tham chiếu khi chỉnh sửa Navbar trong dự án, để mọi lần cập nhật sau vẫn giữ đúng phong cách hiện tại:
- Floating glass (kính mờ nổi)
- Editorial / luxe-retro tối giản
- Tương tác mượt (shrink khi cuộn)
- Chỉ hiển thị tính năng có thật
- Toàn bộ nội dung tiếng Việt phải có dấu

## 2) Phạm vi áp dụng
Áp dụng cho:
- `frontend/src/components/layout/Navbar.jsx`
- `frontend/src/index.css` (các class dùng chung cho hiệu ứng navbar)

Không áp dụng cho:
- Navbar của `admin`
- Các layout đặc thù ngoài storefront chính

## 3) DNA thị giác (bắt buộc giữ)
1. Bề mặt kính nổi:
- Nền gradient sáng, trong suốt nhẹ
- `backdrop-blur` + viền sáng mảnh
- Bo tròn dạng pill (`rounded-full`)

2. Chất liệu shimmer:
- Dùng class `glass-shimmer` với pseudo-element `::after`
- Shimmer chạy chậm, tinh tế (không chớp gắt)

3. Typographic mood:
- Logo chữ dùng `Prata` (serif) để tạo chất editorial
- Nội dung điều hướng dùng `Be Vietnam Pro` (sans)
- Link nav chữ hoa nhỏ, tracking rộng

4. Màu sắc:
- Tông chủ đạo: `rose / orange / cyan` pastel
- Accent hành động: `rose-500`, `fuchsia/violet gradient`
- Không chuyển sang palette tối nặng hoặc business xanh-xám

## 4) Cấu trúc bố cục chuẩn
Desktop:
1. Cánh trái: 2 link điều hướng đầu
2. Trung tâm: logo chữ `Lumière`
3. Cánh phải: link bổ sung + icon tìm kiếm/thông báo/giỏ hàng/tài khoản

Mobile:
- Giữ top bar tối giản + nút menu
- Menu overlay full-screen gradient sáng
- Có đủ: điều hướng, giỏ hàng, đơn mua, thông báo, hồ sơ, người bán, đăng nhập/đăng xuất

## 5) Quy tắc tính năng (không thêm "menu giả")
Chỉ hiển thị route/chức năng có thật trong hệ thống:
- `/`
- `/collection`
- `/recommendations`
- `/about`
- `/contact`
- `/cart`
- `/orders` (khi đã đăng nhập)
- `/my-profile` (khi đã đăng nhập)
- `/profile/notifications` (khi đã đăng nhập)
- `/vendor-register` (khi chưa là vendor)
- Vendor portal `http://localhost:5174/add` (khi là vendor)

Không thêm mục placeholder kiểu: "Sắp ra mắt", "Tải app", "Kết nối" nếu chưa có chức năng thật.

## 6) Hiệu ứng chuyển động chuẩn
1. Shrink khi cuộn:
- Trigger: `window.scrollY > 50`
- Trạng thái thu gọn:
  - Padding giảm
  - Blur tăng
  - Shadow đậm hơn

2. Transition:
- `transition-all duration-300 ease-in-out`
- Không dùng animation quá 400ms cho điều hướng chính

3. Search panel:
- Bật/tắt bằng icon search
- Hiển thị dạng floating panel dưới navbar
- Đóng khi chuyển route

## 7) Quy tắc nội dung tiếng Việt
- Bắt buộc dùng tiếng Việt có dấu cho toàn bộ label/button/menu.
- Ví dụ đúng: `Trang chủ`, `Sản phẩm`, `Đăng nhập`, `Thông báo`.
- Không dùng bản không dấu trong UI.

## 8) Quy tắc accessibility tối thiểu
- Mọi icon button phải có `aria-label` rõ nghĩa.
- Tương phản chữ và nền đủ đọc trên bề mặt kính.
- Vùng bấm tối thiểu cho icon: khoảng 36x36 px.
- Badge số lượng (giỏ hàng/thông báo) luôn hiển thị rõ trên mọi nền.

## 9) Quy tắc code khi chỉnh sửa
1. Giữ logic auth hiện có:
- `token` quyết định hiển thị nhóm chức năng đăng nhập.
- `userRole` quyết định nút người bán.

2. Không tách rời khỏi `NavbarSearch`:
- Search phải dùng lại `NavbarSearch` để không mất lịch sử/tìm gợi ý.

3. Giữ class dùng chung trong `index.css`:
- `.glass-shimmer`
- `@keyframes shimmer`
- Transition hooks cho `#main-nav-container`, `#main-nav-logo`, `.nav-link`, `.nav-icon-btn`

## 10) Checklist trước khi merge
1. `npm run build` tại `frontend` phải pass.
2. Kiểm tra desktop + mobile không vỡ layout.
3. Kiểm tra trạng thái:
- Chưa đăng nhập
- Đã đăng nhập user thường
- Đã đăng nhập vendor
4. Test nhanh tương tác:
- Cuộn trang thấy shrink mượt
- Mở/đóng search panel
- Mở/đóng mobile menu
- Badge giỏ hàng + thông báo hiển thị đúng
5. Không có text tiếng Việt không dấu trong navbar.

## 11) Định hướng mở rộng (nếu cần)
- Có thể thêm dark mode sau, nhưng phải giữ chất "glass editorial" tương đương.
- Nếu đổi palette, chỉ đổi ở cùng họ màu pastel sáng, tránh chuyển phong cách business.
- Nếu thêm menu mới, phải có route thật trong `App.jsx` trước.
