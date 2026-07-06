# GIẢI THÍCH TOÀN BỘ CODEBASE — CHUẨN BỊ PHẢN BIỆN ĐỒ ÁN TỐT NGHIỆP

> Tài liệu này giải thích **toàn bộ** mã nguồn của dự án: kiến trúc, từng module, luồng dữ liệu,
> các quyết định kỹ thuật quan trọng và lý do đằng sau chúng. Đọc kèm `docs/QnA-Defence-Guide.md`
> (bộ câu hỏi phản biện có sẵn) để chuẩn bị tốt nhất.

---

## MỤC LỤC

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Kiến trúc tổng thể](#2-kiến-trúc-tổng-thể)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Backend chi tiết](#4-backend-chi-tiết)
5. [Frontend — website mua sắm](#5-frontend--website-mua-sắm)
6. [Admin — dashboard người bán](#6-admin--dashboard-người-bán)
7. [Hạ tầng & triển khai](#7-hạ-tầng--triển-khai)
8. [Các điểm nhấn kỹ thuật khi phản biện](#8-các-điểm-nhấn-kỹ-thuật-khi-phản-biện)
9. [Câu hỏi phản biện dự kiến & gợi ý trả lời](#9-câu-hỏi-phản-biện-dự-kiến--gợi-ý-trả-lời)

---

## 1. TỔNG QUAN DỰ ÁN

Đây là **sàn thương mại điện tử đa người bán (multi-vendor marketplace)** theo mô hình Shopee,
gồm 3 ứng dụng độc lập dùng chung 1 API:

| Ứng dụng | Thư mục | Công nghệ | Cổng dev | Vai trò |
|---|---|---|---|---|
| **Shop** (người mua) | `frontend/` | React 19 + Vite + TailwindCSS | 5173 | Duyệt/tìm sản phẩm, giỏ hàng, đặt hàng, thanh toán, chat, đánh giá |
| **Vendor Dashboard** | `admin/` | React 19 + Vite | 5174 | Quản lý sản phẩm, đơn hàng, voucher, thống kê, chat, mô phỏng concurrency |
| **API Server** | `backend/` | Node.js + Express 5 + MongoDB (Mongoose 8) + Redis | 4000 | REST API + Socket.IO (chat) + SSE (thông báo) |

**Tính năng chính:**
- Đăng ký/đăng nhập (email + OTP xác minh, Google OAuth), mô hình tài khoản hợp nhất user ↔ vendor.
- Sản phẩm có **biến thể (SKU/variants)**, danh mục phân cấp 3 tầng.
- Giỏ hàng, đặt hàng đa người bán trong 1 đơn, thanh toán **COD / Stripe / VNPay**.
- **Chống oversell** (bán vượt kho) khi nhiều người mua đồng thời + **idempotency** chống đơn trùng.
- Hệ thống **voucher 3 loại** (shop / sàn / vận chuyển).
- **Gợi ý sản phẩm** (recommendation): content-based + collaborative filtering.
- **Tìm kiếm** server-side có chấm điểm liên quan + hỗ trợ tiếng Việt không dấu.
- **Chat realtime** người mua ↔ người bán (Socket.IO), **thông báo realtime** (SSE).
- Đánh giá sản phẩm (chỉ sau khi nhận hàng), trả hàng/hoàn tiền (có refund Stripe tự động).
- Lưu ảnh trên **Cloudflare R2**, nén ảnh bằng **sharp** (webp, 2 kích thước).

---

## 2. KIẾN TRÚC TỔNG THỂ

```
┌─────────────┐        ┌─────────────┐
│  frontend   │        │    admin    │
│ (người mua) │        │ (người bán) │
└──────┬──────┘        └──────┬──────┘
       │  REST (axios) + Socket.IO + SSE  │
       └──────────────┬───────────────────┘
                      ▼
             ┌─────────────────┐
             │  backend :4000  │  Express 5
             │  ┌───────────┐  │
             │  │  routes   │  │  ← định nghĩa endpoint + gắn middleware
             │  ├───────────┤  │
             │  │controllers│  │  ← nhận req/res, bắt lỗi, trả JSON
             │  ├───────────┤  │
             │  │ services  │  │  ← TOÀN BỘ business logic
             │  ├───────────┤  │
             │  │  models   │  │  ← Mongoose schema + index
             │  └───────────┘  │
             └───┬────┬────┬───┘
                 ▼    ▼    ▼
           MongoDB  Redis  Dịch vụ ngoài
           (dữ liệu) (session,   (Stripe, VNPay, R2,
                     rate-limit,  Gmail SMTP, Google
                     cache)       OAuth, Telegram)
```

**Nguyên tắc phân lớp** (áp dụng nhất quán toàn backend):
- `routes/*.js` — khai báo URL, method, gắn middleware xác thực + rate-limit.
- `controllers/*.js` — mỏng: lấy tham số từ `req`, gọi service, format response, map lỗi → HTTP status.
- `services/*.js` — chứa toàn bộ nghiệp vụ; ném `Error` có gắn thuộc tính `status` để controller trả mã đúng.
- `models/*.js` — schema Mongoose + index (unique, compound, text, partial).

**Realtime dùng 2 cơ chế khác nhau, có chủ đích:**
- **Socket.IO** cho chat — cần 2 chiều (gửi/nhận tin nhắn), có room theo cuộc hội thoại.
- **SSE (Server-Sent Events)** cho thông báo — chỉ cần 1 chiều server → client, nhẹ hơn WebSocket,
  chạy trên HTTP thuần, tự reconnect. (`/api/notification/stream`)

---

## 3. CẤU TRÚC THƯ MỤC

```
DATN/
├── backend/
│   ├── server.js              # Điểm khởi động: Express, Socket.IO, CORS, webhook, sweep kho
│   ├── config/                # mongodb.js, redis.js, r2.js, cloudinary.js
│   ├── models/                # 14 Mongoose models
│   ├── routes/                # 16 routers (user, product, order, cart, ...)
│   ├── controllers/           # 21 controllers
│   ├── services/              # ~25 services (nghiệp vụ chính)
│   │   ├── order/             # Tách riêng domain đặt hàng (5 file con)
│   │   └── tests/             # Unit test (Jest + mongodb-memory-server)
│   ├── middleware/            # auth.js, vendorAuth.js, authRateLimit.js, multer.js
│   ├── utils/                 # vnpay.js, r2Upload.js, sendResetEmail.js, imageProxyAllowlist.js
│   ├── scripts/               # Seed/import dữ liệu, test concurrency
│   └── data/                  # productData.json, vn-locations.json (địa giới VN offline)
├── frontend/src/
│   ├── App.jsx                # Khai báo ~22 routes
│   ├── context/ShopContext.jsx# State toàn cục (giỏ hàng, token, sản phẩm, ...)
│   ├── pages/  (auth|main|profile|shop)
│   ├── components/ (cart|checkout|home|layout|product|profile|ui)
│   └── hooks/                 # usePlaceOrderCheckout, useChatInbox, ...
├── admin/src/
│   ├── App.jsx                # Login gate + SSE + routes
│   ├── pages/                 # Stats, Add, List, Orders, Vouchers, Chat, Simulator
│   └── components/            # Navbar, Sidebar, VariantsManager, VendorValidator, ...
├── docker/                    # docker-compose.yml (prod) + docker-compose.dev.yml
├── docs/                      # Tài liệu thiết kế + kế hoạch (tiếng Việt)
└── thesis/                    # k6_concurrency.js (load test), báo cáo LaTeX
```

---

## 4. BACKEND CHI TIẾT

### 4.1. Khởi động server — `backend/server.js`

Thứ tự khởi động (quan trọng, hay bị hỏi):

1. **Kiểm tra `JWT_SECRET`** ≥ 32 ký tự, thiếu thì throw ngay — fail-fast, không cho chạy server thiếu bảo mật.
2. **CORS whitelist động**: mặc định cho `localhost:5173/5174`, đọc thêm từ env `CORS_ORIGINS`,
   và tự động chấp nhận domain `*.datn-frontend.pages.dev` / `*.datn-admin.pages.dev`
   (preview deploy của Cloudflare Pages). `credentials: true` để gửi cookie.
3. **`app.set('trust proxy', 1)`** — chạy sau reverse proxy (Cloudflare Tunnel/Nginx) nên cần tin
   header `X-Forwarded-For` để lấy đúng IP thật (phục vụ rate-limit).
4. **Stripe webhook mount TRƯỚC `express.json()`** với `express.raw()`:
   ```js
   app.post('/api/order/stripe-webhook', express.raw({type:'application/json'}), stripeWebhook);
   ```
   Lý do: Stripe ký chữ ký trên **raw body**; nếu để `express.json()` parse trước thì
   không thể verify chữ ký được nữa. Đây là chi tiết kỹ thuật đáng nói khi phản biện.
5. **Socket.IO** gắn vào cùng HTTP server, có **middleware xác thực**: client phải gửi access token
   trong `socket.handshake.auth.token`; token được verify qua `verifyAccessToken` (kiểm tra cả session
   Redis). Sự kiện `join_room` kiểm tra người dùng có phải **thành viên cuộc hội thoại** không
   (buyerId/vendorId) mới cho join — chống nghe lén chat người khác.
6. Mount 16 router theo prefix `/api/...`.
7. **Vòng quét đặt chỗ kho (reservation sweep)**: `setInterval` mỗi 60s gọi
   `expirePendingReservationsService()` — tự hủy các đơn Stripe/VNPay chưa thanh toán quá hạn
   và **trả kho** (chi tiết ở mục 4.10). Timer được `unref()` để không chặn process tắt.

#### 4.1.b. Giải thích chậm từng mục (đọc khi chưa quen khái niệm)

`server.js` là file **chạy đầu tiên** khi gõ `npm run server` — "công tắc tổng" bật cả hệ thống,
và **thứ tự bật rất quan trọng**.

**(1) Kiểm tra JWT_SECRET — "fail-fast".** `JWT_SECRET` là chìa khóa bí mật để ký token đăng
nhập. Nếu rỗng/quá ngắn (dễ đoán), kẻ xấu có thể tự tạo token giả và đăng nhập thành bất kỳ ai.
Fail-fast = thà **sập ngay lúc khởi động** để dev biết mà sửa, còn hơn server chạy êm ru với một
lỗ hổng. Giống xe không cho nổ máy nếu chưa cài dây an toàn.

**(2) CORS whitelist.** Trình duyệt có luật an ninh: trang web ở domain A (`localhost:5173`)
muốn gọi API ở domain B (`localhost:4000`) thì **server B phải cho phép** — cơ chế đó là CORS.
Whitelist = danh sách trang được phép gọi API: 2 địa chỉ localhost khi dev, thêm domain thật qua
env `CORS_ORIGINS` khi deploy (không sửa code), và tự nhận `*.pages.dev` vì Cloudflare Pages sinh
URL preview ngẫu nhiên mỗi lần deploy. `credentials: true` vì mặc định trình duyệt **không gửi
cookie** sang domain khác — phải bật thì cookie chứa refresh token mới đi kèm request.
*Một câu:* "chỉ đúng 2 web của em được gọi API, và cookie đăng nhập được phép đi kèm."

**(3) trust proxy.** Khi deploy, request không đi thẳng vào Node mà qua trung gian
(Cloudflare Tunnel/Nginx): `Người dùng (IP 1.2.3.4) → Cloudflare → Backend`. Backend nhìn thấy
**mọi request đều từ IP của proxy**; IP thật nằm trong header `X-Forwarded-For`.
`trust proxy, 1` = "có 1 tầng proxy phía trước, hãy tin header đó". Vì rate-limit chặn theo IP,
nếu thiếu dòng này thì cả sàn bị tính chung 1 IP → một người spam login là **tất cả bị khóa theo**.

**(4) Vì sao webhook Stripe phải đứng TRƯỚC `express.json()`.** Webhook = khách trả tiền xong,
**Stripe chủ động gọi ngược** vào API mình để báo "đơn X đã thanh toán". Ai cũng có thể gọi URL
đó giả làm Stripe, nên Stripe **ký chữ ký** trên **chuỗi byte gốc (raw body)** của request.
`express.json()` biến byte thành object JS — quá trình đó không thể khôi phục lại đúng 100% chuỗi
gốc (khoảng trắng, thứ tự key...), lệch 1 byte là chữ ký tính lại đã khác → verify luôn fail.
Giải pháp: khai báo route webhook **trước** `app.use(express.json())` và dùng `express.raw()`
giữ nguyên byte gốc riêng cho route này. Middleware Express chạy theo thứ tự khai báo — **thứ tự
dòng code ở đây chính là logic**.

**(5) Socket.IO — 2 lớp chống nghe lén chat.** Lớp 1 (cửa vào): mở kết nối socket phải nộp
access token hợp lệ, sai → từ chối kết nối. Lớp 2 (cửa phòng): mỗi cuộc hội thoại là 1 "room";
khi client xin `join_room`, server **tra DB** xem người này có phải buyerId/vendorId của cuộc hội
thoại không, không phải → từ chối. Thiếu lớp 2 thì một user đăng nhập hợp lệ có thể mò ID hội
thoại của người khác, join vào và **đọc trộm toàn bộ tin nhắn**.

**(6) Mount 16 router.** Chỉ là bảng phân luồng URL: `/api/user/... → userRoute.js`,
`/api/product/... → productRoute.js`. Như lễ tân tòa nhà 16 tầng — nhìn địa chỉ, chỉ khách lên
đúng tầng; logic thật nằm trong từng router/controller/service.

**(7) Reservation sweep — "robot tuần tra trả kho".** Bối cảnh: đặt hàng Stripe/VNPay thì hệ
thống **trừ kho trước** (giữ chỗ) rồi mới đưa khách sang trang thanh toán — không giữ thì lúc
khách đang gõ số thẻ, người khác mua mất. Vấn đề: khách giữ chỗ xong **tắt trình duyệt không trả
tiền** → hàng bị "giam" mãi. Giải pháp: mỗi đơn online chỉ giữ kho **15 phút**
(`reservationExpiresAt`); `setInterval` 60 giây/lần quét đơn *chưa thanh toán + Stripe/VNPay +
quá hạn* → hủy đơn (lý do "Payment timeout") → **cộng trả kho + trả lượt voucher**. Còn
`unref()`: bình thường `setInterval` giữ process Node sống mãi; `unref()` bảo Node "timer này
không quan trọng đến mức đó" → server tắt sạch sẽ khi chạy test/Docker stop.

**Bảng trả lời nhanh 1 dòng:**

| Mục | Câu trả lời 1 dòng |
|---|---|
| JWT check | Thiếu chìa khóa ký token thì thà sập lúc khởi động còn hơn chạy không an toàn |
| CORS | Chỉ cho đúng web của mình gọi API, và cho phép cookie đăng nhập đi kèm |
| trust proxy | Đứng sau Cloudflare nên phải đọc IP thật từ header, không thì rate-limit chặn nhầm cả sàn |
| Webhook raw | Stripe ký chữ ký trên byte gốc → route này phải nhận byte gốc, đặt trước express.json() |
| Socket.IO | Có token mới được kết nối; là thành viên hội thoại mới được vào phòng chat |
| 16 router | Bảng phân luồng URL, mỗi prefix giao một module |
| Sweep | Đơn online giữ kho tối đa 15 phút; robot quét 60s/lần, quá hạn chưa trả tiền → hủy đơn, trả kho |

### 4.2. Cơ sở dữ liệu — 14 models

| Model | File | Vai trò chính |
|---|---|---|
| `user` | `userModel.js` | Người dùng + người bán hợp nhất (`role: user\|vendor`), giỏ hàng nhúng `cartData` |
| `product` | `productModel.js` | Sản phẩm + biến thể (variants), 3 tầng danh mục, text index tìm kiếm |
| `category` | `categoryModel.js` | Danh mục phân cấp `level 1-3`, `parentCategory`, slug unique |
| `order` | `orderModel.js` | Đơn hàng đa vendor, pricing chi tiết, idempotency, đặt chỗ kho |
| `voucher` | `voucherModel.js` | Mã giảm giá `SHOP\|PLATFORM\|SHIPPING`, `PERCENT\|FIXED` |
| `review` | `reviewModel.js` | Đánh giá, unique `(product, user, orderId)` |
| `conversation`+`message` | `chatModel.js` | Chat buyer↔vendor, đếm chưa đọc 2 phía |
| `notification` | `notificationModel.js` | Thông báo, phân `audience: user\|vendor` |
| `userInteraction` | `userInteractionModel.js` | Hành vi người dùng → điểm tương tác (cho recommendation) |
| `searchAnalytics` | `searchAnalyticsModel.js` | Đếm từ khóa tìm kiếm → trending |
| `address` | `addressModel.js` | Sổ địa chỉ giao hàng |
| `shopFollow` | `shopFollowModel.js` | Theo dõi cửa hàng |
| `productPriceAlert` | `productPriceAlertModel.js` | Đăng ký báo giảm giá |
| `returnRequest` | `returnRequestModel.js` | Yêu cầu trả hàng/hoàn tiền |

**Những index đáng chú ý (hay được hỏi "tối ưu thế nào?"):**

- `product`: index theo `category+subCategory`, `vendorId`, `price`, `sold desc`, và
  **text index có trọng số** `{name: 10, brand: 5, tags: 3}` phục vụ tìm kiếm.
- `order`: **partial unique index** `{userId, idempotencyKey}` (chỉ áp khi idempotencyKey là string)
  → chốt chặn cuối cùng chống tạo đơn trùng.
- `user`: **partial unique index** trên `shopNameNormalized` (chỉ khi `role='vendor'`)
  → tên shop không trùng nhau (đã chuẩn hóa lowercase, gộp khoảng trắng).
- `review`: unique `(product, user, orderId)` → 1 người chỉ đánh giá 1 sản phẩm 1 lần cho mỗi đơn.
- `userInteraction`: unique `(userId, productId)` → mỗi cặp user-sản phẩm là 1 document tích lũy.
- `conversation`: unique `(buyerId, vendorId)` → mỗi cặp chỉ có 1 cuộc hội thoại (upsert khi init).

**Mô hình user/vendor hợp nhất:** không có bảng vendor riêng. Một user thường có thể "nâng cấp"
thành vendor qua `/api/user/register-vendor` (điền tên shop, địa chỉ, SĐT) → `role='vendor'`.
Ưu điểm: 1 tài khoản vừa mua vừa bán (giống Shopee), không phải đồng bộ 2 bảng, auth đơn giản.

### 4.3. Xác thực & quản lý phiên (điểm nhấn bảo mật số 1)

Files: `services/authSessionService.js`, `services/userService.js`, `controllers/userController.js`,
`middleware/auth.js`, `middleware/vendorAuth.js`.

**Mô hình: Access token ngắn hạn + Refresh token xoay vòng + Session lưu Redis.**

- **Access token** (JWT, mặc định 15 phút): payload `{id, sid, type:'access'}`. Gửi qua
  header `token` hoặc cookie `accessToken`.
- **Refresh token** (JWT, mặc định 7 ngày): payload `{id, sid, jti, type:'refresh'}`. **Chỉ nằm trong
  cookie `HttpOnly`** → JavaScript không đọc được → chống XSS đánh cắp token.
- **Session Redis**: key `datn:auth:session:<sid>` lưu `{sid, userId, currentRefreshJti, expiresAt}`
  với TTL. Nếu Redis không có, fallback sang `Map` trong RAM (dev mode).

**Refresh token rotation (chống replay):** mỗi lần gọi `/api/user/refresh`:
1. Verify JWT refresh token.
2. Đọc session theo `sid`, so `jti` trong token với `currentRefreshJti` trong session.
3. **Nếu lệch jti** (tức là token cũ đã dùng rồi bị dùng lại — dấu hiệu bị đánh cắp) →
   **xóa luôn session** → mọi token của phiên đó chết → buộc đăng nhập lại.
4. Nếu khớp → phát cặp token mới (jti mới ghi đè vào session).

**Logout thật sự:** `/api/user/logout` gọi `revokeAuthSession` xóa session Redis → access token
còn hạn cũng vô dụng vì `verifyAccessToken` luôn kiểm tra session còn sống
(`assertAccessTokenSession`). Đây là câu trả lời cho "JWT stateless thì logout kiểu gì?" —
dự án dùng **JWT + server-side session hybrid**.

**Đăng ký + OTP email:** `registerUserService` tạo user `emailVerified:false`, sinh OTP 6 số
(hạn 15 phút), gửi qua Gmail SMTP (nodemailer). Đăng nhập bị chặn nếu chưa xác minh.
Đăng ký lại email chưa xác minh → gửi lại OTP mới (không lộ thông tin, không tạo bản ghi trùng).

**Google OAuth:** frontend lấy `credential` (ID token) từ Google → backend verify bằng
`google-auth-library` với đúng `GOOGLE_CLIENT_ID` → tìm user theo `googleId` hoặc `email`,
chưa có thì tạo mới (password ngẫu nhiên đã hash), có rồi thì liên kết `googleId`.

**Quên mật khẩu:** token ngẫu nhiên 32 byte (`crypto.randomBytes`), hạn 1 giờ, gửi link qua email.
API **luôn trả thành công** dù email không tồn tại → không cho attacker dò email đã đăng ký
(user enumeration prevention).

**Chính sách mật khẩu:** tối thiểu 8 ký tự, có cả chữ và số; hash bằng **bcrypt** (salt 10 rounds).

**Hai middleware xác thực:**
- `authUser` — verify access token, gắn `req.userId`.
- `vendorAuth` — verify token **và** query DB kiểm tra `role==='vendor'`
  (không tin role trong token vì role có thể đổi giữa chừng) → gắn `req.vendorId`, `req.vendorShopName`.

#### 4.3.b. Giải thích chậm — đọc phần này nếu mục trên khó hiểu

**Bước 0 — vấn đề gốc: HTTP không có trí nhớ.** Mỗi request là một lần "gặp mặt" hoàn toàn mới;
đăng nhập xong, request sau server đã quên bạn. Phải có thứ gửi kèm mỗi request để chứng minh
"tôi là user 123 đã đăng nhập" — đó là **token**, như *vé vào cổng*. **JWT** là loại vé trên đó
ghi thông tin (id, hạn dùng) kèm **chữ ký của server**: sửa nội dung vé → chữ ký sai → server chỉ
cần kiểm chữ ký là biết thật/giả, không cần tra sổ.

**Bước 1 — vì sao cần HAI token?** Nếu chỉ 1 token: sống 7 ngày → bị trộm là kẻ trộm xài nguyên
7 ngày; sống 15 phút → 15 phút bị đá ra đăng nhập lại một lần. Nên tách làm 2:

| | Access token — *vé trong ngày* | Refresh token — *thẻ thành viên* |
|---|---|---|
| Sống | 15 phút | 7 ngày |
| Dùng để | gửi kèm **mọi** request API | **chỉ** để đổi lấy access token mới |
| Cất ở | bộ nhớ JS của trang | cookie **HttpOnly** |

Access hết hạn → frontend **âm thầm** gọi `/api/user/refresh` đưa "thẻ thành viên" → nhận vé
mới → người dùng không hề hay biết, dùng liên tục 7 ngày. Được cả bảo mật của vé ngắn lẫn tiện
lợi của vé dài.

**HttpOnly là gì?** Cookie gắn cờ HttpOnly thì **JavaScript không đọc được** (`document.cookie`
không thấy), trình duyệt chỉ tự đính kèm khi gửi request. Nên dù trang dính **XSS** (kẻ xấu tiêm
được JS chạy trên trang mình), đoạn JS đó cũng không móc trộm được refresh token.

**Bước 2 — `sid` và `jti` chỉ là 2 mã số, đừng sợ tên.**
- `sid` (session id) = **mã phiên đăng nhập**. Đăng nhập trên điện thoại + laptop = 2 phiên,
  2 sid khác nhau.
- `jti` (JWT token id) = **số seri của từng chiếc refresh token**; mỗi lần phát token mới là một
  seri mới.

Ví như: `sid` là **số hợp đồng thành viên**, `jti` là **số seri tấm thẻ nhựa**. Hợp đồng có thể
đổi thẻ nhiều lần, nhưng tại mỗi thời điểm **chỉ 1 tấm thẻ hợp lệ**.

**Bước 3 — vì sao cần session Redis? (điểm yếu của JWT thuần).** JWT thuần server không lưu gì,
chỉ kiểm chữ ký → bấm **Logout** xong, token cũ **vẫn hợp lệ** cho đến khi tự hết hạn — server
không rút lại được! Khắc phục: server giữ một **cuốn sổ** trong Redis, mỗi phiên một dòng:
`datn:auth:session:<sid> → {userId, currentRefreshJti, expiresAt}`. Từ đó **mọi lần verify token
đều tra sổ thêm một bước**: chữ ký đúng *chưa đủ*, dòng sổ `sid` **phải còn tồn tại**.
→ **Logout = gạch dòng sổ** → mọi token của phiên (kể cả access còn hạn 10 phút) chết ngay.
Đây là câu trả lời cho *"JWT stateless thì logout kiểu gì?"*: mô hình **lai** — JWT để khỏi tra
DB mỗi request + 1 dòng session Redis nhỏ để có quyền thu hồi. (Redis có TTL nên dòng sổ tự bốc
hơi khi phiên hết 7 ngày.)

**Bước 4 — rotation: "mỗi thẻ chỉ dùng ĐÚNG MỘT LẦN".** Quy tắc duy nhất: mỗi lần dùng refresh
token, server **thu thẻ cũ, phát thẻ mới** (ghi seri mới vào sổ).

*Kịch bản bình thường:*
```
Đăng nhập      → sổ ghi: phiên S1, thẻ hợp lệ = seri A. Phát thẻ A.
15 phút sau    → refresh bằng A → sổ ghi A → KHỚP ✓ → phát thẻ B, sổ sửa thành B
                 (thẻ A từ nay là giấy vụn)
15 phút sau    → refresh bằng B → khớp → phát C ... cứ thế xoay vòng
```

*Kịch bản bị trộm token — rotation phát huy tác dụng:*
```
Hacker chép trộm được thẻ A.
Hacker refresh bằng A trước → khớp → hắn nhận thẻ B, sổ đổi thành B.
Trình duyệt CỦA BẠN refresh bằng thẻ A của mình
  → sổ ghi B, bạn đưa A → LỆCH SERI ✗
  → Server suy luận: "một thẻ bị dùng 2 lần = chắc chắn có 2 người cầm cùng 1 thẻ
     = token đã bị lộ!"
  → Phản ứng: XÓA LUÔN dòng sổ S1
  → Thẻ B trong tay hacker cũng chết (tra sổ không còn), vé access cũng chết.
     Cả hai văng ra. Bạn đăng nhập lại bằng mật khẩu → phiên mới. Hacker không có
     mật khẩu → trắng tay.
```

Mấu chốt: **người dùng thật không bao giờ dùng lại thẻ cũ** (trình duyệt luôn cầm thẻ mới nhất),
nên "thẻ cũ bị dùng lại" là bằng chứng không thể chối cãi rằng token bị nhân bản → hủy cả phiên
là phản ứng an toàn nhất. Trong code chính là đoạn
([authSessionService.js:170](../backend/services/authSessionService.js#L170)):

```js
if (!sameUser || !sameRefreshToken) {    // seri lệch sổ
    await deleteSession(descriptor.sid);  // xóa cả phiên
    throw buildInvalidRefreshError();     // 401
}
```

**Câu hỏi hay gặp: server biết "thẻ bị dùng 2 lần" nhờ so IP à?** — **Không.** Server không so
IP, không so thiết bị (IP người thật đổi liên tục WiFi↔4G, còn hacker có thể dùng VPN cùng khu
vực — so IP vô nghĩa). Nó biết **thuần nhờ cách ghi sổ**: sổ Redis chỉ có MỘT ô "seri đang hợp
lệ", và seri chỉ bị thay khi thẻ cũ được dùng thành công. Vậy khi một thẻ **chữ ký thật** nhưng
seri **lệch sổ** xuất hiện → suy ra thẻ đó *đã được tiêu trước đó* mà giờ lại xuất hiện lần nữa
→ tồn tại ít nhất 2 bản sao. Người dùng thật không bao giờ nộp thẻ cũ (mỗi lần refresh thành
công, cookie bị ghi đè bằng thẻ mới ngay) → thẻ cũ quay lại = chắc chắn bị chép trộm. Lưu ý:
server **không biết ai trong 2 người là hacker** — nên nó đuổi cả hai ra và để "vòng loại mật
khẩu" phân định: chỉ chủ thật có mật khẩu để đăng nhập lại. Giống séc ngân hàng có số seri: séc
số 123 đã rút tiền hôm qua, hôm nay lại có người cầm séc số 123 đến rút → chắc chắn có tờ bị
photo → phong tỏa, mời chủ tài khoản ra quầy xác minh.

*Góc khuất (phòng hội đồng hỏi xoáy):* mở 2 tab cùng refresh đồng thời với cùng thẻ A → tab
nhanh thắng, tab chậm nộp thẻ đã cũ → phiên bị hủy, phải đăng nhập lại. Đây là **đánh đổi có chủ
đích**: thi thoảng bất tiện 1 lần đăng nhập, đổi lấy phát hiện chắc chắn token bị trộm (frontend
đã giảm thiểu bằng cách gom về một luồng refresh chung trong `configureAuthSession`).

**Ghép lại — vòng đời một phiên đăng nhập:**
```
ĐĂNG NHẬP → tạo sid + jti, ghi sổ Redis
          → access token (15p, chứa sid) + refresh token (7d, chứa sid+jti, cookie HttpOnly)
GỌI API   → verify chữ ký access → tra sổ sid còn sống → OK, req.userId = id
SAU 15 PHÚT (401) → frontend tự gọi /refresh (cookie tự đính kèm)
          → jti khớp sổ?  khớp → phát cặp mới, ghi jti mới (xoay vòng)
                          lệch → nghi bị trộm → xóa phiên → 401 → đăng nhập lại
LOGOUT    → xóa dòng sổ Redis → mọi token của phiên vô hiệu NGAY LẬP TỨC
```

**Bảng trả lời nhanh:**

| Hỏi | Trả lời 1-2 câu |
|---|---|
| Sao phải 2 token? | Vé ngắn 15 phút để lỡ lộ thì thiệt hại nhỏ; thẻ dài 7 ngày để user không phải đăng nhập lại liên tục. |
| Sao refresh token nằm cookie HttpOnly? | JS không đọc được cookie HttpOnly → trang dính XSS cũng không móc trộm được. |
| `sid`, `jti` là gì? | sid = mã phiên đăng nhập; jti = số seri từng refresh token; sổ Redis ghi seri đang hợp lệ. |
| JWT logout kiểu gì? | Mỗi lần verify đều tra session Redis theo sid; logout xóa session → token còn hạn cũng chết. |
| Rotation để làm gì? | Mỗi refresh token chỉ dùng 1 lần; một thẻ bị dùng 2 lần = chắc chắn bị chép trộm → hủy cả phiên, hacker không có mật khẩu nên bị loại. |

### 4.4. Rate limiting bằng Redis — `middleware/authRateLimit.js`

Thuật toán **fixed window counter**: `INCR key` + `EXPIRE window` (hàm `incrWithWindow` trong
`config/redis.js`). Mỗi endpoint nhạy cảm có limiter theo **cả IP lẫn email**:

| Endpoint | Giới hạn IP / 15 phút | Giới hạn email / 15 phút |
|---|---|---|
| login | 20 | 10 |
| register | 10 | 3 |
| verify-email (OTP) | 30 | 10 (chống brute-force OTP 6 số) |
| forgot-password | 15 | 5 (chống spam email) |
| reset-password | 20 | — |
| refresh | 120 | — |

Trả `429` kèm header chuẩn `X-RateLimit-Limit/Remaining/Reset` và `retryAfterSec`.
Redis chết → fallback `Map` trong RAM (degrade gracefully, không sập auth).
Tất cả ngưỡng đều cấu hình được qua env `AUTH_RL_*`.

### 4.5. Sản phẩm & biến thể (SKU) — `services/productService.js`

- Sản phẩm có `attributes` (VD: Màu = [Đen, Trắng], Size = [M, L]) và mảng `variants`,
  mỗi variant = 1 SKU: `{combination: {Màu:'Đen', Size:'M'}, variantKey, price, stock}`.
- **`variantKey`** là chuỗi chuẩn hóa từ combination: sort key theo alphabet rồi nối
  `"Màu:Đen|Size:M"` → so khớp variant ổn định bất kể thứ tự thuộc tính, dùng làm khóa
  trừ kho atomic (mục 4.10).
- Khi có variants: `product.price` = **min giá các variant**, `product.stock` = **tổng stock các
  variant** (hàm `syncFromVariants`) → trang danh sách hiển thị "giá từ..." và tổng tồn.
- **Xóa sản phẩm an toàn** (`removeProductService` + `deletionGuardService`): nếu sản phẩm đã có
  đơn hàng / review / interaction → chỉ **soft delete** (`isActive=false`) để không vỡ dữ liệu
  lịch sử; chưa có tham chiếu → hard delete. Mọi thao tác đều kiểm tra
  `product.vendorId === req.vendorId` → vendor chỉ sửa/xóa được hàng của mình (chống IDOR).
- Cập nhật giá giảm → gọi `notifyPriceDrop` (mục 4.14).
- Upload tối đa 4 ảnh qua multer → đẩy lên R2.

**Danh mục 3 cấp** (`categoryModel` + `categoryService`): level 1→3, `parentCategory` trỏ lên cha,
slug unique. Sản phẩm lưu cả 3 tham chiếu `category/subCategory/subSubCategory` để lọc nhanh
theo bất kỳ tầng nào.

### 4.6. Giỏ hàng — `services/cartService.js`

- Giỏ nhúng trong user: `cartData = { [productId]: { [optionKey]: quantity } }`,
  `optionKey` là variantKey hoặc `"__default__"` cho sản phẩm không biến thể.
- `sanitizeCartData`: mỗi lần đọc giỏ sẽ lọc bỏ sản phẩm đã bị xóa khỏi DB → giỏ không bao giờ
  chứa hàng "ma".
- Thêm giỏ đồng thời ghi interaction `addedToCart` (fire-and-forget) nuôi hệ gợi ý.
- Frontend cập nhật **optimistic UI** (đổi state trước, gọi API sau) cho trải nghiệm mượt.

### 4.7. Đặt hàng & thanh toán — `services/orderService.js` + `services/order/*`

Domain đặt hàng được tách thành 6 file:

| File | Nhiệm vụ |
|---|---|
| `orderService.js` | Điều phối 3 luồng thanh toán + verify + hủy đơn |
| `order/orderItemsService.js` | Chuẩn hóa items (lấy giá từ **DB**, không tin client), map variantKey, gom nhóm theo vendor, dọn giỏ |
| `order/stockReservationService.js` | Trừ/hoàn kho atomic, sweep hết hạn |
| `order/orderPricingService.js` | Tính tiền + áp voucher + phí ship + preview |
| `order/orderStatusService.js` | Cập nhật trạng thái đơn (tổng và theo từng vendor), tracking number |
| `order/orderAnalyticsService.js` | Thống kê doanh thu vendor (cache Redis 60s) |

**Luồng đặt hàng COD (`placeOrderService`) — 7 bước:**

```
1. Kiểm tra idempotencyKey: đã có đơn với (userId, key) này? → trả lại đơn cũ (không tạo trùng)
2. normalizeOrderItems: lấy giá/tên/ảnh/vendor từ DB theo productId
   → client chỉ gửi {_id, quantity, size}; GIÁ do server quyết định (chống sửa giá)
3. reserveStockByUnits: TRỪ KHO ATOMIC (mục 4.8) — thất bại → ném lỗi 409 OUT_OF_STOCK
4. buildOrderPricingWithVouchers: tính subtotal, phí ship (miễn phí từ 500k), áp voucher strict
   → voucher không hợp lệ → HOÀN KHO rồi ném lỗi
5. claimVoucherUsage: giữ lượt voucher atomic → thất bại → hoàn kho, ném lỗi
6. orderModel.create(...): lưu đơn kèm stockReservedAt, reservationExpiresAt, idempotencyKey
   → nếu dính lỗi duplicate key 11000 (2 request cùng key đua nhau) → hoàn kho + voucher,
     rồi trả về đơn đã tạo bởi request thắng cuộc
7. Hậu xử lý: tăng `sold`, xóa item khỏi giỏ, ghi interaction 'purchased',
   tạo notification cho từng vendor (đẩy realtime qua SSE)
```

**Stripe (`placeOrderStripeService`):** giống trên nhưng sau khi tạo đơn (payment=false) thì tạo
**Stripe Checkout Session** (redirect người dùng sang trang Stripe), lưu `stripeSessionId/Url`
vào đơn. Có chặn giới hạn 999 triệu VND của Stripe. Xác nhận thanh toán bằng **2 đường song song**:
1. **Webhook** `checkout.session.completed` — verify chữ ký trên raw body, đối chiếu
   `metadata.orderId` và `sessionId` khớp đơn → `markStripeOrderPaid` (idempotent: đã paid thì bỏ qua).
2. **Fallback chủ động**: trang `/verify` của frontend gọi `/api/order/verify-stripe` → backend
   tự gọi Stripe API `sessions.retrieve` kiểm tra `payment_status==='paid'` → phòng khi webhook
   không đến (localhost, mạng lỗi).

**VNPay (`placeOrderVNPayService` + `utils/vnpay.js`):**
- Tự xây URL thanh toán theo spec VNPay 2.1.0: sort params alphabet → URL-encode kiểu
  `%20`→`+` → ký **HMAC-SHA512** với `VNP_HASH_SECRET`. `vnp_Amount = tiền × 100`,
  `vnp_TxnRef = orderId_timestamp`.
- Callback `/api/order/vnpay-return`: **verify chữ ký trước** (tự tính lại HMAC và so sánh),
  sai chữ ký → từ chối; `vnp_ResponseCode === '00'` → đánh dấu paid + hậu xử lý như Stripe.

**Hủy đơn (`cancelOrderService`):**
- Chỉ hủy được ở trạng thái `Order Placed` / `Packing`; user chỉ hủy đơn của chính mình.
- Trả kho nếu đang giữ (`stockReservedAt` có, `stockReleasedAt` chưa) — có cờ chống trả 2 lần.
- Trả lượt voucher (cũng có cờ `voucherUsageReleasedAt` chống lặp).
- Đơn Stripe **đã thanh toán** → tự động tạo **refund** qua Stripe API.
- Thông báo cho phía còn lại (user hủy → báo vendor, vendor/hệ thống hủy → báo user).

**Đơn đa vendor:** `order.vendors[]` — mỗi vendor có items, subtotal, `vendorStatus` riêng
(pending→confirmed→preparing→shipped→delivered/cancelled) và tracking number riêng.
Trạng thái đơn tổng được **suy ra** từ trạng thái các vendor
(`deriveOrderStatusFromVendors`: tất cả delivered → Delivered; có shipped → Shipped; ...).

#### 4.7.b. Giải thích chậm — "từ lúc bấm Đặt hàng đến lúc đơn nằm trong DB"

**Bức tranh lớn:** đặt hàng = một chuỗi **"giữ chỗ" nối tiếp**: kiểm phiếu → tra bảng giá → lấy
hàng khỏi kệ → tính tiền + xé tem giảm giá → ghi hóa đơn → dọn dẹp. Nguyên tắc xuyên suốt:
**bước nào hỏng thì phải TRẢ LẠI những gì các bước trước đã lấy** (rollback / hoàn tác).

**Bước 1 — idempotencyKey: "phiếu này xử lý rồi mà?"** Mạng chậm → user bấm nút 2-3 lần, hoặc
app tự retry → nguy cơ 3 đơn giống hệt, trừ kho 3 lần. Giải pháp: mở trang thanh toán là
frontend sinh sẵn một mã ngẫu nhiên (`checkout-a1b2...`) gửi kèm **mọi** lần bấm của phiên đó.
Server hỏi trước tiên: "đơn nào của user này mang mã này chưa?" — có rồi → **trả lại chính đơn
cũ**, không tạo gì. "Idempotency" = làm 1 lần hay 10 lần, kết quả như nhau. Giống nộp hồ sơ có
số biên nhận: nộp lại lần 2, cô văn thư đưa lại giấy hẹn cũ chứ không mở hồ sơ mới.

**Bước 2 — normalizeOrderItems: "khách tự ghi giá thì không tin".** Client chỉ gửi
`{_id, quantity, size}` — **không gửi giá**, có gửi cũng bị vứt (tham số đặt tên `_clientAmount`
= quy ước "cố tình không dùng"). Lý do: frontend chạy trên máy người dùng, ai mở DevTools cũng
sửa được request — đổi giá iPhone 30 triệu thành 1.000đ. **Never trust the client**: server cầm
mã sản phẩm tự tra DB lấy giá thật (đúng cả giá của biến thể được chọn, khớp qua `variantKey`).
Bước này còn **snapshot** tên/giá/ảnh vào đơn: tháng sau vendor đổi giá, đơn cũ vẫn hiển thị
đúng thông tin *lúc mua* — đơn lưu bản sao, không trỏ về sản phẩm gốc.

**Bước 3 — trừ kho (giữ chỗ): "lấy hàng khỏi kệ bỏ vào rổ".** Trừ kho atomic (mục 4.8). Không
đủ → 409 "hết hàng", dừng ngay — chưa lấy gì nên chưa phải hoàn gì. Trừ kho **trước** tính
tiền/tạo đơn vì hàng là tài nguyên tranh chấp: phải cầm chắc trong tay rồi mới làm bước sau,
không thì tính tiền xong quay lại hàng đã bị người khác mua mất.

**Bước 4 — tính tiền + voucher: lần rollback đầu tiên.** Tính subtotal → giảm shop → giảm sàn →
+ship 30k (miễn từ 500k) → giảm ship → `finalTotal`. Chế độ `strict`: 1 voucher không hợp lệ →
ném lỗi luôn (không âm thầm bỏ qua — tránh khách tưởng được giảm mà hóa đơn tính đủ). Nhưng kho
đã trừ ở bước 3 → nếu lỗi ở đây phải **trả hàng lại kệ** trước khi báo lỗi:
```js
try { pricingResult = await buildOrderPricingWithVouchers(...); }
catch (error) { await releaseStockByItems(normalizedItems); throw error; }
```

**Bước 5 — giữ lượt voucher: "xé tem giảm giá".** Voucher "100 lượt đầu" là tài nguyên có hạn
như kho hàng → giành lượt atomic (`claimVoucherUsage`). Người thứ 101 → thất bại → trả kho rồi
báo lỗi. Quy luật: *mỗi bước tiến thêm, danh sách "thứ phải trả nếu hỏng" dài thêm* — bước 4
hỏng trả kho; bước 6 hỏng trả kho **+ trả tem**.

**Bước 6 — ghi đơn vào DB: cú "đấu tay đôi" cuối.** Tình huống hiểm: 2 request trùng key cùng
lọt qua bước 1 (đến đồng thời, lúc kiểm tra đơn đều chưa tồn tại) → cả hai chạy tới bước 6.
**Unique index `(userId, idempotencyKey)`** trong MongoDB ra tay: request nhanh ghi được, request
chậm bị DB ném lỗi `11000` (duplicate key). Code bắt đúng lỗi đó: hoàn kho + hoàn voucher phần
của kẻ thua, rồi query **trả về đơn của kẻ thắng** — người dùng bấm 2 lần đều thấy "thành công"
với cùng 1 đơn. Bước 1 là lưới chắn nhanh; unique index là lưới chắn **tuyệt đối**.

**Bước 7 — hậu xử lý: việc "làm sau cũng được".** Cộng `sold`, xóa món vừa mua khỏi giỏ, ghi
hành vi `purchased` (fire-and-forget), tạo notification cho từng vendor → đẩy SSE → dashboard
hiện toast ngay. Để cuối vì các việc này **không được phép làm hỏng đơn** — thông báo lỗi thì
đơn vẫn phải thành công; ngược lại kho/voucher phải nằm trước vì chúng quyết định đơn có được
tồn tại hay không.

**Stripe / VNPay khác COD chỗ nào?** Giống hệt bước 1→6; khác ở chỗ online phải **chờ khách trả
tiền ở trang khác** — và khách có thể không bao giờ trả:
```
COD:    đặt → đơn hoàn tất ngay (thu tiền khi giao)
Stripe: đặt → đơn tạm → sang trang Stripe nhập thẻ → Stripe báo về 2 ĐƯỜNG:
          (a) webhook chủ động gọi server (có chữ ký chống giả trên raw body)
          (b) fallback: trang /verify của mình hỏi ngược Stripe API
        → đường nào đến trước thì đánh dấu paid (idempotent: đã paid thì thôi,
          không cộng sold 2 lần)
VNPay:  đặt → server tự XÂY URL có ký HMAC-SHA512 → sang VNPay → VNPay redirect
        khách về kèm kết quả trên URL → server TỰ TÍNH LẠI chữ ký để verify
        (chống kẻ xấu tự chế URL "thanh toán thành công")
```
Vì khách có thể bỏ ngang, đơn online chỉ giữ kho **15 phút** — quá hạn, robot sweep hủy đơn,
trả kho, trả voucher. COD không cần TTL vì đặt là chốt.

**Hủy đơn = rollback có kiểm soát:** trả kho (cờ `stockReleasedAt` chống trả 2 lần), trả lượt
voucher (cờ riêng), đơn Stripe đã trả tiền → gọi Stripe Refund API hoàn tự động, thông báo phía
bên kia.

**Câu chốt phản biện:** *"Luồng đặt hàng là chuỗi giành tài nguyên có hoàn tác: kiểm idempotency
→ lấy giá từ DB (không tin client) → trừ kho atomic → giữ lượt voucher atomic → ghi đơn với
unique index chặn trùng → hậu xử lý. Bước nào thất bại đều trả lại đúng những gì các bước trước
đã lấy — compensating transaction (Saga) — nên không bao giờ rò kho hay rò lượt voucher."*

### 4.8. CHỐNG OVERSELL — trái tim kỹ thuật của đồ án

File: `services/order/stockReservationService.js`. Tài liệu thiết kế:
`docs/concurrent-purchase-stock-plan-vi.md`.

**Bài toán:** 2 người cùng mua sản phẩm chỉ còn 1 chiếc. Cách naive
(đọc stock → kiểm tra → ghi stock mới) bị **race condition**: cả 2 cùng đọc thấy `stock=1`,
cả 2 cùng đặt thành công → bán 2 chiếc trong khi kho có 1 (oversell).

**Giải pháp: Atomic Conditional Update** — gộp "kiểm tra + trừ" vào **một lệnh MongoDB duy nhất**:

```js
// Sản phẩm thường:
productModel.updateOne(
  { _id, isActive: true, stock: { $gte: quantity } },   // điều kiện nằm TRONG filter
  { $inc: { stock: -quantity } }
);
// Nếu modifiedCount !== 1 → kho không đủ → ném lỗi 409 OUT_OF_STOCK

// Sản phẩm có biến thể: trừ ĐỒNG THỜI tổng stock + stock của đúng variant
productModel.updateOne(
  { _id, isActive: true, stock: {$gte: q},
    variants: { $elemMatch: { variantKey, stock: {$gte: q} } } },
  { $inc: { stock: -q, "variants.$[variant].stock": -q } },
  { arrayFilters: [{ "variant.variantKey": variantKey }] }
);
```

Vì MongoDB thực thi mỗi lệnh update trên 1 document một cách **nguyên tử**, chỉ đúng số request
bằng lượng tồn kho có thể "thắng"; các request còn lại filter không khớp → `modifiedCount = 0`
→ báo hết hàng. **Không cần lock, không cần transaction.**

**Các cơ chế bổ trợ:**
- `buildReservationUnits`: gom items trùng (cùng productId+variantKey) và **sort theo key** trước
  khi trừ → thứ tự trừ kho nhất quán giữa các request, giảm nguy cơ deadlock/livelock logic.
- **Rollback bậc thang**: trừ kho nhiều sản phẩm tuần tự, sản phẩm thứ N thất bại → hoàn lại toàn
  bộ N-1 sản phẩm đã trừ (mảng `reservedUnits`). Tương tự, thất bại ở bước voucher/tạo đơn/tạo
  session thanh toán → hoàn kho + hoàn voucher (mô hình **compensating transaction / Saga**).
- **TTL đặt chỗ 15 phút** (`PAYMENT_RESERVATION_TTL_MIN`): đơn Stripe/VNPay giữ kho tối đa 15
  phút; sweep 60s/lần tìm đơn quá hạn chưa thanh toán → set `Cancelled` (bằng update có điều kiện
  `stockReleasedAt: {$exists:false}` — chính nó cũng atomic để 2 vòng sweep không hoàn kho 2 lần)
  → trả kho + trả voucher. Nhờ vậy kho không bị "giam" vô hạn bởi người bỏ dở thanh toán.

**Idempotency (chống double-submit):**
- Frontend sinh `idempotencyKey = 'checkout-' + crypto.randomUUID()` cho **mỗi phiên checkout**
  (hook `usePlaceOrderCheckout`).
- Backend: kiểm tra trước (fast path) + **partial unique index** `(userId, idempotencyKey)`
  (chốt chặn cuối, chịu được race) → user bấm nút 2 lần / mạng retry → chỉ 1 đơn được tạo,
  request sau nhận lại chính đơn đó (hoặc URL thanh toán đã có).

**Chứng minh thực nghiệm:**
- `controllers/simulationController.js` (+ trang **Simulator** trong admin): reset kho về N, bắn
  M request đặt hàng **song song** (`Promise.all`), thống kê SUCCESS / OUT_OF_STOCK /
  DUPLICATE_KEY và tính `stockLeak` — kỳ vọng: đúng N đơn thành công, kho về 0, leak = 0.
- `thesis/k6_concurrency.js` + `run_load_test.sh`: load test bằng k6, in bảng số liệu đưa vào báo cáo.
- Unit test `services/tests/stockReservationService.test.js` chạy trên `mongodb-memory-server`.

#### 4.8.b. Giải thích chậm — hiểu từ gốc rễ: "một khe hở thời gian"

**Bước 1 — vì sao cách "bình thường" hỏng.** Cách 99% người mới sẽ viết:
```js
const product = await Product.findById(id);   // (1) ĐỌC kho
if (product.stock >= 1) {                     // (2) KIỂM TRA
    product.stock -= 1;
    await product.save();                     // (3) GHI kho mới
}
```
Giữa bước (1) và (3) có một **khe hở thời gian** (vài mili-giây). Server xử lý nhiều request đan
xen, nên:
```
        Request A (chị Lan)          Request B (anh Minh)
t1   đọc kho → thấy còn 1
t2                                đọc kho → thấy còn 1   ← cả 2 đọc TRƯỚC khi ai kịp ghi
t3   "1 ≥ 1, OK!" → ghi kho = 0
t4                                "1 ≥ 1, OK!" → ghi kho = 0
KẾT QUẢ: 2 đơn thành công, kho có 1 chiếc → OVERSELL
```
Cả hai đều "đúng quy trình", nhưng **quyết định của B dựa trên thông tin đã cũ** — kiểm tra lúc
kho còn 1, ghi lúc thực tế đã là 0. Đó là **race condition**: kết quả phụ thuộc ai nhanh chậm
vài mili-giây. Ví đời thường: 2 nhân viên cùng nhìn *bảng kho treo tường* ghi "còn 1", cả hai
cùng gật đầu bán, rồi cùng sửa bảng thành 0 — cửa hàng bán 2 chiếc trong khi kệ có 1.

**Bước 2 — kẻ thù thật sự là CÁI KHE HỞ.** Phép kiểm tra đúng, phép trừ đúng — vấn đề là chúng
**tách rời**, và ở giữa người khác kịp chen vào. Giải pháp triệt để duy nhất: làm "kiểm tra" và
"trừ" **dính liền thành một khối không thể chen ngang** = nghĩa của chữ **atomic** (nguyên tử =
không thể chia cắt).

**Bước 3 — nhét điều kiện VÀO TRONG lệnh trừ.**
```js
const result = await productModel.updateOne(
    { _id: productId, stock: { $gte: quantity } },  // điều kiện nằm TRONG filter
    { $inc: { stock: -quantity } }                  // trừ
);
if (result.modifiedCount !== 1) → báo 409 hết hàng
```
Đọc bằng tiếng người: *"MongoDB ơi, TÌM sản phẩm này VỚI ĐIỀU KIỆN kho ≥ số cần mua, NẾU THẤY
thì trừ luôn trong cùng một nhát."* Khác biệt chí mạng: server Node **không còn tự đọc–tự
quyết–tự ghi** nữa; trọn gói kiểm-và-trừ giao cho MongoDB, và MongoDB bảo đảm **mọi lệnh ghi
trên một document là nguyên tử** — hai lệnh ghi cùng document bị xếp hàng chạy lần lượt:
```
        Request A                            Request B
t1   updateOne({stock≥1}, trừ 1) → thấy (1≥1) → trừ → kho=0 → modifiedCount=1 ✓
t2                                     updateOne({stock≥1}, trừ 1)
                                       → TÌM KHÔNG THẤY (kho=0) → modifiedCount=0 ✗ → 409
```
**Khe hở biến mất** vì không còn hai thao tác tách rời. Hệ quả đẹp: điều kiện `$gte` khiến kho
**không bao giờ âm được theo cấu trúc**. `modifiedCount` là "tờ biên nhận của thủ kho": 1 = "đã
trừ cho anh", 0 = "hết hàng, tôi không trừ gì". Ví: thay vì để nhân viên tự nhìn bảng rồi tự
sửa, thuê **một thủ kho duy nhất** — mọi người xếp hàng đưa yêu cầu "nếu còn ≥1 thì lấy giúp 1",
thủ kho xử lý từng người, nhìn-kệ-và-lấy-hàng trong một động tác.

**Bước 4 — biến thể: trừ 2 con số trong 1 nhát.** Sản phẩm có SKU lưu 2 tầng kho **trong cùng 1
document**: `stock` tổng + `variants[i].stock`. Mua "Đen-M" phải trừ cả hai → một lệnh updateOne
điều kiện kép (`$elemMatch` cả tổng lẫn đúng variant còn đủ) trừ đồng thời cả hai qua
`arrayFilters`. Vẫn 1 lệnh / 1 document → vẫn nguyên tử → không bao giờ "tổng trừ được mà biến
thể không" (lệch sổ 2 tầng kho).

**Bước 5 — đơn nhiều sản phẩm: rollback bậc thang + sort.** Atomic chỉ bảo vệ từng sản phẩm;
đơn 3 món trừ tuần tự A→B→C nảy sinh 2 vấn đề:
- *Trừ được A, B rồi C hết?* → mảng `reservedUnits` ghi lại đã trừ gì, lỗi ở C → **hoàn A, B**
  rồi mới báo lỗi (rollback bậc thang, tinh thần Saga của 4.7).
- *Vì sao sort trước khi trừ?* Đơn 1 trừ (X,Y), đơn 2 trừ (Y,X) chạy đồng thời, mỗi bên giành
  được món đầu → đơn 1 cầm X thiếu Y, đơn 2 cầm Y thiếu X → **cả hai fail, cả hai rollback,
  không ai mua được dù kho đủ cho một người**. Sort theo key → mọi request trừ **cùng thứ tự**
  → tranh chấp phân định dứt điểm ở món chung đầu tiên, người thắng đi trọn vẹn.

**Câu hỏi hay gặp: "gom items trùng" xảy ra khi nào — phải nhiều người mua cùng thời điểm à?**
— Không. Gom trùng xảy ra **bên trong MỘT request đặt hàng**, là bước tiền xử lý mảng items của
chính đơn đó (không dính gì đến người khác hay thời điểm). Một đơn có thể chứa 2 dòng trỏ về
cùng sản phẩm + cùng biến thể vì: (a) giỏ có 2 dòng thực chất là một — một dòng ghi
`selectedAttributes`, một dòng cũ ghi chuỗi `size`, khi chuẩn hóa về `variantKey` (sort thuộc
tính + nối chuỗi) cả hai ra cùng key; (b) bug client / luồng mua-ngay ghép với giỏ; (c) request
bị chế tác — *never trust the client*, server phải tự phòng thủ.

*Vì sao phải gộp?* Kho còn 1, đơn có 2 dòng trùng (mỗi dòng 1 chiếc): không gộp → trừ lần 1
thành công, lần 2 fail → phải rollback lần 1 (3 lệnh DB, kho về 0 "ảo" trong chốc lát có thể từ
chối oan người khác). Có gộp → 1 lệnh `{stock ≥ 2}` → fail ngay, không trừ gì, không hoàn gì,
báo lỗi chuẩn "cần 2, còn 1". Tức: mỗi SKU đúng 1 lệnh atomic kiểm *tổng nhu cầu thật*.

*Phân biệt với sort:* gom trùng phục vụ **nội bộ 1 đơn**; sort phục vụ **giữa nhiều đơn chạy
đồng thời** — ai cũng tự sort mảng của mình theo cùng quy tắc (alphabet), không cần phối hợp
hay biết về nhau, nhưng nhờ đó khi 2 đơn đụng nhau thì chạm món chung ở cùng vị trí → người
thắng đi trọn vẹn, người thua fail sớm, không xảy ra giành chéo cả hai cùng chết.

**Bước 6 — "sao không dùng lock / transaction?"**
- Lock: phải nhớ nhả khóa, quên là kẹt hệ thống; lock phân tán cần thêm hạ tầng. Atomic update
  **chính là lock rồi** — Mongo tự khóa document trong đúng 1 lệnh, tự nhả, không thể quên.
- Transaction: cần replica set, giữ khóa suốt cả chuỗi (lâu hơn nhiều so với 1 lệnh) → tải cao
  là nghẽn. Bất biến cần bảo vệ ("kho không âm", "voucher không quá lượt") nằm gọn trong 1
  document → atomic đơn lẻ đủ; phần liên-document có compensating rollback lo.

**Bước 7 — không tin lời nói, tin con số.** Bắn N request song song vào kho S, hệ đúng khi:
```
SUCCESS      = min(N, S)      (kho 20, bắn 100 → đúng 20 đơn)
OUT_OF_STOCK = N − min(N, S)  (80 còn lại bị từ chối sạch sẽ)
kho cuối     = S − SUCCESS    (về đúng 0)
stockLeak    = 0              (không rò một đơn vị nào)
```
3 lớp chứng minh: trang Simulator (demo sống buổi bảo vệ), k6 load test (số liệu vào báo cáo),
unit test trên mongodb-memory-server.

**Câu chốt phản biện:** *"Oversell sinh ra từ khe hở giữa lúc kiểm tra kho và lúc trừ kho. Em
xóa khe hở bằng cách nhét điều kiện vào trong chính lệnh trừ — MongoDB thực thi nguyên tử trên
document nên kiểm-và-trừ là một khối không thể chen ngang; modifiedCount cho biết thắng thua.
Kho không bao giờ âm theo cấu trúc, và em chứng minh thực nghiệm: 100 request vào kho 20 → đúng
20 đơn, kho về 0, leak = 0."*

### 4.9. Voucher — `services/voucherService.js` + `voucherManagementService.js`

**3 loại, quy tắc xếp chồng rõ ràng:**
- `SHOP` (vendor tạo): tính trên **subtotal của riêng shop đó**; mỗi shop tối đa 1 voucher/đơn.
- `PLATFORM` (sàn): tính trên phần còn lại sau giảm shop; tối đa 1/đơn.
- `SHIPPING`: giảm phí vận chuyển, không vượt quá phí ship; tối đa 1/đơn.

Mỗi voucher: `PERCENT` (có `maxDiscount` trần) hoặc `FIXED`; điều kiện `minOrderValue`,
khung thời gian `startAt–endAt`, `usageLimit/usedCount`, `isActive`.

**Thứ tự tính tiền** (`computeOrderPricing`):
```
subtotal → trừ giảm SHOP (theo từng shop) → trừ giảm PLATFORM
        → + phí ship (30k, miễn từ 500k) → trừ giảm SHIPPING (≤ phí ship)
        → finalTotal (chặn không âm)
```
Voucher không đạt điều kiện được trả về trong `rejectedVouchers` kèm **lý do cụ thể**;
khi đặt hàng thật (`strict: true`) thì có voucher rớt → chặn luôn, tránh user hiểu nhầm giá.

**Giữ lượt voucher atomic** (`claimVoucherUsage`) — cùng pattern với trừ kho:
```js
voucherModel.updateOne(
  { _id, $or: [ {usageLimit: {$lte:0}},                    // không giới hạn
                {$expr: {$lt: ['$usedCount','$usageLimit']}} ] },  // còn lượt
  { $inc: { usedCount: 1 } }
);
```
→ voucher "100 lượt đầu tiên" không bao giờ bị dùng lượt thứ 101 dù ngàn người bấm cùng lúc.
Đơn bị hủy/hết hạn → `releaseVoucherUsage` trả lượt (có guard `usedCount > 0`).

Checkout còn có API **gợi ý voucher** (`listCheckoutVoucherSuggestionsService`): liệt kê voucher
đang hiệu lực áp được cho giỏ hiện tại, ước tính số tiền giảm, sort giảm nhiều nhất trước.

### 4.10. Đánh giá sản phẩm — `services/reviewService.js`

- **Chỉ được đánh giá khi**: đơn thuộc về mình + trạng thái `Delivered` + sản phẩm nằm trong đơn
  + chưa từng đánh giá (unique index 3 trường làm lưới an toàn cuối). → đây là "verified purchase
  review", chống review ảo.
- Tối đa 5 ảnh/review (upload R2). Cho sửa/xóa review của chính mình.
- Sau mỗi thay đổi → chạy **aggregation** tính lại `rating` trung bình (làm tròn 1 chữ số) và
  `reviewCount`, **denormalize** vào document product → trang danh sách không phải join/aggregate
  mỗi lần đọc (đánh đổi: ghi thêm 1 lần, đọc nhanh hơn nhiều — read-heavy workload).

### 4.11. Trả hàng / hoàn tiền — `services/returnService.js`

- Điều kiện: đơn `Delivered`, trong **cửa sổ 7 ngày** (env `RETURN_WINDOW_DAYS`), lý do thuộc
  enum (damaged, not_as_described, wrong_item, changed_mind, other), 1 yêu cầu/đơn.
- Vendor duyệt: approve → user gửi hàng → refund. Đơn Stripe → gọi **Stripe Refund API** tự động;
  thất bại/không phải Stripe → đánh dấu `isManualRefund` (hoàn tay). Hoàn tiền xong → **trả kho**.
- Mỗi bước đều bắn notification cho phía liên quan (return_approved / return_rejected / return_refunded).

### 4.12. Gợi ý sản phẩm (Recommendation) — `services/interactionService.js`

**Bước 1 — Thu thập hành vi** (`userInteractionModel`): mỗi cặp (user, product) là 1 document
tích lũy các hành vi với **trọng số**:

| Hành vi | Trọng số | Loại |
|---|---|---|
| purchased | 10 | explicit, mạnh nhất |
| reviewed | 8 | explicit |
| wishlisted | 6 | implicit mạnh |
| addedToCart | 5 | implicit |
| rated | 2/sao | explicit |
| searched | 2 | yếu |
| viewed / clicked | 1 | yếu |
| timeSpent | 0.01/giây | yếu |

`interactionScore = Σ(hành_vi × trọng_số) × e^(−số_ngày/30)` — **time decay** hàm mũ, chu kỳ 30
ngày: hành vi cũ mất dần ảnh hưởng → gợi ý phản ánh sở thích *hiện tại*.

**Bước 2 — Sinh gợi ý** (`getRecommendationsService`) — **lai (hybrid) 2 thuật toán + fallback**:

1. **Collaborative Filtering (user-based, cosine similarity)** — "người giống bạn đã mua gì":
   - Lấy top-5 sản phẩm điểm cao nhất của user → tìm (aggregate) tối đa 50 user khác từng tương
     tác cùng các sản phẩm đó.
   - Tính **cosine similarity** giữa vector điểm của user hiện tại và từng ứng viên
     (vector thưa `{productId: score}`).
   - Lấy top-20 user giống nhất → gom sản phẩm họ thích mà mình chưa xem, **điểm sản phẩm =
     Σ(score × similarity của người giới thiệu)** → xếp hạng.
2. **Content-based** — "giống món bạn đã thích": lấy category/brand/tags của top-5 sản phẩm đã
   tương tác → tìm sản phẩm cùng đặc trưng (loại trừ đã xem), sort theo sold + rating.
3. **Trộn**: một nửa CF + content-based bù, khử trùng lặp; vẫn thiếu → **fallback** sản phẩm bán
   chạy toàn sàn (giải quyết **cold start** cho user mới).

**Caching:** kết quả cache Redis **5 phút**; chỉ hành vi mạnh (mua, thêm giỏ, wishlist, đánh giá)
mới **invalidate cache** — hành vi yếu (xem, click) đổi điểm không đáng kể, invalidate liên tục
sẽ thrash cache khi user đang lướt (có comment giải thích ngay trong code).

**Wishlist** cũng nằm ở đây: flag `interactions.wishlisted` — tận dụng luôn làm tín hiệu gợi ý.

#### 4.12.b. Giải thích chậm — "làm sao máy đoán được bạn thích gì?"

**Ý tưởng gốc: hành động nói thật hơn lời nói.** Không ai điền form "sở thích của tôi", nhưng
hành vi không nói dối: *mua* là bằng chứng thích mạnh hơn nhiều so với *lướt qua*. Bước 1: quy
đổi mỗi hành vi thành điểm, nặng nhẹ khác nhau (mua 10, review 8, wishlist 6, thêm giỏ 5, tìm
kiếm 2, xem/click 1, thời gian xem 0.01/giây). Mỗi cặp **(user, sản phẩm)** là MỘT document
cộng dồn (xem 3 lần → `viewed: 3`) — không lưu từng sự kiện riêng vì một buổi lướt tạo hàng
trăm sự kiện, lưu hết thì DB phình vô hạn.

**Time decay — "gu 3 tháng trước không còn là bạn hôm nay".** Điểm bị nhân `e^(-số_ngày/30)`:
sản phẩm 100 điểm → sau 30 ngày còn ~37, sau 60 ngày ~13, sau 90 ngày ~5 (gần như quên). Nhờ
vậy gợi ý phản ánh sở thích *hiện tại* — tháng trước săn điện thoại, tháng này chuyển đồ bếp thì
gợi ý dịch chuyển theo.

**Hai "cỗ máy đoán" chạy song song:**
- *Máy 1 — Content-based: "giống món bạn đã thích".* Như người bán hàng quen mặt: "anh này hay
  mua áo Nike → đưa thêm đồ thể thao Nike ra". Lấy 5 sản phẩm điểm cao nhất của bạn → rút
  danh mục/thương hiệu/tags → tìm sản phẩm cùng đặc điểm (loại cái đã xem). Ưu: an toàn, luôn
  trúng gu bề mặt. Nhược: **quanh quẩn**, không bao giờ gây bất ngờ.
- *Máy 2 — Collaborative Filtering: "người GIỐNG bạn đã mua gì".* Như hỏi đứa bạn cùng gu:
  "tao với mày thích phim giống nhau — mày xem gì hay giới thiệu tao". Máy không cần hiểu sản
  phẩm, chỉ cần tìm người có lịch sử giống bạn rồi lấy đồ họ thích mà bạn chưa xem.

**Cosine similarity — đo "độ giống nhau" bằng con số.** Hình dung mỗi người là một bảng chấm
điểm sản phẩm:
```
            SP-A    SP-B    SP-C
Bạn         50      10      0
Anh Tú      45      12      0      ← chấm gần như cùng kiểu → similarity ≈ 0.99
Chị Hà      0       2       90     ← kiểu hoàn toàn khác   → similarity ≈ 0.05
```
Cosine trả về 0→1, đo hai bảng điểm có "cùng hướng" không — đo **hướng gu chứ không đo cường
độ**, nên người tương tác ít nhưng cùng kiểu phân bố vẫn được nhận là cùng gu. Sau đó mỗi sản
phẩm ứng viên chấm: `điểm = Σ (điểm của người kia × độ giống của họ)` — **lời giới thiệu của
người càng giống bạn càng có trọng lượng** (ý kiến Anh Tú 0.99 nặng gấp ~20 lần Chị Hà 0.05).

**Ghép lại — hybrid + phao cứu sinh:**
```
Kết quả = 1/2 từ CF + content-based bù (khử trùng lặp)
        → vẫn thiếu? → FALLBACK: top bán chạy toàn sàn
```
Fallback giải quyết **cold start**: user mới chưa có hành vi → cả 2 máy đều câm → ít nhất thấy
hàng hot thay vì trang trống; dùng dần thì 2 máy chính chiếm chỗ.

**Chi tiết ăn điểm — chiến lược cache:** kết quả cache Redis 5 phút, nhưng chỉ hành vi MẠNH
(mua/thêm giỏ/wishlist/review) mới xóa cache tính lại; hành vi yếu (xem/click) thì kệ. Vì user
đang lướt tạo hàng chục lượt "xem" mỗi phút, mỗi lượt +1 điểm gợi ý gần như không đổi — lượt nào
cũng xóa cache thì cache vô dụng (vừa ghi đã xóa = **cache thrashing**).

### 4.13. Tìm kiếm — `services/searchService.js`

**Chiến lược kép:**
1. **MongoDB `$text` search** trên text index có trọng số (name×10, brand×5, tags×3) — nhanh,
   có điểm `textScore`.
2. **Regex fallback**: bắt partial match và **tiếng Việt không dấu** — chuẩn hóa NFD, bỏ dấu
  thanh, đổi `đ→d` (hàm `normalizeText`), escape regex chống ReDoS/injection. Tìm cả theo
  name/brand/tên shop, loại các kết quả $text đã có.

**Xếp hạng "liên quan" bằng công thức 4 thành phần** (mỗi thành phần chuẩn hóa về [0,1]):

```
finalScore = 0.4×textScore + 0.3×(sold/maxSold) + 0.2×(rating/5) + 0.1×điểm_cá_nhân_hóa
```
Điểm cá nhân hóa lấy từ `interactionScore` của user với từng sản phẩm (nếu đã đăng nhập) —
tức **kết quả tìm kiếm cũng được cá nhân hóa**.

Kèm theo: lọc category (cả 3 tầng)/khoảng giá, 4 kiểu sort khác, phân trang, **autocomplete**
($text + regex prefix, giới hạn 10), **trending search** (mỗi query được đếm vào
`searchAnalyticsModel` — fire-and-forget không chặn response).

#### 4.13.b. Giải thích chậm — "gõ 'ao thun' phải ra 'Áo thun'"

**Vấn đề 1 — tìm nhanh trong hàng nghìn sản phẩm → text index.** Cách ngây thơ: mỗi lần tìm lôi
toàn bộ sản phẩm ra so tên từng cái — chậm dần theo độ lớn DB. Text index của MongoDB giống
**trang "Chỉ mục" cuối sách giáo khoa**: ai đó đã liệt kê sẵn "từ 'thun' xuất hiện ở sản phẩm
12, 87, 145..." → tra phát ra ngay, không lật từng trang. Index còn có **trọng số theo trường**:
khớp trong `name` ×10, `brand` ×5, `tags` ×3 — sản phẩm tên "Áo thun nam" đứng trên sản phẩm
chỉ có tag "áo thun". Điểm khớp = `textScore`.

**Vấn đề 2 — tiếng Việt không dấu + gõ dở chừng → regex fallback.** Text index có 2 điểm mù:
người Việt hay gõ không dấu ("ao thun") và gõ dở chừng ("thu"). Nên chạy thêm lượt tìm thứ hai
bằng regex trên **bản đã bỏ dấu**:
```
"Áo thun" → tách dấu khỏi chữ (Unicode NFD: "Á" = "A" + dấu sắc)
          → vứt phần dấu → "Ao thun"
          → riêng đ không tách được kiểu đó → thay tay đ→d
          → "ao thun" ✓ khớp từ khóa người dùng gõ
```
Regex còn quét brand + tên shop, chỉ bổ sung kết quả text index chưa có. Chi tiết bảo mật: từ
khóa được **escape ký tự đặc biệt** trước khi nhét vào regex — không thì kẻ xấu gõ chuỗi regex
độc hại làm treo server (ReDoS).

**Vấn đề 3 — tìm THẤY rồi, xếp ai trước ai sau? → công thức 4 thành phần.** Khớp từ khóa tốt
chưa chắc đáng mua (tên khớp 100% nhưng 0 lượt bán, rating 0 — có nên đứng đầu?). Điểm cuối:
```
điểmCuối = 0.4 × độ khớp từ khóa      ← đúng thứ người ta tìm (quan trọng nhất)
         + 0.3 × độ phổ biến (sold)   ← nhiều người mua = đáng tin
         + 0.2 × chất lượng (rating)
         + 0.1 × cá nhân hóa          ← BẠN từng quan tâm sản phẩm này chưa?
```
**Vì sao phải chuẩn hóa về [0,1] trước khi cộng?** 4 thứ khác đơn vị hoàn toàn: sold có thể
5.000, rating tối đa 5, textScore vài chục — cộng thô thì sold nuốt chửng tất cả. Nên mỗi thành
phần chia cho giá trị lớn nhất trong tập kết quả (sold/maxSold, rating/5...) để cùng nằm trên
thang 0→1, rồi trọng số mới quyết định tầm quan trọng tương đối.

Thành phần thứ 4 đáng nói nhất: lấy từ **chính bảng điểm tương tác của hệ gợi ý (4.12)** —
nghĩa là **hai người gõ cùng một từ khóa nhận kết quả xếp hạng khác nhau**; sản phẩm bạn từng
xem/thêm giỏ được đẩy nhẹ lên. Tìm kiếm và gợi ý dùng chung một nguồn dữ liệu hành vi. (Chọn
sort giá/mới nhất... thì bỏ công thức, sort thẳng — công thức chỉ cho chế độ "Liên quan".)

**Hai tính năng phụ:** *Autocomplete* — text index + regex prefix chạy song song, gộp khử
trùng, ~10 kết quả, chỉ lấy vài trường nên nhẹ. *Trending* — mỗi lượt tìm đếm +1 vào
`searchAnalytics` (từ khóa đã bỏ dấu để "áo thun"/"ao thun" đếm chung), ghi kiểu
fire-and-forget: thất bại cũng kệ, tuyệt đối không làm chậm kết quả trả cho người dùng.

### 4.14. Thông báo realtime (SSE) + báo giảm giá + Telegram

**SSE** (`services/notificationService.js`): giữ map `userId → Map<clientId, {res, audience}>`
trong RAM. `createNotification` = lưu DB + đẩy ngay `data: {...}\n\n` tới các kết nối đang mở của
đúng user, **lọc theo audience** (`user` cho shop, `vendor` cho dashboard — 1 tài khoản vendor mở
cả 2 web sẽ nhận đúng thông báo ở đúng nơi). Client dùng `EventSource` với `withCredentials`
(cookie xác thực), tự reconnect. Có sẵn bộ **sửa lỗi mojibake** (text tiếng Việt hỏng encoding
latin1→utf8) và sinh lại nội dung fallback theo loại thông báo — vá dữ liệu cũ ngay lúc đọc.

**Báo giảm giá** (`priceDropNotificationService`): user bật "theo dõi giá" trên trang sản phẩm
(`productPriceAlertModel`). Vendor giảm giá → notify tất cả subscriber qua 3 kênh: notification
in-app (SSE), **email** (tôn trọng tùy chọn `notificationPrefs.emailPriceDrop` của user), và
**Telegram bot** (nếu user có `telegramChatId`). Có **dedup 24h** — không spam cùng 1 sản phẩm.

### 4.15. Chat realtime — Socket.IO + REST hybrid

Thiết kế: **ghi qua REST, đẩy qua socket** — đơn giản và tin cậy:
1. Gửi tin: POST `/api/chat/:id/messages` → lưu DB (message + cập nhật lastMessage, tăng
   unread của phía kia) → server `io.to(conversationId).emit('new_message', ...)`.
2. Nhận tin: các client trong room nhận qua socket, cập nhật UI ngay.
3. Mở cuộc hội thoại: GET messages → đồng thời reset unread + đánh dấu đã đọc.

Bảo mật: socket handshake phải có access token hợp lệ; `join_room` verify là thành viên;
mọi API chat đều `ensureMember` (403 nếu không phải buyer/vendor của cuộc hội thoại).
Chat hỗ trợ **đính kèm sản phẩm** (`productId` trong message — gửi card sản phẩm khi tư vấn).
`initConversation` dùng upsert với unique index `(buyerId, vendorId)` → không bao giờ có 2 cuộc
hội thoại trùng cặp.

### 4.16. Ảnh: Cloudflare R2 + sharp + image proxy

- **Upload** (`utils/r2Upload.js`): validate ảnh (cạnh ngắn ≥ 500px) → **sharp** convert
  **WebP** 2 phiên bản: `main` (max 1400px, q82) + `thumb` (480px, q76) → PUT lên R2 (S3 API)
  → trả `{main, thumb, width, height, format}`. Danh sách thấy thumb nhẹ, trang chi tiết thấy main.
- **Image proxy** (`/api/image-proxy`): sản phẩm seed dùng ảnh CDN ngoài (Pexels, DummyJSON...)
  hay chặn hotlink → backend fetch hộ. Có **allowlist hostname** (`utils/imageProxyAllowlist.js`)
  chặn localhost và mọi domain lạ → **chống SSRF** (không cho kẻ xấu mượn server gọi vào mạng nội bộ).

### 4.17. Địa chỉ & địa giới Việt Nam

- `locationService`: lấy tỉnh/thành + phường/xã từ API công khai `provinces.open-api.vn`,
  **cache RAM 6 giờ**, có **fallback file offline** `data/vn-locations.json` khi API ngoài chết
  (demo không phụ thuộc mạng ngoài).
- `addressService`: CRUD sổ địa chỉ, đặt địa chỉ mặc định; checkout chọn từ sổ hoặc nhập tay.

### 4.18. Thống kê vendor — `order/orderAnalyticsService.js`

Doanh thu hôm nay/7 ngày/tháng, biểu đồ 30 ngày + 12 tháng, top sản phẩm, đếm đơn theo trạng
thái — chỉ tính phần items thuộc vendor đó trong các đơn đa vendor. Kết quả **cache Redis 60s**
(dashboard hay bị F5 liên tục; số liệu thống kê chịu được trễ 1 phút).

### 4.19. Kiểm thử

- **Unit tests** (Jest + `mongodb-memory-server` — MongoDB thật chạy trong RAM, không cần
  service ngoài): `stockReservationService.test.js` (trừ/hoàn kho, tranh chấp),
  `voucherService.test.js` (tính giảm giá, claim/release), `interactionService.test.js`.
  Chạy: `cd backend && npm test`.
- **Load test k6** (`thesis/k6_concurrency.js`): gọi API simulation với N request song song,
  threshold `p95 < 3s`, đo oversell rate (kỳ vọng = 0).
- **Trang Simulator** trong admin: demo trực quan ngay trong buổi bảo vệ.

---

## 5. FRONTEND — WEBSITE MUA SẮM (`frontend/`)

**Công nghệ:** React 19, Vite, React Router, TailwindCSS, axios, react-toastify, Socket.IO client.

### 5.1. State toàn cục — `context/ShopContext.jsx`

Một Context Provider bao toàn app, cung cấp: danh sách sản phẩm, danh mục, giỏ hàng
(+ optimistic update), token/userId/userRole/profile, thông báo (hook `useNotifications` — SSE),
gợi ý (hook `useRecommendations`), điều hướng. Logic tách nhỏ vào `context/shop/*`
(cartUtils, authUtils, useAuthBootstrap...) cho dễ đọc.

### 5.2. Phiên đăng nhập phía client

- Access token giữ **trong bộ nhớ JS** (state), KHÔNG lưu localStorage → giảm bề mặt XSS.
- Refresh token nằm trong **cookie HttpOnly** — JS không đụng được.
- Khi mở app (`useAuthBootstrap`): gọi `POST /api/user/refresh` (gửi cookie tự động)
  → nhận access token mới → **tự đăng nhập lại (silent refresh)**, không bắt user gõ lại mật khẩu.
- `configureAuthSession` gắn axios interceptor: request 401 → thử refresh → retry.

### 5.3. Các trang chính (`App.jsx` — ~22 routes)

| Nhóm | Trang | Chức năng |
|---|---|---|
| Main | Home | Hero, danh mục, bán chạy, hàng mới, **khối gợi ý cá nhân hóa** |
| | Collection | Danh sách + lọc danh mục/giá + sort + tìm kiếm |
| | Product | Chi tiết: chọn biến thể, ảnh, review (phân trang, lọc sao), sản phẩm liên quan, wishlist, theo dõi giá, chat với shop; tracking viewed/timeSpent |
| | VendorShop | Trang gian hàng công khai của 1 vendor + nút theo dõi shop |
| | RecommendationsPage | Trang gợi ý đầy đủ |
| Shop | Cart | Giỏ (chọn item để thanh toán), sửa số lượng |
| | PlaceOrder | Checkout: sổ địa chỉ/nhập tay (tỉnh/phường load từ API), chọn COD/Stripe/VNPay, áp voucher theo shop + sàn + ship, preview giá từ server |
| | Orders | Lịch sử đơn, trạng thái theo vendor, hủy đơn, yêu cầu trả hàng, đánh giá |
| | Verify | Trang đích sau thanh toán online — xác nhận kết quả với backend |
| Auth | Login (đăng nhập/đăng ký + OTP + Google), ForgotPassword, ResetPassword, VendorRegis |
| Profile | Thông tin cá nhân, sổ địa chỉ, đổi mật khẩu, thông báo + cài đặt, voucher, wishlist, chat |

### 5.4. Hook checkout — `hooks/usePlaceOrderCheckout.js`

Xương sống trang đặt hàng: quản lý form địa chỉ + tỉnh/phường, voucher theo từng shop,
gọi `/api/order/preview` để **server tính giá** (client chỉ hiển thị), sinh
**idempotencyKey mỗi phiên checkout**, submit theo phương thức đã chọn, xử lý redirect
Stripe/VNPay. Có kiểm tra giới hạn Stripe (999tr) và VNPay (1 tỷ) ngay phía client để báo sớm.

---

## 6. ADMIN — DASHBOARD NGƯỜI BÁN (`admin/`)

- **Cổng vào** (`App.jsx`): khởi động gọi `/api/user/refresh` khôi phục phiên → component
  `VendorValidator` kiểm tra `role==='vendor'` (không phải vendor → chặn, gợi ý đăng ký).
- **SSE realtime**: mở `EventSource /api/notification/stream?audience=vendor` → đơn hàng
  mới/đơn hủy hiện **toast + badge ngay lập tức** không cần F5.
- **Các trang:**
  - `Stats` — dashboard doanh thu (hôm nay/7 ngày/tháng), biểu đồ 30 ngày & 12 tháng, top sản phẩm.
  - `Add` — thêm sản phẩm: 4 ảnh, danh mục 3 cấp, `AttributesManager` (định nghĩa thuộc tính) +
    `VariantsManager` (sinh tổ hợp SKU, nhập giá/kho từng SKU).
  - `List` — quản lý sản phẩm: sửa, ẩn/hiện (soft delete), xóa.
  - `Orders` — đơn hàng của shop (lọc trạng thái, phân trang), cập nhật `vendorStatus` +
    tracking number.
  - `Vouchers` — CRUD voucher SHOP của mình.
  - `Chat` — hộp thư trả lời khách (Socket.IO, đồng bộ cơ chế với frontend).
  - `Simulator` — **công cụ demo chống oversell**: chọn sản phẩm, đặt kho ban đầu, số request
    song song, chế độ idempotency key (unique/duplicate) → xem bảng kết quả SUCCESS /
    OUT_OF_STOCK / DUPLICATE_KEY và kiểm chứng `stockLeak = 0`.

---

## 7. HẠ TẦNG & TRIỂN KHAI

- **Docker** (`docker/`): 2 compose file — production (build image, frontend/admin build tĩnh
  chạy Nginx) và dev (mount code, nodemon + Vite HMR). MongoDB dùng Atlas (service mongo trong
  compose được comment sẵn, bật lại nếu muốn chạy local).
- **Cloudflare**: Pages host frontend/admin (CORS backend tự nhận domain `*.pages.dev`),
  R2 lưu ảnh, Tunnel (`cloudflared`) expose backend local ra internet để demo/nhận webhook.
- **Env quan trọng**: `JWT_SECRET`, `MONGODB_URI`, `REDIS_URL`, `STRIPE_SECRET_KEY` +
  `STRIPE_WEBHOOK_SECRET`, `VNP_TMN_CODE/HASH_SECRET/URL/RETURN_URL`, `R2_*`,
  `MAIL_USER/MAIL_APP_PASSWORD`, `GOOGLE_CLIENT_ID`, các ngưỡng `AUTH_RL_*`,
  `PAYMENT_RESERVATION_TTL_MIN`, `FREE_SHIPPING_THRESHOLD`.
- **Khả năng chịu lỗi có chủ đích**: Redis chết → auth session + rate-limit + cache đều có
  fallback in-memory, hệ thống vẫn chạy (chỉ mất tính phân tán). API địa giới chết → dùng file
  offline. Webhook Stripe không tới → verify chủ động qua API.

---

## 8. CÁC ĐIỂM NHẤN KỸ THUẬT KHI PHẢN BIỆN

Nên chủ động trình bày 5 điểm này (theo thứ tự "đắt" nhất):

1. **Chống oversell bằng atomic conditional update + saga rollback + TTL reservation**
   — có unit test, có trang Simulator demo sống, có k6 load test số liệu. (Mục 4.8)
2. **Idempotency chống đơn trùng** bằng client-generated key + partial unique index — xử lý cả
   race giữa 2 request trùng key (bắt lỗi 11000 → trả đơn của request thắng). (Mục 4.8)
3. **Auth hybrid JWT + Redis session**: access ngắn hạn, refresh rotation phát hiện token bị
   đánh cắp, logout thu hồi thật, cookie HttpOnly, rate-limit 2 chiều IP+email. (Mục 4.3–4.4)
4. **Recommendation hybrid**: trọng số hành vi + time decay + cosine similarity CF +
   content-based + fallback cold-start + chiến lược cache invalidation chọn lọc. (Mục 4.12)
5. **Thanh toán 3 phương thức** với verify 2 lớp (webhook chữ ký + polling chủ động),
   refund tự động khi hủy/trả hàng, VNPay tự ký HMAC-SHA512 đúng spec. (Mục 4.7)

Các quyết định "đánh đổi" nên nói được lý do:
- **Denormalize** (rating/reviewCount/sold trong product, vendorShopName trong order/item):
  ưu tiên tốc độ đọc vì hệ đọc nhiều hơn ghi; order còn cố tình **snapshot** giá/tên tại thời
  điểm mua (giá đổi sau này không làm sai lịch sử đơn).
- **Giỏ hàng nhúng trong user** thay vì collection riêng: giỏ nhỏ, luôn đọc cùng user, 1 query.
- **SSE cho notification, Socket.IO cho chat**: chọn công cụ đúng nhu cầu 1 chiều/2 chiều.
- **Không dùng MongoDB transaction** cho luồng đặt hàng: transaction đòi replica set và giữ
  lock lâu hơn; pattern atomic update từng document + compensating rollback đủ đảm bảo bất biến
  quan trọng nhất (không âm kho, không quá lượt voucher) và scale tốt hơn với đơn nhiều sản phẩm.

---

## 9. CÂU HỎI PHẢN BIỆN DỰ KIẾN & GỢI Ý TRẢ LỜI

**Q: Hai người cùng mua sản phẩm cuối cùng thì sao?**
A: Cả hai request cùng chạy `updateOne({_id, stock:{$gte:1}}, {$inc:{stock:-1}})`. MongoDB thực
thi nguyên tử trên document → chỉ 1 request khớp filter và trừ được kho; request kia
`modifiedCount=0` → trả 409 "hết hàng". Đã chứng minh bằng Simulator/k6: bắn 100 request vào kho
20 → đúng 20 đơn thành công, kho về 0, không leak.

**Q: Sao không dùng transaction?**
A: Bất biến cần bảo vệ (kho không âm, voucher không quá lượt) đều nằm gọn trong 1 document →
atomic update đơn lẻ là đủ và rẻ hơn. Các bước liên document (kho → voucher → tạo đơn) dùng
compensating actions (hoàn kho/hoàn voucher khi bước sau fail) — mô hình Saga. Transaction đa
document của Mongo cần replica set và tăng contention khi tải cao.

**Q: JWT làm sao thu hồi khi logout / bị đánh cắp?**
A: Token mang `sid`; mỗi lần verify đều đối chiếu session trong Redis. Logout xóa session → mọi
token của phiên vô hiệu ngay. Refresh rotation: refresh token cũ bị dùng lại (jti lệch) → hủy cả
phiên. Access token chỉ sống 15 phút nên cửa sổ rủi ro rất hẹp.

**Q: Client gửi giá sản phẩm lên thì server có tin không?**
A: Không. `normalizeOrderItems` bỏ qua giá client gửi, đọc lại giá từ DB theo productId +
variantKey; tổng tiền do `computeOrderPricing` phía server tính. Tham số amount từ client bị
ignore (đặt tên `_clientAmount`).

**Q: Nếu user đặt hàng Stripe rồi bỏ đi, kho bị giữ mãi?**
A: Không — đơn online chỉ giữ kho 15 phút (`reservationExpiresAt`); sweep 60s/lần hủy đơn quá
hạn và hoàn kho + hoàn lượt voucher. Bản thân thao tác đánh dấu released cũng là conditional
update nên 2 vòng sweep chồng nhau không hoàn kho 2 lần.

**Q: Webhook Stripe bị gọi lại nhiều lần (retry) thì có cộng sold 2 lần không?**
A: Không — `markStripeOrderPaid` kiểm tra `order.payment` trước, đã paid thì return luôn
(idempotent). Webhook còn verify chữ ký trên raw body và đối chiếu orderId trong metadata.

**Q: Tìm kiếm tiếng Việt không dấu xử lý thế nào?**
A: Chuẩn hóa Unicode NFD, strip dấu thanh, `đ→d`, kết hợp $text index (có trọng số trường) với
regex fallback trên bản không dấu; kết quả xếp hạng bằng công thức 4 thành phần
(text 0.4 + độ phổ biến 0.3 + rating 0.2 + cá nhân hóa 0.1).

**Q: Hệ gợi ý xử lý user mới (cold start) ra sao?**
A: Chưa có tương tác → CF và content-based đều rỗng → fallback top sản phẩm bán chạy/rating cao.
Có tương tác dần thì hai thuật toán chính chiếm chỗ, kết quả cache 5 phút và chỉ invalidate khi
có tín hiệu mạnh.

**Q: Bảo mật có gì ngoài JWT?**
A: bcrypt hash mật khẩu; OTP xác minh email; rate-limit Redis theo IP+email cho 6 nhóm endpoint;
cookie HttpOnly (+ SameSite/Secure theo env); CORS whitelist; verify chữ ký Stripe & VNPay;
chống user-enumeration ở quên mật khẩu; kiểm tra quyền sở hữu tài nguyên ở mọi thao tác
(vendor chỉ đụng hàng/đơn của mình, user chỉ đụng đơn/review/địa chỉ của mình, chat kiểm tra
thành viên); image proxy có allowlist chống SSRF; escape regex đầu vào tìm kiếm.

**Q: Vì sao mỗi cặp user–product chỉ 1 document interaction?**
A: Tránh bùng nổ dữ liệu event-log; các hành vi tích lũy bằng $inc, điểm tổng đã bao gồm time
decay. Unique index đảm bảo không nhân bản khi 2 request đua nhau (bắt lỗi 11000 → update lại).

**Q: Đơn có nhiều shop thì trạng thái và tiền tính thế nào?**
A: `order.vendors[]` tách items/subtotal/trạng thái/tracking theo từng shop; trạng thái đơn tổng
suy ra từ trạng thái các shop. Voucher SHOP chỉ trừ vào subtotal của shop phát hành; giảm giá
sàn/ship tính ở mức đơn.

---

*Tài liệu sinh tự động từ việc đọc trực tiếp mã nguồn tại nhánh `feature/chat` (07/2026).
Các đường dẫn file trong tài liệu là vị trí thật trong repo — mở song song khi ôn tập.*
