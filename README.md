# DATN — Ứng dụng Thương Mại Điện Tử

Đồ án tốt nghiệp — Hệ thống mua sắm trực tuyến hỗ trợ đa vendor, thanh toán online (Stripe), lưu trữ ảnh (Cloudflare R2), đánh giá sản phẩm theo đơn hàng.

---

## Công nghệ sử dụng

| Lớp | Công nghệ |
|---|---|
| Backend | Node.js, Express 5, MongoDB (Mongoose) |
| Frontend | React 19, Vite 6, Tailwind CSS |
| Admin/Vendor | React 19, Vite 6, Tailwind CSS |
| Thanh toán | Stripe |
| Lưu trữ ảnh | Cloudflare R2 |
| Xác thực | JWT |

---

## Cấu trúc dự án

```
DATN/
├── backend/          # REST API (port 4000)
├── frontend/         # Giao diện khách hàng (port 5173)
├── admin/            # Dashboard admin/vendor (port 5174)
├── docker-compose.yml
└── .gitignore
```

---

## Cài đặt & Chạy

### Yêu cầu

- Node.js >= 18
- MongoDB Atlas (hoặc local)
- Tài khoản Cloudflare R2

### 1. Clone dự án

```bash
git clone <repo-url>
cd DATN
```

### 2. Cài dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../admin && npm install
```

### 3. Cấu hình biến môi trường

**`backend/.env`**
```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net

PORT=4000

JWT_SECRET=your_jwt_secret_key

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_admin_password

STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx

CLOUDINARY_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET_KEY=your_cloudinary_api_secret

R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY=your_r2_access_key
R2_SECRET_KEY=your_r2_secret_key
R2_BUCKET=your_bucket_name
R2_PUBLIC_BASE_URL=https://pub-xxxxxxxx.r2.dev
```

**`frontend/.env`**
```env
VITE_BACKEND_URL=http://localhost:4000
VITE_R2_PUBLIC_BASE_URL=https://pub-xxxxxxxx.r2.dev
VITE_R2_BUCKET=your_bucket_name
```

**`admin/.env`**
```env
VITE_BACKEND_URL=http://localhost:4000
VITE_R2_PUBLIC_BASE_URL=https://pub-xxxxxxxx.r2.dev
VITE_R2_BUCKET=your_bucket_name
```

### 4. Chạy ứng dụng

Mở 3 terminal riêng:

```bash
# Terminal 1 — Backend
cd backend && npm run server

# Terminal 2 — Frontend
cd frontend && npm run dev

# Terminal 3 — Admin
cd admin && npm run dev
```

| Dịch vụ | URL |
|---|---|
| Backend API | http://localhost:4000 |
| Frontend | http://localhost:5173 |
| Admin Dashboard | http://localhost:5174 |

---

## API Endpoints

### Auth
| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/user/register` | Đăng ký tài khoản |
| POST | `/api/user/login` | Đăng nhập user |
| POST | `/api/user/admin` | Đăng nhập admin |

### Sản phẩm
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/product/list` | Danh sách sản phẩm |
| POST | `/api/product/single` | Chi tiết 1 sản phẩm |
| POST | `/api/product/add` | Thêm sản phẩm (admin) |
| POST | `/api/product/remove` | Xóa sản phẩm (admin) |

### Giỏ hàng
| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/cart/add` | Thêm vào giỏ |
| POST | `/api/cart/update` | Cập nhật số lượng |
| POST | `/api/cart/get` | Lấy giỏ hàng |

### Đơn hàng
| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/order/place-order` | Đặt hàng COD |
| POST | `/api/order/place-order-stripe` | Đặt hàng Stripe |
| POST | `/api/order/verify-stripe` | Xác nhận thanh toán Stripe |
| POST | `/api/order/user-orders` | Đơn hàng của user |
| POST | `/api/order/vendor-list` | Đơn hàng của vendor |
| POST | `/api/order/vendor-status` | Cập nhật trạng thái (vendor) |

### Đánh giá
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/review/product/:id` | Lấy đánh giá theo sản phẩm |
| POST | `/api/review` | Gửi đánh giá (cần đăng nhập + đã nhận hàng) |
| PUT | `/api/review/:id` | Sửa đánh giá |
| DELETE | `/api/review/:id` | Xóa đánh giá |
| POST | `/api/review/can-review/:productId` | Kiểm tra quyền đánh giá |
| POST | `/api/review/my-reviewed-products` | Danh sách đã đánh giá |

---

## Tính năng nổi bật

- **Đa vendor**: Mỗi sản phẩm gắn với một shop, vendor quản lý đơn hàng riêng
- **Đánh giá theo đơn hàng**: Chỉ được đánh giá sau khi nhận hàng, mỗi lần mua = 1 đánh giá độc lập
- **Upload ảnh đánh giá**: Tối đa 5 ảnh/đánh giá, lưu trên Cloudflare R2
- **Lọc đánh giá theo sao**: Xem phân bố và lọc 1–5 sao
- **Thanh toán Stripe**: Hỗ trợ thanh toán thẻ quốc tế
- **Trạng thái đơn hàng**: Order Placed → Packing → Shipped → Out for delivery → Delivered

---

## Docker

Chỉ backend được containerize:

```bash
docker-compose up --build
```

Backend chạy trong container, map port `4000:3000`.

---

## Lưu ý bảo mật

- **Không commit file `.env`** lên Git
- Đổi `JWT_SECRET`, `ADMIN_PASSWORD` trước khi deploy production
- Thêm IP vào whitelist trên MongoDB Atlas Network Access
