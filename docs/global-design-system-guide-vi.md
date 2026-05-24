# Global Design System Guide (VI)

## 1) Mục tiêu
Thiết lập phong cách thiết kế thống nhất cho toàn bộ project (frontend storefront + admin dashboard), để mọi thay đổi sau này cùng ngôn ngữ thị giác, giảm lệch UI và tăng tốc phát triển.

## 2) Phạm vi áp dụng
- `frontend/` (toàn bộ trang người dùng)
- `admin/` (toàn bộ trang quản trị)
- Không áp dụng cho tài liệu marketing ngoài codebase.

## 3) Tuyên ngôn phong cách
- Hiện đại, sáng, sạch, ưu tiên tính dễ dùng.
- Có bản sắc mềm (pastel ấm) thay vì “business khô cứng”.
- Tương tác mượt, vừa đủ, không phô trương.
- Nội dung tiếng Việt phải có dấu.

## 4) Design Tokens (chuẩn gốc)
## 4.1 Màu sắc
Dùng hệ vai trò màu (semantic), không hard-code màu theo ngữ cảnh business logic.

`Brand`
- `brand-50`: nền nhấn rất nhẹ (hồng đào sáng)
- `brand-500`: màu nhấn chính cho CTA
- `brand-600`: hover CTA

`Accent`
- `accent-warm`: cam pastel
- `accent-cool`: cyan pastel

`Neutral`
- `neutral-0`: `#FFFFFF`
- `neutral-50`: nền app sáng
- `neutral-100`: nền card
- `neutral-300`: border
- `neutral-600`: text phụ
- `neutral-900`: text chính

`Feedback`
- `success`: xanh lá vừa
- `warning`: cam
- `error`: đỏ
- `info`: xanh dương

Quy tắc:
- Frontend ưu tiên gradient sáng nhẹ `brand + accent` ở vùng hero/nav.
- Admin giảm hiệu ứng trang trí, ưu tiên neutral + brand để đọc nhanh dữ liệu.

## 4.2 Typography
`Font chính`: `Be Vietnam Pro`
- Dùng cho toàn bộ text UI, form, bảng, button.

`Font nhấn`: `Prata`
- Chỉ dùng ở logo, tiêu đề editorial/landing đặc biệt.
- Không dùng `Prata` cho bảng dữ liệu, form dài, nội dung dày chữ.

Scale khuyến nghị:
- `text-xs`: label/meta
- `text-sm`: body phụ
- `text-base`: body chuẩn
- `text-lg`: title khối nhỏ
- `text-2xl`/`text-3xl`: heading trang

## 4.3 Spacing & Radius
- Base spacing theo bội số 4 (`4, 8, 12, 16, 24, 32`).
- Radius chuẩn:
  - `rounded-lg`: phần tử thường
  - `rounded-xl`: card/modal
  - `rounded-full`: chip, badge, pill nav

## 4.4 Shadow & Blur
- Card thường: bóng nhẹ, không đậm.
- Thành phần “glass”: dùng blur + border sáng + shadow mềm.
- Không dùng nhiều hơn 2 cấp shadow trong cùng một màn hình.

## 5) Nguyên tắc bố cục
## 5.1 Frontend
- Bố cục ưu tiên cảm xúc mua sắm: hình ảnh rõ, khoảng thở lớn, CTA nổi bật.
- Hero/section đầu trang có thể dùng gradient nhẹ hoặc visual texture.
- Card sản phẩm nhất quán: ảnh, tên, giá, hành động.

## 5.2 Admin
- Bố cục ưu tiên tốc độ thao tác: thông tin rõ, phân tầng mạnh, ít trang trí.
- Form và bảng phải dễ quét; trạng thái loading/empty/error hiển thị rõ.
- Hạn chế gradient nền lớn trong vùng dữ liệu dày.

## 6) Component Standards
## 6.1 Nút (Button)
Các biến thể chuẩn:
- `Primary`: hành động chính (đặt hàng/lưu)
- `Secondary`: hành động phụ
- `Ghost`: hành động nhẹ
- `Danger`: xóa/hủy tác vụ rủi ro

Trạng thái bắt buộc:
- `default`, `hover`, `focus-visible`, `disabled`, `loading`

## 6.2 Input/Form
- Border trung tính, focus rõ ràng (outline brand).
- Error message đặt ngay dưới field.
- Placeholder không được dùng thay label.

## 6.3 Card
- Tách bạch header/body/footer nếu nội dung phức tạp.
- Card click được phải có hover state rõ.

## 6.4 Badge/Chip
- Dùng cho trạng thái ngắn: `Mới`, `Giảm giá`, `Đã duyệt`, `Lỗi`.
- Không nhồi quá 3 badge trong một hàng dữ liệu.

## 6.5 Modal/Drawer
- Có tiêu đề, mô tả ngắn, hành động chính/phụ rõ ràng.
- ESC hoặc click ngoài để đóng (trừ luồng quan trọng cần xác nhận).

## 7) Motion & Interaction
- Thời lượng chuẩn: `200–300ms`.
- Easing: `ease-out` hoặc `ease-in-out`.
- Chỉ animate các thuộc tính: `opacity`, `transform`, `shadow`, `blur`.
- Tránh animation liên tục gây mỏi mắt (trừ shimmer nhẹ có kiểm soát).

## 8) Accessibility (A11y)
- Tương phản text/nền đạt mức đọc tốt.
- Mọi icon button có `aria-label`.
- Focus ring hiển thị rõ khi điều hướng bằng bàn phím.
- Mục tiêu bấm tối thiểu ~`36x36px`.

## 9) Quy tắc nội dung & ngôn ngữ
- Toàn bộ text UI tiếng Việt phải có dấu.
- Thuật ngữ nhất quán:
  - `Đăng nhập`, `Đăng xuất`, `Giỏ hàng`, `Đơn mua`, `Thông báo`, `Trang cá nhân`.
- Không trộn Anh-Việt trong cùng ngữ cảnh nếu không cần thiết.

## 10) Quy ước code UI
- Ưu tiên class semantic và component hóa thay vì lặp class dài.
- Không hard-code màu tùy hứng; bám token theo vai trò.
- Với hiệu ứng dùng chung (ví dụ `glass-shimmer`), đặt ở CSS global có chú thích.

## 11) Checklist trước khi merge UI
1. Build pass (`frontend`/`admin`).
2. Responsive ổn trên mobile + desktop.
3. Trạng thái đầy đủ: loading / empty / error / success.
4. Không có text tiếng Việt không dấu.
5. Không có thành phần “giả” chưa có route/chức năng thật.
6. Không lệch khỏi token màu/chữ/khoảng cách đã định.

## 12) Lộ trình áp dụng
1. Giai đoạn 1: dùng doc này làm chuẩn review cho mọi PR UI mới.
2. Giai đoạn 2: trích token vào `tailwind.config.js` của cả `frontend` và `admin`.
3. Giai đoạn 3: chuẩn hóa dần các component lõi (Button, Input, Card, Modal, Badge).
4. Giai đoạn 4: bổ sung dark mode (nếu cần) nhưng giữ nguyên bản sắc thương hiệu.

## 13) Tài liệu liên quan
- Navbar style chuyên biệt: `docs/navbar-lumiere-glass-style-guide-vi.md`
- Tài liệu này là chuẩn tổng quát cấp project; tài liệu navbar là guideline cấp component.
