# DATN - E-commerce Marketplace (User/Vendor)

Du an marketplace fullstack gom 3 phan:
- `frontend`: website mua sam cho nguoi dung.
- `admin`: dashboard cho vendor quan ly san pham, don hang, chat, thong ke.
- `backend`: REST API + realtime + tich hop thanh toan.

## 1. Kien truc tong quan

- **Frontend shop**: React + Vite, chay mac dinh tai `http://localhost:5173`.
- **Frontend vendor dashboard (`admin`)**: React + Vite, chay tai `http://localhost:5174`.
- **Backend API**: Express + MongoDB, chay tai `http://localhost:4000`.
- **Realtime**:
  - Socket.IO cho chat.
  - SSE cho thong bao trong vendor dashboard.
- **Storage anh**: Cloudflare R2 (kem image proxy endpoint).
- **Thanh toan**: Stripe + VNPay + COD.

## 2. Tinh nang chinh

- Dang ky/dang nhap user, refresh token qua cookie (`HttpOnly`).
- Mo hinh auth hop nhat user/vendor (mot tai khoan co the nang quyen vendor).
- Quan ly san pham, danh muc phan cap, gio hang, dat hang.
- Theo doi don hang va xu ly thanh toan online.
- Realtime chat buyer-vendor.
- Notification cho vendor (SSE stream).
- Bao mat auth bang Redis rate-limit cho cac endpoint nhay cam.

## 3. Cong nghe su dung

- **Backend**: Node.js, Express, MongoDB/Mongoose, Redis, Socket.IO, JWT, Stripe.
- **Frontend/Admin**: React 19, React Router, Axios, TailwindCSS, Vite.
- **Ha tang**: Docker, Nginx (build production frontend/admin).

## 4. Cau truc thu muc

```text
DATN/
- backend/   # API server, models, routes, services, scripts
- frontend/  # App cho nguoi mua
- admin/     # Dashboard cho vendor
- docker/    # Docker Compose cho moi truong dev/prod
- docs/      # Tai lieu ky thuat va kien truc
```

## 5. Yeu cau moi truong

- Node.js 18+
- npm 9+
- MongoDB (local hoac Atlas)
- Redis (khuyen nghi manh cho auth/security)

## 6. Chay local (khong Docker)

### Buoc 1: Tao file moi truong

- Backend:
```bash
copy backend\.env.example backend\.env
```
- Frontend:
```bash
copy frontend\.env.example frontend\.env
```
- Admin:
```bash
copy admin\.env.example admin\.env
```

### Buoc 2: Cai dependencies

```bash
cd backend && npm install
cd ..\frontend && npm install
cd ..\admin && npm install
```

### Buoc 3: Chay tung service

Terminal 1 (backend):
```bash
cd backend
npm run server
```

Terminal 2 (frontend):
```bash
cd frontend
npm run dev
```

Terminal 3 (admin):
```bash
cd admin
npm run dev
```

Sau khi chay:
- Shop: `http://localhost:5173`
- Vendor dashboard: `http://localhost:5174`
- API: `http://localhost:4000`

## 7. Chay bang Docker

Tu thu muc `docker/`:

### Production compose
```bash
docker compose up -d --build
```

### Development compose (HMR + mount code)
```bash
docker compose -f docker-compose.dev.yml up --build
```

Luu y:
- Cau hinh bien moi truong o `docker/.env`.
- Neu dung Atlas, chi can set `MONGODB_URI`; co the khong can bat service `mongo` trong compose.

## 8. Backend scripts huu ich

Trong `backend/`:

- Seed du lieu:
```bash
npm run seed-categories
npm run seed-products
npm run seed-reviews
```

- Import/resync du lieu san pham:
```bash
npm run import-external-products
npm run reimport-fakestore
npm run resync-external-images
```

- Test:
```bash
npm test
```

## 9. Bien moi truong quan trong

### Backend (`backend/.env`)

- `MONGODB_URI`, `PORT`
- `JWT_SECRET`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`
- `REDIS_URL`, `REDIS_PREFIX`, cac bien `AUTH_RL_*`
- `STRIPE_SECRET_KEY`
- `VNP_TMN_CODE`, `VNP_HASH_SECRET`, `VNP_RETURN_URL`
- `R2_ENDPOINT`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`
- `MAIL_USER`, `MAIL_APP_PASSWORD`, `FRONTEND_URL`

### Frontend/Admin

- `VITE_BACKEND_URL`
- `VITE_R2_PUBLIC_BASE_URL`, `VITE_R2_BUCKET`
- `VITE_GOOGLE_CLIENT_ID` (frontend, neu dung Google login)
- `VITE_FRONTEND_URL` (admin)

## 10. Tai lieu ky thuat lien quan

- [Auth unified user/vendor](docs/auth-unified-user-vendor.md)
- [Ke hoach bao mat auth voi Redis](docs/redis-auth-security-plan-vi.md)
- [Ke hoach chong oversell + idempotency](docs/concurrent-purchase-stock-plan-vi.md)

## 11. Ghi chu hien trang

- Du an da chuyen huong auth hop nhat user/vendor, nhung van con mot so route dung `adminAuth` theo env tinh; nen tiep tuc don dep theo tai lieu trong `docs/`.
- `node_modules` dang co trong cac thu muc app tai workspace hien tai, nhung khong nen commit len git.
