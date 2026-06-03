# Báo cáo Bảo mật — DATN Project

> Tài liệu này liệt kê các vấn đề bảo mật được phát hiện qua review code thực tế.  
> Cập nhật: 2026-06-02

---

## Tóm tắt

| Mức độ | Số lượng |
|--------|---------|
| 🔴 Critical | 2 |
| 🟠 High | 4 |
| 🟡 Medium | 4 |
| 🔵 Low | 4 |

---

## 🔴 Critical

### 1. Endpoint SSE stream thiếu middleware xác thực

- **File:** `backend/routes/notificationRoute.js` (line ~15)
- **Vấn đề:** `/api/notification/stream` nhận token qua `req.query.token` (URL param) thay vì cookie. Token trong URL bị lộ vào:
  - Server logs / proxy logs
  - Browser history
  - Referrer header khi click link
- **Fix:**
  ```js
  // Xấu — token trên URL
  router.get('/stream', notificationController.stream)

  // Tốt — bắt buộc dùng authUser middleware
  router.get('/stream', authUser, notificationController.stream)
  // Trong controller chỉ đọc từ cookie, không đọc từ query param
  ```

---

### 2. Endpoint `/register` không có rate limiting

- **File:** `backend/routes/userRoute.js` (line ~26)
- **Vấn đề:** Không giới hạn số lần đăng ký → attacker có thể:
  - Spam tạo tài khoản hàng loạt
  - Enumerate email hợp lệ qua response khác nhau
  - Làm tràn database
- **Fix:**
  ```js
  import rateLimit from 'express-rate-limit'

  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 giờ
    max: 5,
    message: 'Quá nhiều yêu cầu đăng ký, thử lại sau.'
  })

  router.post('/register', registerLimiter, userController.register)
  ```

---

## 🟠 High

### 3. Token reset mật khẩu lộ trên URL

- **File:** `backend/services/userService.js` (line ~210)
- **Vấn đề:** Link reset mật khẩu gửi qua email dạng:
  ```
  https://yourdomain.com/reset-password?token=abc123
  ```
  Token bị lộ vào browser history, email client logs, proxy CDN.
- **Fix:** Dùng two-step flow:
  1. Gửi OTP ngắn (6 số) qua email, hết hạn sau 15 phút
  2. User nhập OTP → server cấp session tạm → user đổi mật khẩu
  - Hoặc dùng POST form với token trong request body (không phải query string)

---

### 4. Access token lưu trong React state (XSS risk)

- **File:** `frontend/src/context/ShopContext.jsx` (line ~27, ~39–45)
- **Vấn đề:** Access token lưu trong `useState` — nếu app có lỗ hổng XSS bất kỳ, attacker có thể đọc token từ memory qua injected script.
- **Fix:** Lưu cả access token lẫn refresh token vào `httpOnly` cookie (server set):
  ```js
  // Server
  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000 // 15 phút
  })
  ```
  Frontend không cần cầm token, mọi request tự gửi cookie.

---

### 5. JWT_SECRET chỉ validate ở production

- **File:** `backend/server.js` (line ~49–53)
- **Vấn đề:** Check độ dài JWT_SECRET chỉ chạy khi `NODE_ENV=production`. Dev có thể dùng secret yếu (`"secret"`, `"123"`) mà không bị cảnh báo.
- **Fix:**
  ```js
  // Áp dụng ở mọi môi trường
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET phải tối thiểu 32 ký tự')
  }
  ```

---

### 6. FRONTEND_URL không được whitelist

- **File:** `backend/services/userService.js` (line ~208)
- **Vấn đề:** `process.env.FRONTEND_URL` dùng trực tiếp trong link email mà không validate. Nếu env bị inject giá trị sai → open redirect / phishing.
- **Fix:**
  ```js
  const ALLOWED_FRONTEND_URLS = ['https://yourdomain.com', 'https://staging.yourdomain.com']

  if (!ALLOWED_FRONTEND_URLS.includes(process.env.FRONTEND_URL)) {
    throw new Error('FRONTEND_URL không hợp lệ')
  }
  ```

---

## 🟡 Medium

### 7. Thiếu validate ObjectId trên filter category

- **File:** `backend/controllers/productController.js` (line ~38–47)
- **Vấn đề:** `categoryId` từ query/body không được kiểm tra là MongoDB ObjectId hợp lệ → có thể gây lỗi unhandled exception hoặc NoSQL injection.
- **Fix:**
  ```js
  import mongoose from 'mongoose'

  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    return res.status(400).json({ success: false, message: 'categoryId không hợp lệ' })
  }
  ```

---

### 8. File upload chỉ check MIME type từ client

