# Kế hoạch triển khai: Lưu địa chỉ theo user + chọn nhanh khi giao hàng (ưu tiên không map)

## 1) Mục tiêu
- Mỗi người dùng có thể lưu nhiều địa chỉ nhận hàng.
- Khi checkout, người dùng chỉ cần chọn địa chỉ đã lưu (1 click), không nhập lại từ đầu.
- Form nhập/chỉnh sửa địa chỉ hoạt động theo modal:
  - `Tỉnh/Thành Phố`
  - `Phường/Xã`
- Có `Địa chỉ cụ thể` (số nhà, tên đường).
- Có `Loại địa chỉ` để chọn nhanh: `Nhà Riêng` / `Văn Phòng`.
- Có tìm kiếm nhanh trong từng tab location.
- Không bắt buộc hiển thị map để tránh chi phí dịch vụ bản đồ.
- Hệ thống tự động điền địa chỉ mặc định khi vào trang đặt đơn.

## 2) Phạm vi
- Bao gồm:
  - CRUD địa chỉ của user.
  - UI modal nhập/chỉnh sửa địa chỉ.
  - Luồng chọn địa chỉ trong checkout.
  - Cơ chế địa chỉ mặc định để auto add vào đơn.
  - Chế độ bật/tắt map bằng config.
- Không bao gồm (phase sau):
  - Tính khoảng cách theo GPS realtime.
  - Chuẩn hóa địa chỉ bằng dịch vụ geocoding nâng cao.

## 3) Hành vi UI/UX (theo modal đã thống nhất)
### 3.1 Thành phần modal
- `Họ và tên` (required)
- `Số điện thoại` (required)
- `Ô chọn địa chỉ` dạng combobox:
  - Placeholder ví dụ: `Thành phố Hà Nội, Phường Thanh Xuân`
  - Icon tìm kiếm, icon xóa, icon dropdown
- `Địa chỉ cụ thể` (required): ví dụ `221 Vũ Hữu`
- `Loại địa chỉ` (required):
  - `Nhà Riêng`
  - `Văn Phòng`
- `Checkbox`: Đặt làm địa chỉ mặc định
- Nút: `Trở lại` và `Hoàn thành`

### 3.2 Luồng chọn địa chỉ
1. Mở dropdown, mặc định tab `Tỉnh/Thành Phố`.
2. Chọn 1 `Tỉnh/TP`.
3. Tự chuyển sang tab `Phường/Xã` và load danh sách theo `city_id` đã chọn.
4. Chọn 1 `Phường/Xã`, đóng dropdown.
5. Ô địa chỉ hiển thị: `{city_name}, {ward_name}`.
6. User nhập `Địa chỉ cụ thể`.
7. User chọn `Loại địa chỉ`.

### 3.3 Quy tắc reset
- Nếu đổi `Tỉnh/TP` sau khi đã chọn phường:
  - Reset `ward_id`, `ward_name`.
  - Bắt buộc chọn lại phường trước khi submit.
- Bấm icon `x` ở ô địa chỉ:
  - Xóa cả city + ward đã chọn.
- Khi xóa city/ward đã chọn:
  - Giữ nguyên `Địa chỉ cụ thể` và `Loại địa chỉ` để user không phải nhập lại.

### 3.4 Tìm kiếm trong dropdown
- Tìm theo từ khóa có dấu/không dấu.
- Tab nào active thì chỉ lọc dữ liệu tab đó.
- Debounce 250ms.
- Highlight item đang chọn (màu primary).

### 3.5 Hiển thị map (tùy chọn)
- Mặc định `không hiển thị map` để tối ưu chi phí.
- Nếu bật map:
  - Chỉ hiển thị preview map khi đã chọn đủ city + ward + có địa chỉ cụ thể.
  - Lỗi tải map không được chặn submit.

## 4) Quy tắc dữ liệu & validate
- Required: `receiver_name`, `phone`, `city_id`, `ward_id`, `address_line`, `address_type`.
- `phone` chuẩn hóa về định dạng VN (`+84xxxxxxxxx`).
- Không cho submit khi thiếu city/ward.
- `address_type` chỉ nhận: `home`, `office`.
- Chống tạo bản ghi trùng (cùng user + cùng city/ward + cùng tên/sđt) bằng soft rule ở service layer.

## 5) Thiết kế dữ liệu
## 5.1 Bảng `user_addresses`
- `id` (PK)
- `user_id` (FK -> users.id)
- `label` (nullable, ví dụ: Nhà/Công ty)
- `receiver_name` (required)
- `phone` (required)
- `city_id` (required)
- `city_name` (required)
- `ward_id` (required)
- `ward_name` (required)
- `address_line` (required, số nhà/tên đường)
- `address_type` (required, enum: `home` | `office`)
- `lat` (nullable)
- `lng` (nullable)
- `is_default` (boolean, default false)
- `last_used_at` (nullable)
- `created_at`, `updated_at`, `deleted_at` (soft delete)

## 5.2 Index đề xuất
- `(user_id, deleted_at)`
- `(user_id, is_default, deleted_at)`
- `(user_id, last_used_at desc)`

## 6) API contract
## 6.1 Location APIs
- `GET /api/locations/cities?keyword=&page=&limit=`
  - Trả danh sách tỉnh/thành.
