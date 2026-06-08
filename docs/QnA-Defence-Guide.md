# CẨM NANG ÔN TẬP VÀ BỘ CÂU HỎI PHẢN BIỆN BẢO VỆ ĐỒ ÁN TỐT NGHIỆP
## ĐỀ TÀI: THIẾT KẾ VÀ PHÁT TRIỂN SÀN THƯƠNG MẠI ĐIỆN TỬ ĐA NHÀ BÁN HÀNG HIỆU NĂNG CAO

Tài liệu này tổng hợp toàn bộ nền tảng lý thuyết, kiến trúc hệ thống, cơ chế hoạt động cốt lõi và các kịch bản phản biện thực tế trước Hội đồng chấm Đồ án tốt nghiệp (ĐATN).

---

## MỤC LỤC
1. [TỔNG QUAN HỆ THỐNG & CÔNG NGHỆ](#1-tong-quan-he-thong--cong-nghe)
2. [CƠ CHẾ GIỮ KHO NGUYÊN TỬ (ATOMIC STOCK RESERVATION) & CHỐNG OVERSELL](#2-co-che-giu-kho-nguyen-tu-atomic-stock-reservation--chong-oversell)
3. [KIẾN TRÚC XÁC THỰC HỢP NHẤT & BẢO MẬT REDIS](#3-kien-truc-xac-thuc-hop-nhat--bao-mat-redis)
4. [ĐỘNG CƠ TÍNH GIẢM GIÁ 4 LỚP (VOUCHER ENGINE)](#4-dong-co-tinh-giam-gia-4-lop-voucher-engine)
5. [THUẬT TOÁN GỢI Ý LAI (HYBRID RECOMMENDATION ENGINE) CÓ SUY HAO THỜI GIAN](#5-thuat-toan-goi-y-lai-hybrid-recommendation-engine-co-suy-hao-thoi-gian)
6. [TÍCH HỢP THANH TOÁN (STRIPE & VNPAY) VÀ AN TOÀN WEBHOOK](#6-tich-hop-thanh-toan-stripe--vnpay-va-an-toan-webhook)
7. [TRUYỀN THÔNG THỜI GIAN THỰC (SOCKET.IO & SSE)](#7-truyen-thong-thoi-gian-thuc-socketio--sse)
8. [BỘ 25 CÂU HỎI PHẢN BIỆN PHỔ BIẾN & CÂU TRẢ LỜI CHUẨN HỘI ĐỒNG](#8-bo-25-cau-hoi-phan-bien-pho-bien--cau-tra-loi-chuan-hoi-dong)
9. [HƯỚNG DẪN VẬN HÀNH DEMO AN TOÀN](#9-huong-dan-van-hanh-demo-an-toan)

---

## 1. TỔNG QUAN HỆ THỐNG & CÔNG NGHỆ

### 1.1. Sơ đồ kiến trúc tổng thể (MERN + Redis + Cloud Services)
Hệ thống được thiết kế theo mô hình client-server bất đồng bộ:
*   **Frontend Client / Merchant Dashboard:** Viết bằng React (Single Page Application - SPA), sử dụng Redux Toolkit để quản lý state và thư viện Recharts để vẽ biểu đồ động.
*   **Backend Server:** Viết bằng Node.js kết hợp Express Framework. Hoạt động trên cơ chế Single-threaded Event Loop, Non-blocking I/O mang lại thông lượng cao.
*   **Primary Database:** MongoDB (NoSQL Document-oriented) - lưu trữ dữ liệu sản phẩm có cấu trúc phân cấp/biến thể và lịch sử đơn hàng linh hoạt dưới dạng BSON.
*   **Caching & Security Memory:** Redis (In-memory key-value store) - dùng để làm lớp đệm xác thực (Rate limit), quản lý session bị thu hồi (Deny-list) và kiểm soát cooldown OTP.
*   **Cloud Services:**
    *   **Cloudflare R2 Object Storage:** Lưu trữ hình ảnh sản phẩm (thay thế AWS S3 nhằm tối ưu hóa chi phí đường truyền và băng thông chiều ra - zero egress fees).
    *   **Gemini AI API:** Tự động tạo mô tả sản phẩm thông minh dựa trên thuộc tính cấu hình đầu vào.

---

## 2. CƠ CHẾ GIỮ KHO NGUYÊN TỬ (ATOMIC STOCK RESERVATION) & CHỐNG OVERSELL

### 2.1. Vấn đề tranh chấp dữ liệu (Race Condition) và Lỗi Overselling
Trong kiến trúc cổ điển đọc - chỉnh sửa - ghi (Read-Modify-Write):
1. Luồng A đọc số lượng tồn kho sản phẩm X (còn lại 1).
2. Luồng B cùng lúc đọc tồn kho sản phẩm X (còn lại 1).
3. Luồng A tạo đơn hàng và thực hiện trừ kho (tồn kho mới = 0).
4. Luồng B cũng tạo đơn hàng và trừ kho (tồn kho mới = -1).
=> **Kết quả:** Hệ thống bán quá lượng tồn kho thực tế (Overselling), gây tổn hại uy tín doanh nghiệp.

### 2.2. Giải pháp: Cập nhật nguyên tử (Atomic Database Update)
Đồ án giải quyết vấn đề này trực tiếp dưới tầng cơ sở dữ liệu MongoDB bằng câu lệnh lọc có điều kiện kiểm tra tồn kho tối thiểu và cập nhật giảm trong cùng một chu kỳ xung nhịp (single atomic query), loại bỏ hoàn toàn cơ chế khóa dòng vật lý gây nghẽn (Pessimistic locking):
```javascript
// Sử dụng toán tử điều kiện lọc $gte và cập nhật $inc
db.products.updateOne(
  { 
    _id: productId, 
    "variants.key": variantKey, 
    "variants.stock": { $gte: quantity } 
  },
  { 
    $inc: { 
      "variants.$.stock": -quantity, 
      "totalStock": -quantity 
    } 
  }
)
```
*   **Nguyên lý hoạt động:** Nếu nhiều luồng đồng thời gọi câu lệnh trên, MongoDB sẽ thực hiện tuần tự hóa (serialization) các truy vấn ghi tại tài liệu đó. Luồng nào vào trước sẽ trừ kho thành công (MongoDB trả về `modifiedCount == 1`). Luồng vào sau khi kho đã cạn sẽ không thỏa mãn điều kiện lọc `{ $gte: quantity }`, câu lệnh trả về `modifiedCount == 0`, hệ thống ném lỗi và hoàn trả tài nguyên giao dịch ngay lập tức.

### 2.3. Luồng giữ kho và hoàn trả kho tự động (Stock Reservation Life-cycle)
```
[User Click Đặt hàng]
        │
        ▼
[Kiểm tra & Giữ kho nguyên tử (reserveStockByUnits)]
        │
        ├──► Thất bại (Thiếu hàng) ──► Ném lỗi OUT_OF_STOCK (Hủy giao dịch)
        │
        ▼ Thành công (Đủ hàng)
[Tạo đơn hàng trạng thái PENDING_PAYMENT (Giữ kho 15 phút)]
        │
        ├──► Thanh toán thành công (Stripe/VNPay Webhook) ──► Chuyển trạng thái CONFIRMED (Hoàn tất bán)
        │
        └──► Thất bại / Hủy đơn / Quá hạn 15 phút (Cron Sweeper phát hiện)
                    │
                    ▼
            [Tự động hoàn trả kho nguyên tử (releaseStockByUnits)]
                    │
                    ▼
            [Chuyển trạng thái đơn sang EXPIRED/CANCELLED]
```
*   **Cron Sweeper:** Một job chạy nền (mỗi 1 phút) quét qua MongoDB tìm các đơn hàng có trạng thái `PENDING_PAYMENT` và thời gian hiện tại đã vượt quá `reservationExpiresAt`. Hệ thống tự động kích hoạt hàm hoàn kho và thu hồi voucher.

### 2.4. Idempotency Key (Chống gửi trùng lặp đơn hàng)
*   **Rủi ro:** Người dùng double-click nút đặt hàng hoặc mạng chập chờn gửi request thanh toán trùng lặp.
*   **Giải pháp:** Client tự sinh một mã định danh duy nhất (`idempotencyKey` dạng UUID) cho mỗi phiên thanh toán. Backend tạo một chỉ mục độc bản (Unique Index) kết hợp giữa `(userId, idempotencyKey)` trong cơ sở dữ liệu. Mọi request trùng lặp gửi lên sẽ lập tức bị chặn lại ở mức DB (tránh trùng đơn và double-decrement kho).

---

## 3. KIẾN TRÚC XÁC THỰC HỢP NHẤT & BẢO MẬT REDIS

### 3.1. Unified User/Vendor Model
Đồ án thiết kế mô hình tài khoản hợp nhất thay vì tách biệt các cơ sở dữ liệu đăng nhập:
*   Một tài khoản có thể vừa là **Buyer** (người mua) vừa là **Vendor** (nhà bán hàng).
*   Khi người dùng đăng ký mở gian hàng, tài khoản của họ được cập nhật thuộc tính nâng quyền (Role elevation) thay vì tạo mới thông tin xác thực.
*   **Lợi ích:** Tiết kiệm tài nguyên cơ sở dữ liệu, tối ưu luồng chuyển đổi giao diện và triệt tiêu lỗ hổng bảo mật rò rỉ Token qua URL khi chuyển đổi vùng quản lý Dashboard.

### 3.2. Refresh Token Rotation (RTR) kết hợp Redis Deny-list
Để bảo vệ an toàn phiên đăng nhập lâu dài của người dùng mà không cần lưu phiên trong cơ sở dữ liệu MongoDB chính:
1. Khi đăng nhập thành công, máy chủ cấp cặp token: `accessToken` (sống ngắn hạn, ví dụ 15 phút) và `refreshToken` (sống dài hạn, ví dụ 7 ngày, chứa định danh giao dịch `jti`). Cả hai được lưu trong Cookie bảo mật với cờ `HttpOnly`, `Secure` và `SameSite=Lax` để chặn đứng tấn công đánh cắp phiên qua XSS và CSRF.
2. Mỗi lần `accessToken` hết hạn, client gọi API `/refresh`. Máy chủ kiểm tra `jti` của `refreshToken` trong **Redis Deny-list**.
    *   **Nếu hợp lệ:** Cấp cặp token mới tinh, lưu lại `jti` cũ vào **Redis Deny-list** với thời gian sống (TTL) bằng thời gian sống còn lại của token cũ.
    *   **Nếu phát hiện sử dụng lại Token cũ (Replay Attack):** Có nghĩa là phiên làm việc đang bị xâm nhập hoặc đánh cắp. Hệ thống lập tức thu hồi toàn bộ phiên hoạt động của user đó bằng cách xóa danh sách token liên quan trên Redis và ép buộc người dùng đăng nhập lại từ đầu.

### 3.3. Tầng bảo mật giới hạn tần suất (Rate Limiting) trên Redis
Sử dụng Redis để đếm tần suất truy cập API theo địa chỉ IP hoặc Email của các endpoint nhạy cảm (Đăng nhập, gửi OTP, Reset mật khẩu):
*   **Thuật toán:** Token Bucket hoặc Fixed Window Counter.
*   **Cấu hình:** Ví dụ, tối đa 20 yêu cầu đăng nhập từ 1 IP trong 15 phút. Nếu vượt quá, Redis ghi nhận khóa tạm thời và trả về mã lỗi `HTTP 429 Too Many Requests`.
*   **Mục đích:** Chặn hoàn toàn các cuộc tấn công Brute-force mật khẩu và ngăn chặn đối tượng phá hoại spam gửi mã OTP gây lãng phí tài nguyên chi phí dịch vụ gửi Email.

---

## 4. ĐỘNG CƠ TÍNH GIẢM GIÁ 4 LỚP (VOUCHER ENGINE)

### 4.1. Quy trình trừ tiền nghiêm ngặt (4-Tier Discount Application)
Mọi phép tính toán tiền tệ của giỏ hàng đa cửa hàng đều được kiểm tra và xử lý 100% tại backend để tránh tình trạng client sửa đổi dữ liệu giá tiền gửi lên. Thứ tự áp dụng giảm giá diễn ra như sau:

$$\text{Tổng tiền thanh toán cuối cùng (Final Total)} = \text{Subtotal (sau khi áp sale từng sản phẩm)} - \text{Shop Voucher} - \text{Platform Voucher} + \text{Shipping Fee} - \text{Shipping Discount}$$

1.  **Lớp 1: Product Sale (Giảm giá sản phẩm):** Tính trực tiếp trên giá bán của từng mặt hàng riêng lẻ (đã được cấu hình giảm từ trước ở DB).
2.  **Lớp 2: Shop Voucher (Giảm giá cửa hàng):** Áp dụng riêng trên tổng số tiền (subtotal) của các sản phẩm thuộc về cửa hàng đó.
3.  **Lớp 3: Platform Voucher (Giảm giá toàn sàn):** Áp dụng trên tổng tiền của toàn bộ đơn hàng sau khi đã trừ đi các khoản giảm giá ở Lớp 2.
4.  **Lớp 4: Shipping Discount (Giảm giá vận chuyển):** Tính toán phí vận chuyển chung cho đơn hàng, sau đó áp dụng mã giảm giá vận chuyển riêng (nếu có).

### 4.2. Ràng buộc bảo mật của Động cơ giảm giá
*   Giá trị giảm giá tối đa không bao giờ được phép vượt quá giá trị cơ sở của lớp đó (ví dụ, voucher giảm giá vận chuyển tối đa 30,000đ thì không được giảm quá phí vận chuyển thực tế là 25,000đ).
*   Đảm bảo `Final Total` luôn lớn hơn hoặc bằng 0.
*   Thực hiện kiểm tra tính hợp lệ của voucher (thời gian khả dụng, trạng thái hoạt động, lượt sử dụng còn lại, giá trị đơn tối thiểu) song song bằng cơ chế truy vấn nguyên tử nhằm tránh race-condition khi áp dụng voucher.

---

## 5. THUẬT TOÁN GỢI Ý LAI (HYBRID RECOMMENDATION ENGINE) CÓ SUY HAO THỜI GIAN

### 5.1. Công thức gợi ý Lai (Hybrid) tích hợp Hệ số suy hao thời gian (Time Decay)
Để giải quyết bài toán khởi đầu lạnh (Cold Start) khi người dùng mới chưa có nhiều lịch sử mua sắm hoặc sản phẩm mới đăng chưa có lượt tương tác, đồ án kết hợp hai phương pháp: Lọc cộng tác (Collaborative Filtering) dựa trên hành vi tương đồng của người dùng khác và Lọc nội dung (Content-based Filtering) dựa trên đặc trưng thuộc tính phân loại sản phẩm.

Điểm số gợi ý cuối cùng ($Score_{final}$) của sản phẩm $p$ dành cho người dùng $u$ được tính toán qua công thức:

$$Score_{final}(u, p) = \left( w_1 \cdot Score_{content}(u, p) + w_2 \cdot Score_{collaborative}(u, p) \right) \times e^{-\lambda \cdot \Delta t}$$

*   **$Score_{content}(u, p)$:** Điểm số tương thích danh mục/thuộc tính sản phẩm dựa trên lịch sử tương tác trước đó của người dùng.
*   **$Score_{collaborative}(u, p)$:** Điểm số hành vi tương đồng từ cộng đồng người dùng (mua chung, xem chung sản phẩm).
*   **$w_1, w_2$:** Trọng số cấu hình hệ thống (tổng bằng 1). Ví dụ, thời gian đầu ưu tiên sản phẩm nội dung ($w_1 = 0.7$, $w_2 = 0.3$).
*   **$e^{-\lambda \cdot \Delta t}$ (Time Decay Factor):** Hệ số suy hao thời gian theo quy luật hàm mũ. Trong đó $\lambda$ là tốc độ suy hao (decay rate), và $\Delta t$ là số ngày kể từ lần tương tác cuối cùng của người dùng với sản phẩm/danh mục đó.
*   **Ý nghĩa thực tiễn:** Giúp các sản phẩm xu hướng mới lên ngôi, giảm dần thứ hạng của các sản phẩm cũ mà người mua đã mất đi sự quan tâm, giữ cho giao diện hiển thị gợi ý luôn đổi mới sinh động.

---

## 6. TÍCH HỢP THANH TOÁN (STRIPE & VNPAY) VÀ AN TOÀN WEBHOOK

### 6.1. Quy trình giao dịch và xử lý bất đồng bộ
Đồ án tích hợp hai cổng thanh toán phổ biến: Stripe (quốc tế) và VNPay (nội địa qua mã QR). Cơ chế hoạt động đảm bảo tính nhất quán của dữ liệu:
1. Khi checkout, khách hàng chọn thanh toán trực tuyến. Hệ thống giữ kho và tạo đơn hàng trạng thái `PENDING_PAYMENT`.
2. Backend gọi API cổng thanh toán để khởi tạo phiên giao dịch (Checkout Session) và trả về URL chuyển hướng an toàn cho Client.
3. Người dùng thực hiện thanh toán trên trang cổng thanh toán. Sau khi hoàn tất, cổng thanh toán sẽ tự động điều hướng khách hàng trở lại giao diện web của sàn (Redirect Return URL), đồng thời gửi một tín hiệu thông báo độc lập qua giao thức HTTP POST về API của sàn (đây là cơ chế Webhook).
4. **Xử lý Webhook ở Backend:** Backend đón nhận webhook, thực hiện kiểm tra chữ ký mã hóa (Cryptographic Signature Verification) để đảm bảo dữ liệu truyền đi thực sự từ Stripe/VNPay phát ra chứ không phải do giả lập dữ liệu tấn công. Sau đó đổi trạng thái đơn hàng sang `CONFIRMED`, kích hoạt tăng chỉ số bán (`sold`), xóa giỏ hàng của user và đẩy tin nhắn thời gian thực (Socket.IO) thông báo cho các bên.

### 6.2. Tại sao phải xử lý trạng thái qua Webhook thay vì Redirect URL?
*   **Câu trả lời chuẩn:** Trình duyệt phía Client có thể bị tắt đột ngột, mất kết nối mạng hoặc người dùng cố tình can thiệp mã nguồn javascript ở phía Client để chỉnh sửa tham số URL phản hồi thành "thành công" nhằm chiếm đoạt hàng hóa. Webhook là lời gọi an toàn trực tiếp Server-to-Server được mã hóa ký số bảo mật, đảm bảo trạng thái tài chính luôn chính xác dù giao diện người dùng có gặp sự cố.

---

## 7. TRUYỀN THÔNG THỜI GIAN THỰC (SOCKET.IO & SSE)

### 7.1. Hệ thống Chat trực tuyến thời gian thực (Socket.IO)
*   **Kiến trúc:** Sử dụng Socket.IO chạy trên nền giao thức WebSockets thiết lập kết nối TCP hai chiều toàn song công (Full-duplex).
*   **Bảo mật kết nối:** Khi client khởi tạo bắt tay (Handshake), bắt buộc gửi kèm JWT Access Token trong header. Server xác thực token thành công mới cho phép thiết lập kết nối, gán socket ID tương ứng với định danh `userId` từ token.
*   **Gửi nhận tin nhắn:** Khi người dùng gửi tin nhắn vào phòng chat (room), server sẽ chuyển tiếp tin nhắn và lưu trữ bất đồng bộ vào cơ sở dữ liệu MongoDB nhằm đảm bảo tốc độ phản hồi tức thì.

### 7.2. Luồng đẩy thông báo hệ thống (Server-Sent Events - SSE)
Đối với luồng đẩy thông báo trạng thái đơn hàng một chiều từ máy chủ về giao diện đối tác bán hàng (ví dụ: thông báo có đơn hàng mới):
*   Hệ thống sử dụng **Server-Sent Events (SSE)** chạy trên nền giao thức HTTP truyền thống nhưng duy trì kết nối lâu dài (persistent connection) bằng cách set header `Content-Type: text/event-stream`.
*   **Lợi thế so với WebSockets:** SSE nhẹ hơn rất nhiều, tiết kiệm tài nguyên CPU máy chủ, tự động kết nối lại (built-in reconnection) và hoạt động qua tường lửa/proxy HTTP dễ dàng mà không đòi hỏi giao thức mạng đặc biệt.

---

## 8. BỘ 25 CÂU HỎI PHẢN BIỆN PHỔ BIẾN & CÂU TRẢ LỜI CHUẨN HỘI ĐỒNG

### Nhóm 1: Câu hỏi về Tồn kho và Concurrency (Đồng thời tải cao)

#### Câu 1: Em giải quyết bài toán Overselling như thế nào khi hàng nghìn người cùng mua 1 mặt hàng tại 1 thời điểm?
*   **Trả lời:** Em sử dụng cơ chế **Cập nhật nguyên tử (Atomic Database Update)** trực tiếp dưới tầng lưu trữ của MongoDB thay vì cơ chế Read-Modify-Write ở ứng dụng. Bằng cách dùng câu lệnh cập nhật kết hợp điều kiện lọc giá trị tồn kho hiện tại lớn hơn hoặc bằng số lượng mua (`variants.stock: { $gte: quantity }`) cùng toán tử giảm dần nguyên tử (`$inc`), MongoDB sẽ đảm bảo việc kiểm tra và trừ kho diễn ra trong một chu kỳ ghi duy nhất của database. Mọi truy vấn ghi đồng thời sẽ được tuần tự hóa tại tài liệu đó, những luồng vào sau khi kho đã hết sẽ không thỏa mãn điều kiện lọc và bị từ chối trừ kho ngay lập tức.

#### Câu 2: Nếu câu lệnh trừ kho thành công nhưng quá trình tạo đơn hàng sau đó bị lỗi (ví dụ DB đột ngột mất kết nối), hệ thống sẽ xử lý thế nào để tránh thất thoát kho?
*   **Trả lời:** Hệ thống được thiết kế theo cơ chế **Rollback tự động bằng mã nguồn**. Luồng đặt hàng được cấu trúc: Đầu tiên thực hiện trừ kho nguyên tử; nếu thành công mới tiến hành ghi dữ liệu đơn hàng vào database. Nếu quá trình ghi đơn hàng thất bại ở bất cứ bước nào, hệ thống sẽ bắt lỗi (catch error) và ngay lập tức gọi hàm hoàn trả kho nguyên tử (`releaseStockByUnits`) để cộng trả lại số lượng tồn kho đã giữ. Ngoài ra, hệ thống có một job chạy nền tự động (Cron Sweeper) để quét và thu hồi kho của những đơn hàng ở trạng thái chờ thanh toán quá hạn 15 phút.

#### Câu 3: Idempotency Key hoạt động như thế nào trong đồ án của em và tại sao nó lại cần thiết?
*   **Trả lời:** `idempotencyKey` là một mã UUID duy nhất được client sinh ra cho mỗi lần click đặt hàng của user. Ở backend, em thiết lập một chỉ mục độc bản (Unique Index) kết hợp giữa hai trường `(userId, idempotencyKey)` trong bảng đơn hàng. Khi người dùng bấm đặt hàng liên tiếp do lag mạng, các yêu cầu gửi trùng lặp sẽ bị chặn ngay lập tức ở mức cơ sở dữ liệu bởi lỗi vi phạm ràng buộc unique index, ngăn chặn hoàn toàn việc tạo trùng đơn hàng và trừ kho lặp lại.

#### Câu 4: Tại sao em không dùng Redis Distributed Lock (như Redlock) để xử lý việc giữ kho mà lại dùng cập nhật nguyên tử của MongoDB?
*   **Trả lời:** Việc sử dụng Redis Lock rất tốt cho các bài toán phân tán phức tạp, tuy nhiên nó tăng độ trễ mạng vì phải gọi qua lại giữa Client -> Redis Lock -> Client -> MongoDB và tăng độ phức tạp vận hành (phải xử lý thời hạn khóa, giải phóng khóa khi crash). Trong khi đó, MongoDB hỗ trợ cập nhật nguyên tử ở cấp độ đơn tài liệu rất mạnh mẽ và có hiệu năng cực cao dưới tải cao. Việc đẩy trực tiếp điều kiện kiểm tra tồn kho xuống MongoDB giúp giảm thiểu độ trễ giao dịch và giảm nguy cơ rò rỉ hoặc nghẽn khóa trên Redis. Cơ chế này đủ an toàn và hiệu quả cho quy mô của một sàn thương mại điện tử đa nhà bán hàng.

#### Câu 5: Cơ chế tự động giải phóng kho (Stock Release) của em hoạt động thế nào khi khách hàng hủy đơn hàng hoặc thanh toán thất bại?
*   **Trả lời:** 
    *   Với đơn hàng thanh toán trực tuyến (Stripe/VNPay) đang chờ thanh toán: Hệ thống thiết lập hạn giữ kho 15 phút ghi vào trường `reservationExpiresAt`. Một Cron Sweeper chạy mỗi 1 phút ở backend sẽ quét và tự động chuyển trạng thái các đơn quá hạn sang `EXPIRED`, đồng thời gọi hàm `releaseStockByUnits` để cộng trả lại tồn kho.
    *   Với trường hợp khách hàng chủ động bấm hủy đơn hàng hoặc webhook báo thanh toán thất bại, hệ thống sẽ lập tức chuyển trạng thái đơn hàng sang `CANCELLED` và kích hoạt hàm hoàn kho ngay lập tức. Để tránh lỗi hoàn kho hai lần (double-refund), em cập nhật ghi nhận thời gian hoàn kho vào trường `stockReleasedAt` và kiểm tra điều kiện này trước khi hoàn kho.

---

### Nhóm 2: Câu hỏi về Xác thực và Bảo mật (Security & JWT)

#### Câu 6: Cơ chế Refresh Token Rotation (RTR) bảo vệ hệ thống khỏi những cuộc tấn công gì và hoạt động ra sao?
*   **Trả lời:** Cơ chế RTR bảo vệ hệ thống khỏi các cuộc tấn công đánh cắp token phiên làm việc (Replay Attack). Mỗi lần người dùng yêu cầu cấp mới `accessToken` bằng `refreshToken`, backend sẽ kiểm tra tính hợp lệ của token cũ, thu hồi nó bằng cách ghi mã định danh `jti` của nó vào **Redis Deny-list**, và cấp lại một cặp token mới hoàn toàn (gồm cả access và refresh token mới). Nếu kẻ tấn công đánh cắp được refresh token cũ và cố tình gửi yêu cầu cấp mới lần nữa, backend sẽ phát hiện `jti` của token này đã nằm trong Redis Deny-list (đã bị thu hồi). Hệ thống lập tức coi đây là hành vi xâm nhập, thu hồi toàn bộ các phiên hoạt động hiện tại của user đó và yêu cầu đăng nhập lại từ đầu để bảo đảm an toàn dữ liệu.

#### Câu 7: Tại sao em lại lưu trữ Access Token và Refresh Token trong Cookie bảo mật (HttpOnly Cookie) thay vì LocalStorage của trình duyệt?
*   **Trả lời:** Lưu trữ token trong LocalStorage rất dễ bị tấn công đánh cắp thông tin thông qua các lỗ hổng chèn mã độc Javascript **XSS (Cross-Site Scripting)**, vì bất cứ script chạy trên trang web đều có thể truy cập đọc được LocalStorage. Bằng cách lưu token vào Cookie và cấu hình cờ `HttpOnly`, mã javascript chạy trên trình duyệt hoàn toàn không thể đọc được cookie này, giúp bảo vệ phiên làm việc khỏi mã độc XSS. Ngoài ra, em cấu hình cờ `Secure` để cookie chỉ truyền đi qua giao thức HTTPS đã mã hóa, và cờ `SameSite=Lax` để ngăn chặn hiệu quả các cuộc tấn công giả mạo yêu cầu chéo trang **CSRF (Cross-Site Request Forgery)**.

#### Câu 8: Rate Limiting của em hoạt động thế nào trên Redis? Tại sao không dùng Rate limit in-memory của Node.js?
*   **Trả lời:** Em sử dụng Redis để đếm và quản lý số lượng yêu cầu của từng IP hoặc Email trên các route nhạy cảm trong một khung thời gian xác định (ví dụ 10 lần đăng nhập trong 15 phút). Việc lưu trữ in-memory của Node.js (như dùng Map hay biến cục bộ) có 2 điểm hạn chế lớn: Thứ nhất, khi khởi động lại máy chủ hoặc khi triển khai đa máy chủ (Multi-instance load balancing), dữ liệu đếm in-memory sẽ bị xóa sạch hoặc không thể chia sẻ đồng bộ giữa các máy chủ. Sử dụng bộ nhớ đệm ngoài Redis giúp quản lý giới hạn tần suất truy cập một cách tập trung, đồng bộ và bền vững kể cả khi máy chủ khởi động lại hoặc scale-up hệ thống.

#### Câu 9: Unified Auth (Mô hình xác thực hợp nhất) của đồ án giải quyết vấn đề bảo mật và trải nghiệm người dùng như thế nào?
*   **Trả lời:** Trước đây, hệ thống thường sử dụng hai luồng đăng nhập riêng biệt cho người dùng thông thường và nhà bán hàng, dẫn đến việc truyền nhận mã token quản trị qua URL query params (`vendorToken`) từ trang người dùng sang trang đối tác, điều này rất dễ bị lộ token qua lịch sử trình duyệt hoặc ghi nhật ký máy chủ (access logs). Mô hình xác thực hợp nhất gộp chung tài khoản người mua và nhà bán hàng thành một. Khi người dùng nâng cấp lên làm nhà bán, tài khoản của họ được gán thêm quyền `role: "vendor"`. Khi chuyển đổi sang Dashboard quản lý, hệ thống phục hồi phiên làm việc trực tiếp thông qua Cookie bảo mật `/api/user/refresh` đã có sẵn của trình duyệt. Điều này triệt tiêu hoàn toàn việc truyền token qua URL, giảm bề mặt tấn công và mang lại trải nghiệm mượt mà cho người dùng.

---

### Nhóm 3: Câu hỏi về Thiết kế cơ sở dữ liệu và Hiệu năng

#### Câu 10: Tại sao em lựa chọn MongoDB thay vì một cơ sở dữ liệu quan hệ (RDBMS) như MySQL hay PostgreSQL?
*   **Trả lời:** 
    *   **Về mô hình dữ liệu:** Dữ liệu thương mại điện tử đa nhà bán hàng có tính phân cấp và cấu trúc biến thể sản phẩm rất phức tạp (mỗi sản phẩm có nhiều màu sắc, kích thước, hình ảnh và giá cả khác nhau). MongoDB là cơ sở dữ liệu hướng tài liệu, cho phép biểu diễn các cấu trúc này một cách tự nhiên dưới dạng tài liệu lồng nhau (Nested documents), loại bỏ hoàn toàn các phép nối bảng (`JOIN`) phức tạp và tốn hiệu năng của cơ sở dữ liệu quan hệ.
    *   **Về hiệu năng tải cao:** MongoDB hỗ trợ các toán tử cập nhật nguyên tử không khóa chặn (non-blocking) trên từng tài liệu, giúp đạt thông lượng giao dịch ghi cực kỳ lớn dưới tải cao mà không bị nghẽn khóa dòng vật lý như MySQL hay PostgreSQL.
    *   **Khả năng mở rộng:** MongoDB được thiết kế để dễ dàng mở rộng theo chiều ngang thông qua cơ chế phân mảnh dữ liệu (Sharding) tự động, đáp ứng tốt sự gia tăng dữ liệu lớn trong tương lai.

#### Câu 11: Hãy giải thích cách thiết kế chỉ mục (Index) trong cơ sở dữ liệu MongoDB của em để tối ưu hóa truy vấn.
*   **Trả lời:** Em đã thiết kế các chỉ mục sau để tăng tốc độ truy vấn:
    *   Chỉ mục độc bản (Unique Index) trên trường `code` của bảng `voucher` để tối ưu hóa việc tìm kiếm và tránh trùng mã giảm giá.
    *   Chỉ mục phức hợp (Compound Index) trên `(userId, idempotencyKey)` trong bảng `order` để phục vụ cơ chế kiểm tra trùng lặp giao dịch đồng thời.
    *   Chỉ mục tìm kiếm trên trường `name` và `description` của bảng sản phẩm bằng cách tạo Text Index, giúp tối ưu hóa công cụ tìm kiếm sản phẩm của người mua.
    *   Chỉ mục đơn trên `vendorId` trong bảng sản phẩm và đơn hàng để đẩy nhanh tốc độ lọc dữ liệu cho Dashboard của đối tác bán hàng.

#### Câu 12: Làm thế nào em tối ưu hóa các phép tính toán doanh thu phức tạp cho nhà bán hàng trên MongoDB mà không gây quá tải CPU máy chủ?
*   **Trả lời:** Em sử dụng **MongoDB Aggregation Framework** (đường ống gom cụm dữ liệu) để thực hiện tính toán và tổng hợp doanh thu ngay tại tầng database trước khi trả kết quả về backend. Bằng cách sử dụng các stage tối ưu như `$match` để lọc đúng `vendorId`, `$unwind` để phân rã đơn hàng, và `$group` kết hợp toán tử `$sum` để tính tổng doanh thu theo ngày/tháng, cơ sở dữ liệu sẽ thực hiện tính toán một cách tối ưu nhất nhờ tận dụng các chỉ mục có sẵn. Điều này giúp giảm thiểu việc tải một khối lượng lớn đơn hàng thô về bộ nhớ của backend để tính toán thủ công bằng Javascript, tránh gây tràn RAM và nghẽn CPU máy chủ backend.

---

### Nhóm 4: Câu hỏi về Động cơ Giảm giá và Thuật toán gợi ý

#### Câu 13: Tại sao Động cơ tính giảm giá của em lại áp dụng thứ tự trừ tiền cố định là: Product Sale -> Shop Voucher -> Platform Voucher -> Shipping Discount? Điều gì xảy ra nếu thay đổi thứ tự này?
*   **Trả lời:** Thứ tự này được thiết kế dựa trên thực tiễn kinh doanh thương mại điện tử:
    *   **Product Sale** là mức giảm giá hiển thị công khai trên sản phẩm nên phải tính đầu tiên để ra giá bán thực tế.
    *   **Shop Voucher** áp dụng trên subtotal của từng shop, do chính nhà bán đó chi trả để kích cầu gian hàng của mình.
    *   **Platform Voucher** áp dụng trên tổng đơn hàng sau khi đã trừ đi giảm giá của Shop. Điều này giúp sàn thương mại điện tử (Platform) không phải gánh chịu chi phí giảm giá chồng chéo trên phần tiền mà nhà bán đã giảm trước đó.
    *   **Shipping Discount** được áp dụng cuối cùng sau khi đã cộng phí vận chuyển để tính ra số tiền thanh toán thực tế của khách hàng.
    *   Nếu thay đổi thứ tự (ví dụ Platform áp trước Shop), số tiền được giảm của khách hàng có thể thay đổi và gây ra sự thiếu minh bạch trong việc phân bổ chi phí giảm giá giữa Nhà bán hàng và Sàn thương mại điện tử.

#### Câu 14: Thuật toán khuyến nghị sản phẩm của em giải quyết lỗi Khởi đầu lạnh (Cold Start) cho người dùng mới và sản phẩm mới như thế nào?
*   **Trả lời:** Đồ án của em giải quyết lỗi khởi đầu lạnh bằng mô hình lai **Hybrid Recommendation Engine**:
    *   **Với người dùng mới (chưa có lịch sử tương tác):** Hệ thống chưa thể tính toán lọc cộng tác (Collaborative) hay lọc nội dung (Content-based). Khi đó, hệ thống sẽ tự động kích hoạt cơ chế dự phòng (**Fallback**) bằng cách trả về danh sách các sản phẩm bán chạy nhất toàn sàn (**Bestsellers**) dựa trên lượng đã bán (`sold` giảm dần), điểm đánh giá (`rating` giảm dần) và ngày đăng (`date` giảm dần) từ DB. *(Lưu ý: Luồng đăng ký hiện tại tối giản hóa luồng UX nên không bắt buộc người dùng chọn danh mục quan tâm, do đó việc giải quyết Cold Start hoàn toàn dựa trên dữ liệu Bestsellers toàn sàn).*
    *   **Với sản phẩm mới đăng (chưa có tương tác):** Thuật toán sẽ dựa trên danh mục (`category`) và danh mục con (`subCategory`) của sản phẩm mới đăng để đối chiếu và gợi ý cho những người dùng đã có tương tác với các danh mục tương ứng trong quá khứ (Content-based), giúp sản phẩm mới tiếp cận được đối tượng khách hàng mục tiêu mà không cần tích lũy lượt mua trước.

#### Câu 15: Hệ số suy hao thời gian (Time Decay) có vai trò gì trong công thức gợi ý lai và tính toán nó như thế nào?
*   **Trả lời:** Hệ số suy hao thời gian $e^{-\lambda \cdot \Delta t}$ có vai trò giảm dần mức độ ưu tiên của các tương tác cũ theo thời gian thực tế. Nếu không có hệ số này, hệ thống sẽ liên tục gợi ý những sản phẩm thuộc danh mục người dùng đã xem từ vài tháng trước mặc dù hiện tại họ đã không còn nhu cầu. Việc áp dụng hàm mũ với decay rate $\lambda$ giúp điểm số tương tác giảm nhanh chóng sau một vài tuần không hoạt động. Điều này giữ cho danh sách gợi ý sản phẩm luôn mới mẻ, cập nhật đúng xu hướng quan tâm ngắn hạn của người dùng tại thời điểm hiện tại.

---

### Nhóm 5: Câu hỏi về Tích hợp Thanh toán và Real-time

#### Câu 16: Làm thế nào em đảm bảo an toàn bảo mật khi nhận Webhook từ Stripe và VNPay? Kẻ xấu có thể giả lập dữ liệu Webhook để tạo đơn hàng giả hay không?
*   **Trả lời:** Kẻ xấu hoàn toàn không thể giả lập được dữ liệu webhook vì backend của em áp dụng cơ chế **Xác thực chữ ký mã hóa (Cryptographic Signature Verification)**. Cả Stripe và VNPay đều cung cấp một khóa bí mật chữ ký (`Webhook Secret Key`) duy nhất cho máy chủ của em. Khi gửi webhook, họ sẽ mã hóa dữ liệu gửi kèm một chữ ký mã hóa đặt trong header của request. Khi nhận request, backend sẽ dùng thư viện SDK của Stripe hoặc thuật toán băm HMAC-SHA512 với khóa bí mật để tính toán lại chữ ký từ dữ liệu thô nhận được. Nếu chữ ký trùng khớp, backend mới xác nhận giao dịch thành công. Mọi nỗ lực giả mạo dữ liệu mà không có khóa bí mật đều bị từ chối với lỗi HTTP 400/401.

#### Câu 17: Sự khác biệt giữa Socket.IO và Server-Sent Events (SSE) trong đồ án của em là gì? Tại sao em không dùng WebSockets cho tất cả luồng thời gian thực?
*   **Trả lời:**
    *   **Socket.IO (WebSocket):** Thiết lập kết nối hai chiều toàn song công (bi-directional), phù hợp nhất cho tính năng **Chat trực tuyến** nơi người dùng và nhà bán hàng liên tục gửi và nhận tin nhắn qua lại với độ trễ tối thiểu.
    *   **Server-Sent Events (SSE):** Thiết lập kết nối một chiều từ Server về Client (uni-directional), phù hợp cho tính năng **Thông báo đơn hàng mới** của Vendor. Vì Vendor chỉ cần nhận thông báo khi có sự kiện thanh toán hoặc thay đổi đơn hàng từ server mà không cần gửi ngược thông điệp gì trên kênh đó. SSE nhẹ hơn WebSocket, tự động kết nối lại và hoạt động tốt trên giao thức HTTP/HTTPS tiêu chuẩn mà không cần cấu hình cổng đặc biệt, giúp tiết kiệm tài nguyên CPU cho máy chủ.

#### Câu 18: Khi kết nối Socket.IO bị đứt đột ngột do mất mạng, hệ thống của em xử lý thế nào để đảm bảo người dùng không bị mất tin nhắn?
*   **Trả lời:** Khi mất mạng, Socket.IO ở client có cơ chế tự động kết nối lại (auto-reconnect) sau mỗi khoảng thời gian ngắn. Khi kết nối lại thành công, client sẽ thực hiện bắt tay (handshake) và xác thực lại token. Về phía dữ liệu tin nhắn, mọi tin nhắn khi gửi lên đều được server ghi nhận và lưu trữ trực tiếp vào cơ sở dữ liệu MongoDB trước khi chuyển tiếp. Khi client kết nối lại, client sẽ gọi API lịch sử tin nhắn để đồng bộ và tải lại toàn bộ các tin nhắn đã bị bỏ lỡ trong thời gian mất kết nối, đảm bảo dữ liệu không bị thất thoát.

---

### Nhóm 6: Câu hỏi về Vận hành, Scale và Cloud

#### Câu 19: Tại sao em lại chọn Cloudflare R2 thay vì AWS S3 để lưu trữ hình ảnh?
*   **Trả lời:** Cloudflare R2 sử dụng chuẩn giao tiếp API tương thích hoàn toàn với AWS S3 (S3-compatible API), tuy nhiên điểm vượt trội nhất của Cloudflare R2 là chính sách **Miễn phí băng thông tải ra ngoài (Zero Egress Fees)**. Với một sàn thương mại điện tử có hàng nghìn lượt truy cập xem ảnh sản phẩm mỗi ngày, chi phí băng thông tải ảnh của AWS S3 sẽ rất lớn và khó dự đoán. Cloudflare R2 giúp tiết kiệm đáng kể chi phí vận hành mà vẫn duy trì tốc độ tải ảnh cực nhanh nhờ tích hợp mạng lưới phân phối nội dung (Cloudflare CDN) toàn cầu.

#### Câu 20: Nếu hệ thống của em cần phục vụ số lượng người dùng tăng lên gấp 10 lần (Scale-up), em sẽ thiết kế lại kiến trúc như thế nào?
*   **Trả lời:** Để scale hệ thống lên gấp 10 lần, em sẽ áp dụng các giải pháp sau:
    1.  **Phía Máy chủ ứng dụng (Backend):** Triển khai chạy nhiều instance backend Node.js phía sau một Load Balancer (ví dụ Nginx hoặc AWS ALB) hoạt động theo cơ chế Round Robin để chia tải. Chuyển đổi kênh giao tiếp Socket.IO sang sử dụng Redis Adapter (Pub/Sub) để đồng bộ tin nhắn realtime giữa các máy chủ backend khác nhau.
    2.  **Phía Bộ nhớ đệm:** Sử dụng Redis Cluster để phân mảnh và tăng khả năng chịu tải cho lớp bảo mật xác thực (Rate-limiter) và RTR Deny-list.
    3.  **Phía Cơ sở dữ liệu:** Cấu hình MongoDB Replication (1 Node chính ghi, nhiều Node phụ đọc - Read/Write splitting) để giảm tải cho database chính, kết hợp cơ chế Phân mảnh (Sharding) dữ liệu sản phẩm và đơn hàng theo khóa phân mảnh phù hợp (ví dụ `vendorId` hoặc `userId`).

#### Câu 21: Tại sao em lại cấu hình Cookie xác thực ở chế độ `HttpOnly` và `Secure`? Nếu không có HTTPS thì cờ `Secure` có hoạt động không?
*   **Trả lời:** Cấu hình cookie xác thực ở chế độ `HttpOnly` giúp ngăn chặn mã độc Javascript truy cập đọc cookie (chống XSS). Cờ `Secure` đảm bảo trình duyệt chỉ truyền cookie này lên server thông qua các kết nối đã được mã hóa an toàn bằng SSL/TLS (giao thức HTTPS). Nếu không có HTTPS (chạy HTTP thường), trình duyệt sẽ từ chối gửi cookie có cờ `Secure` lên server. Do đó, trong môi trường phát triển local (HTTP), em cấu hình tắt cờ `secure` tạm thời hoặc chạy SSL tự ký trên localhost, còn trên production bắt buộc phải có chứng chỉ SSL và bật cờ `Secure` để đảm bảo an toàn thông tin.

#### Câu 22: Vai trò của biến môi trường `NODE_ENV` trong đồ án là gì? Nó giúp ích gì cho bảo mật?
*   **Trả lời:** Biến `NODE_ENV` dùng để phân biệt môi trường chạy của ứng dụng giữa phát triển (`development`) và thực tế (`production`). 
    *   Trong môi trường `development`, backend cho phép hiển thị các lỗi hệ thống chi tiết (Stack Trace) để phục vụ gỡ lỗi (debugging) và chấp nhận kết nối HTTP không mã hóa.
    *   Trong môi trường `production`, backend sẽ tự động ẩn toàn bộ stack trace chi tiết của lỗi (tránh để lộ cấu trúc thư mục và lỗ hổng code cho kẻ xấu khai thác), enforce kiểm tra bắt buộc phải có `JWT_SECRET` mạnh, đồng thời yêu cầu các cấu hình cookie bảo mật nghiêm ngặt (`secure=true`).

#### Câu 23: Làm thế nào em xử lý giao dịch hoàn tiền (Refund) khi đơn hàng đã thanh toán qua Stripe bị hủy?
*   **Trả lời:** Khi đơn hàng thanh toán trực tuyến qua Stripe bị hủy thành công (chỉ áp dụng khi trạng thái đơn hàng còn là `Order Placed` hoặc `Packing` và đã xác nhận thanh toán), hàm `cancelOrderService` của backend sẽ gọi API `stripe.refunds.create` truyền vào `paymentIntentId` của đơn hàng được lưu lại từ trước. Stripe sẽ xử lý giao dịch hoàn tiền trực tiếp về tài khoản thẻ của khách hàng. Backend sẽ đón nhận webhook từ Stripe xác nhận refund thành công để cập nhật lại trạng thái tài chính đơn hàng, đồng thời ghi nhận log hoạt động hoặc bắn thông báo cho người dùng.

#### Câu 24: Thiết kế bảng kê tính tiền (pricing) lồng trong bảng `order` mang lại lợi ích gì so với việc tính toán động mỗi lần xem đơn hàng?
*   **Trả lời:** Việc lưu snapshot bảng kê tính tiền (`pricing` gồm subtotal, shopDiscount, platformDiscount, shippingFee, finalTotal) và danh sách mã voucher đã áp dụng trực tiếp vào tài liệu đơn hàng là bắt buộc vì:
    *   **Tính toàn vẹn dữ liệu lịch sử:** Giá sản phẩm, các chương trình khuyến mãi, phí vận chuyển và chính sách giảm giá của sàn liên tục thay đổi theo thời gian. Nếu không lưu lại snapshot giá trị tại thời điểm mua, việc tính toán động lại sau này sẽ cho ra kết quả sai lệch so với số tiền thực tế khách hàng đã thanh toán.
    *   **Hiệu năng truy vấn:** Giúp giao diện hiển thị hóa đơn thanh toán cực nhanh chỉ bằng một truy vấn đọc đơn giản vào tài liệu đơn hàng mà không cần phải truy vấn kéo lại dữ liệu từ bảng sản phẩm, bảng voucher và thực hiện tính toán lại từ đầu.

#### Câu 25: Trong phần giao diện Merchant Dashboard, thư viện Recharts vẽ biểu đồ dựa trên cấu trúc dữ liệu nào và em đã format dữ liệu ở Backend như thế nào để tương thích?
*   **Trả lời:** Thư viện Recharts vẽ biểu đồ dựa trên một mảng các đối tượng JSON phẳng (ví dụ: `[{ date: "2026-06-01", revenue: 500000 }]`). Ở Backend, em sử dụng MongoDB Aggregation pipeline để nhóm dữ liệu hóa đơn theo định dạng mong muốn:
    1. Dùng stage `$match` để lọc các đơn hàng thành công của đúng `vendorId`.
    2. Dùng stage `$project` để định dạng lại ngày tháng từ trường Epoch Timestamp sang chuỗi định dạng ngày hiển thị (`YYYY-MM-DD`).
    3. Dùng stage `$group` gom cụm theo ngày và tính `$sum` doanh thu.
    4. Dùng stage `$sort` để sắp xếp dữ liệu theo thứ tự thời gian tăng dần trước khi trả về Client. Client chỉ việc nhận mảng dữ liệu này và truyền trực tiếp vào component `<AreaChart>` hoặc `<BarChart>` của Recharts mà không cần xử lý gì thêm.

---

## 9. HƯỚNG DẪN VẬN HÀNH DEMO AN TOÀN

Để buổi trình diễn demo đồ án trước hội đồng diễn ra mượt mà và không gặp các sự cố kỹ thuật ngoài ý muốn (theo tài liệu rủi ro `demo-risks-vi.md`):

1.  **Tránh demo đăng ký tài khoản mới tại chỗ:** Dịch vụ gửi email OTP qua Gmail SMTP có thể bị trễ mạng hoặc bị tường lửa của trường chặn. Hãy sử dụng các tài khoản người mua và nhà bán hàng đã được xác minh trước trong cơ sở dữ liệu để thực hiện đăng nhập trực tiếp.
2.  **Chạy ứng dụng admin song song:** Vendor Dashboard của nhà bán hàng yêu cầu ứng dụng admin phải chạy song song ở cổng `5174` để đón nhận các luồng chuyển hướng khi đăng ký gian hàng.
3.  **Chuẩn bị dữ liệu Voucher:** Tạo sẵn mã voucher demo (ví dụ: `DEMO50`) trong DB với thời hạn hiệu lực dài, số lượng sử dụng lớn (`usageLimit >= 50`) và reset lượt đã dùng (`usedCount = 0`) trước giờ G.
4.  **Kịch bản demo an toàn khuyến nghị:**
    *   **Bước 1:** Trình diễn trang chủ, tìm kiếm sản phẩm và xem chi tiết sản phẩm.
    *   **Bước 2:** Đăng nhập bằng tài khoản người mua đã chuẩn bị sẵn.
    *   **Bước 3:** Thêm sản phẩm biến thể (chú ý chọn đầy đủ kích thước/màu sắc) vào giỏ hàng.
    *   **Bước 4:** Áp dụng mã giảm giá và kiểm tra bảng kê tiền tệ hiển thị 4 lớp chi tiết.
    *   **Bước 5:** Thực hiện đặt hàng với hình thức thanh toán **COD** (để tránh rủi ro mất kết nối cổng thanh toán Stripe/VNPay hoặc kẹt webhook cục bộ trên máy trường).
    *   **Bước 6:** Đăng nhập vào giao diện Merchant Dashboard của Vendor để xem thông tin đơn hàng mới nhận được cập nhật tức thời qua thông báo đẩy.
    *   **Bước 7:** Trình diễn tính năng Chat trực tuyến giữa hai tài khoản bằng hai trình duyệt khác nhau (một tab thường và một tab ẩn danh).