- **File:** `backend/middleware/multer.js` (line ~26–32)
- **Vấn đề:** `file.mimetype` do client gửi lên, có thể bị giả mạo. Một file `.php` đổi tên thành `.jpg` với MIME spoofed vẫn pass qua.
- **Fix:** Verify magic bytes thực sự của file sau khi nhận:
  ```bash
  npm install file-type
  ```
  ```js
  import { fileTypeFromBuffer } from 'file-type'

  const type = await fileTypeFromBuffer(file.buffer)
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type?.mime)) {
    throw new Error('File type không được phép')
  }
  ```

---

### 9. URL decode nhiều lần trong image proxy

- **File:** `backend/controllers/imageProxyController.js` (line ~31–56)
- **Vấn đề:** URL từ query param được decode nhiều lần. Attacker có thể dùng double-encoding (`%2500` → `%00` → null byte) để bypass hostname allowlist check.
- **Fix:** Decode đúng một lần và validate `hostname` sau decode cuối cùng:
  ```js
  const rawUrl = req.query.url
  let decodedUrl
  try {
    decodedUrl = new URL(decodeURIComponent(rawUrl))
  } catch {
    return res.status(400).end()
  }
  if (!ALLOWED_HOSTNAMES.includes(decodedUrl.hostname)) {
    return res.status(403).end()
  }
  ```

---

### 10. Console.log lộ thông tin nội bộ ở production

- **Files:** Nhiều controller và service dùng `console.log(error)`
- **Vấn đề:** Stack trace và thông tin DB schema có thể bị lộ qua log aggregation hoặc nếu response vô tình include error object.
- **Fix:** Dùng logger có level:
  ```js
  // Chỉ log stack trace ở dev
  if (process.env.NODE_ENV !== 'production') {
    console.error(error)
  } else {
    console.error(error.message) // chỉ message, không stack
  }
  ```

---

## 🔵 Low

### 11. Cookie sameSite nên dùng `strict` thay `lax`

- **File:** `backend/controllers/userController.js` (line ~17)
- **Vấn đề:** `sameSite: 'lax'` vẫn cho phép cookie gửi kèm top-level navigation từ domain khác.
- **Fix:** Đổi thành `sameSite: 'strict'` cho auth cookies nếu app không cần cross-site navigation.

---

### 12. Thiếu HSTS header

- **Vấn đề:** Không có `Strict-Transport-Security` header → trình duyệt không buộc HTTPS cho lần truy cập đầu.
- **Fix:**
  ```js
  app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    next()
  })
  ```
  Hoặc dùng package `helmet`:
  ```bash
  npm install helmet
  ```
  ```js
  import helmet from 'helmet'
  app.use(helmet())
  ```

---

### 13. Thiếu structured logging để phát hiện tấn công

- **Files:** `backend/middleware/auth.js`, `vendorAuth.js`
- **Vấn đề:** Thất bại xác thực chỉ log ra console, không có IP, timestamp, userId → khó phát hiện brute-force.
- **Fix:** Log dạng JSON với đủ context:
  ```js
  console.warn(JSON.stringify({
    event: 'auth_failure',
    ip: req.ip,
    path: req.path,
    timestamp: new Date().toISOString(),
    reason: err.message
  }))
  ```

---

### 14. Dependency cũ có thể có CVE

- **Vấn đề:** Chưa có quy trình kiểm tra thường xuyên.
- **Fix:**
  ```bash
  npm audit          # kiểm tra
  npm audit fix      # tự fix các lỗi không breaking
  ```
  Thêm vào CI pipeline để chạy mỗi lần build.

---

## Thứ tự ưu tiên xử lý

### Làm ngay (trước khi go-live)
- [ ] #1 — Thêm `authUser` middleware vào SSE stream, bỏ token trên URL
- [ ] #2 — Thêm rate limiting cho `/register`
- [ ] #3 — Đổi password reset flow, không dùng token trên URL
- [ ] #7 — Validate ObjectId trên mọi endpoint nhận ID từ client

### Ngắn hạn (trong vòng 1 tuần)
- [ ] #4 — Chuyển access token sang httpOnly cookie
- [ ] #5 — Validate JWT_SECRET ở mọi môi trường
- [ ] #6 — Whitelist FRONTEND_URL
- [ ] #8 — Verify magic bytes file upload
- [ ] #12 — Thêm HSTS (hoặc dùng `helmet`)

### Dài hạn (best practice)
- [ ] #9 — Hardening image proxy URL parsing
- [ ] #10 — Tắt stack trace log ở production
- [ ] #11 — Đổi sameSite sang `strict`
- [ ] #13 — Structured security logging
- [ ] #14 — Thêm `npm audit` vào CI