- `GET /api/locations/wards?city_id=&keyword=&page=&limit=`
  - Trả danh sách phường/xã thuộc 1 city.

## 6.2 Address book APIs
- `GET /api/me/addresses`
  - Trả danh sách địa chỉ của user (ưu tiên địa chỉ mặc định lên đầu).
- `POST /api/me/addresses`
  - Tạo địa chỉ mới.
- `PATCH /api/me/addresses/:id`
  - Cập nhật địa chỉ.
- `DELETE /api/me/addresses/:id`
  - Soft delete.
- `POST /api/me/addresses/:id/set-default`
  - Set mặc định (đảm bảo chỉ 1 địa chỉ mặc định/user).
- `GET /api/me/addresses/default`
  - Lấy địa chỉ mặc định của user (nếu có).

Payload tối thiểu khi tạo/sửa:
- `receiver_name`
- `phone`
- `city_id`, `city_name`
- `ward_id`, `ward_name`
- `address_line`
- `address_type` (`home` | `office`)
- `is_default`
- `lat`, `lng` (optional, chỉ dùng khi bật map)

## 6.3 Checkout integration
- `GET /api/checkout/address/default`
  - Khi user vào trang checkout:
    - Tự động trả về địa chỉ mặc định để prefill.
    - Nếu không có mặc định, trả `null` để UI yêu cầu user chọn/thêm mới.
- `POST /api/checkout/address/select`
  - Input: `address_id`
  - Tác vụ:
    - Verify address thuộc user hiện tại.
    - Gắn vào draft order/cart session.
    - Update `last_used_at`.

## 7) Logic chọn địa chỉ khi đặt đơn
- Mặc định luôn ưu tiên `is_default = true`.
- Khi vào checkout:
  - Auto add địa chỉ mặc định vào form giao hàng.
- Nếu user muốn đổi:
  - Mở danh sách địa chỉ đã lưu.
  - Chọn địa chỉ khác bằng `POST /api/checkout/address/select`.
- Đổi địa chỉ trong checkout không bắt buộc đổi `is_default`.

## 8) FE state machine tối thiểu
- `idle`
- `loadingCities`
- `loadingWards`
- `searching`
- `loadingMap` (optional, chỉ khi bật map)
- `submitting`
- `error`

Quy tắc:
- Disable nút `Hoàn thành` trong `submitting`.
- Khi `loadingWards`, tab phường hiển thị skeleton/loading row.
- Nếu không có dữ liệu: hiển thị `Không tìm thấy dữ liệu`.
- Không disable submit chỉ vì map lỗi/không tải được.

## 9) Bảo mật & kiểm soát truy cập
- Mọi endpoint `/api/me/addresses*` phải dựa trên user từ cookie/session hiện tại.
- Không cho truy cập/chỉnh sửa địa chỉ không thuộc user.
- Không log full số điện thoại ở mức info/debug production.
- Rate limit API location search để tránh spam.

## 10) Test plan
### 10.1 Backend
- Tạo/sửa/xóa địa chỉ đúng quyền user.
- Set default đảm bảo tính duy nhất.
- Vào checkout tự lấy đúng địa chỉ mặc định.
- Chọn địa chỉ khác cho checkout cập nhật `last_used_at`.

### 10.2 Frontend
- Chọn city -> ward thành công.
- Đổi city thì ward reset đúng.
- Search hoạt động với tiếng Việt có dấu và không dấu.
- Submit fail khi thiếu ward hoặc thiếu địa chỉ cụ thể.
- Edit địa chỉ cũ prefill đúng.
- Chọn đúng loại địa chỉ `Nhà Riêng` / `Văn Phòng`.
- Chế độ tắt map vẫn submit bình thường.

### 10.3 E2E
- User mới chưa có địa chỉ.
- User có nhiều địa chỉ, có default.
- User vào checkout thấy auto điền địa chỉ mặc định.
- User đổi sang địa chỉ khác thành công trước khi đặt đơn.
- User xóa địa chỉ đang mặc định (xử lý fallback theo rule sản phẩm).

## 11) Kế hoạch triển khai theo phase
1. Phase A (1-2 ngày): Migration + model + repository + seed location.
2. Phase B (1-2 ngày): API location + API address CRUD + set-default.
3. Phase C (2 ngày): UI modal địa chỉ + dropdown 2 tab + địa chỉ cụ thể + loại địa chỉ.
4. Phase D (1 ngày): Checkout auto add địa chỉ mặc định + cho phép đổi địa chỉ khác.
5. Phase E (0.5 ngày): Tùy chọn bật map qua config.
6. Phase F (1 ngày): Test, hardening, bugfix.

## 12) Tiêu chí hoàn thành (Definition of Done)
- Người dùng có thể thêm/chỉnh sửa/xóa/chọn địa chỉ thành công.
- Checkout tự động điền địa chỉ mặc định của user.
- Người dùng đổi sang địa chỉ khác được trước khi xác nhận đặt đơn.
- Dropdown địa chỉ hoạt động đúng luồng city -> ward.
- Form có `Địa chỉ cụ thể` + `Loại địa chỉ` hoạt động đúng như thiết kế.
- Hệ thống chạy ổn ở chế độ không map.
- API và UI đều có test cơ bản pass.
