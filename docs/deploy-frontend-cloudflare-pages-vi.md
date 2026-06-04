# Deploy Frontend & Admin lên Cloudflare Pages

> Backend đã deploy trên Cloudflare Workers. Tài liệu này hướng dẫn deploy 2 app còn lại: `frontend` (cửa hàng) và `admin` (quản trị).

---

## Tổng quan

| App | Đường dẫn | Cloudflare Pages project |
|-----|-----------|--------------------------|
| Cửa hàng (user) | `DATN/frontend` | `datn-frontend` |
| Quản trị (admin) | `DATN/admin` | `datn-admin` |

---

## Phase 1 — Fix `vite.config.js` (web vs Capacitor)

`base: './'` hiện tại bắt buộc cho Capacitor (file://), nhưng web cần `base: '/'` để SPA routing hoạt động đúng.

Sửa [frontend/vite.config.js](../frontend/vite.config.js):

```js
base: process.env.CAPACITOR_BUILD ? './' : '/',
```

- Build web: `npm run build` → `base = /`
- Build mobile: `CAPACITOR_BUILD=true npm run build` → `base = ./`

Làm tương tự cho [admin/vite.config.js](../admin/vite.config.js) (nếu có Capacitor sau này).

---

## Phase 2 — Thêm file `_redirects` (SPA routing)

Cloudflare Pages trả 404 khi user reload trang nếu thiếu file này.

Tạo `frontend/public/_redirects`:

```
/*    /index.html    200
```

Tạo `admin/public/_redirects`:

```
/*    /index.html    200
```

---

## Phase 3 — Environment Variables

Vào **Cloudflare Dashboard → Pages → [project] → Settings → Environment Variables**.

Thêm cho **cả Production và Preview**:

| Variable | Mô tả | Ví dụ |
|----------|-------|-------|
| `VITE_BACKEND_URL` | URL Cloudflare Worker backend | `https://datn-api.yourname.workers.dev` |
| `VITE_R2_PUBLIC_BASE_URL` | Public URL của R2 bucket | `https://pub-xxxx.r2.dev` |
| `VITE_R2_BUCKET` | Tên R2 bucket | `datn-uploads` |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID | `xxxx.apps.googleusercontent.com` |

> Lưu ý: Biến `VITE_*` được Vite nhúng vào bundle lúc build, không phải runtime. Phải set đúng trước khi trigger build.

---

## Phase 4 — Deploy

### Cách 1: Git Integration (khuyến nghị, tự động CI/CD)

1. Push repo lên GitHub (nếu chưa có).
2. Cloudflare Dashboard → **Pages → Create a project → Connect to Git**.
3. Chọn repo DATN.
4. Cấu hình build cho `frontend`:

   | Trường | Giá trị |
   |--------|---------|
   | Root directory | `frontend` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

5. Tạo project thứ hai cho `admin` với **Root directory = `admin`**.
6. Sau mỗi lần `git push`, Cloudflare Pages tự build lại.

### Cách 2: Deploy thủ công bằng Wrangler CLI

```bash
# Cài Wrangler nếu chưa có
npm install -g wrangler
wrangler login

# Deploy frontend
cd DATN/frontend
npm install && npm run build
npx wrangler pages deploy dist --project-name datn-frontend

# Deploy admin
cd ../admin
npm install && npm run build
npx wrangler pages deploy dist --project-name datn-admin
```

---

## Phase 5 — Custom Domain (tuỳ chọn)

Cloudflare Pages → [project] → **Custom domains → Add a custom domain**.

| App | Domain gợi ý |
|-----|-------------|
| Frontend | `store.yourdomain.com` hoặc `yourdomain.com` |
| Admin | `admin.yourdomain.com` |

DNS sẽ tự được cấu hình nếu domain đang dùng Cloudflare nameservers.

---

## Thứ tự thực hiện

- [x] 1. Fix `base` trong `frontend/vite.config.js`
- [x] 2. Thêm `frontend/public/_redirects`
- [x] 3. Thêm `admin/public/_redirects`
- [ ] 4. Test build local: `npm run build && npm run preview`
- [ ] 5. Tạo 2 Pages project trên Cloudflare Dashboard
- [ ] 6. Set environment variables cho từng project
- [ ] 7. Deploy (git push hoặc wrangler)
- [ ] 8. Kiểm tra URL được cấp (`*.pages.dev`)
- [ ] 9. (Tuỳ chọn) Gắn custom domain

---

## Kiểm tra sau deploy

```bash
# Kiểm tra build output có _redirects không
ls DATN/frontend/dist

# Preview local trước khi deploy
cd DATN/frontend && npm run preview
```

Truy cập URL Cloudflare Pages cấp (dạng `https://datn-frontend.pages.dev`), thử:
- Reload trang ở một route bất kỳ → không bị 404
- Đăng nhập / gọi API → response từ đúng backend Cloudflare Worker
- Ảnh hiển thị từ R2 bucket
