# Chạy Backend Qua Cloudflare Tunnel

Tài liệu này dùng cho backend tại `http://localhost:4000`.

## 1) Cài `cloudflared`

Windows (khuyên dùng):

```powershell
winget install Cloudflare.cloudflared
```

Kiểm tra:

```powershell
cloudflared --version
```

## 2) Chạy Quick Tunnel (nhanh, không cần DNS)

Mở terminal tại thư mục `backend`:

```powershell
npm run tunnel:quick
```

Cloudflare sẽ trả về URL dạng:

`https://<random>.trycloudflare.com`

## 3) Chạy Named Tunnel (domain cố định)

### Bước A: Đăng nhập Cloudflare

```powershell
cloudflared tunnel login
```

### Bước B: Tạo tunnel

```powershell
cloudflared tunnel create datn-backend
```

### Bước C: Tạo file config

Copy file mẫu:

`backend/cloudflared/config.example.yml` -> `backend/cloudflared/config.yml`

Sửa 3 giá trị:
- `tunnel`
- `credentials-file`
- `hostname`

### Bước D: Tạo DNS route

```powershell
cloudflared tunnel route dns datn-backend api.your-domain.com
```

### Bước E: Chạy tunnel

```powershell
npm run tunnel:named
```

## 4) Chạy backend + tunnel cùng lúc

Terminal 1:

```powershell
npm run server
```

Terminal 2:

```powershell
npm run tunnel:quick
```

hoặc:

```powershell
npm run tunnel:named
```

## 5) Cấu hình `.env` liên quan

Trong `backend/.env`, đảm bảo:

- `PORT=4000`
- `CORS_ORIGINS` có frontend gọi API:
  - local: `http://localhost:5173,http://localhost:5174`
  - production frontend domain nếu có
- `FRONTEND_URL` trỏ về frontend thực tế (quan trọng cho redirect)
- `VNP_RETURN_URL` dùng HTTPS domain tunnel nếu test VNPay callback qua tunnel

Ví dụ:

```env
PORT=4000
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,https://shop.your-domain.com
FRONTEND_URL=https://shop.your-domain.com
VNP_RETURN_URL=https://api.your-domain.com/api/order/vnpay-return
```

## 6) Lưu ý

- Quick tunnel đổi URL sau mỗi lần chạy lại.
- Nếu frontend gọi API bằng URL tunnel, cần cập nhật `VITE_BACKEND_URL` ở frontend tương ứng.
- Nếu dùng cookie auth cross-site trên production, cần HTTPS và cấu hình cookie/cors đồng bộ.

## 7) Xử lý lỗi DNS timeout (region1.v2.argotunnel.com)

Nếu gặp lỗi:

`Failed to initialize DNS local resolver ... lookup region1.v2.argotunnel.com: i/o timeout`

thực hiện theo thứ tự:

1. Dừng mọi tiến trình cloudflared cũ:

```powershell
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
```

2. Chạy lại tunnel bằng `http2` + `IPv4`:

```powershell
npm run tunnel:quick
```

hoặc:

```powershell
npm run tunnel:named
```

3. Nếu vẫn lỗi, đổi DNS máy sang `1.1.1.1` và `8.8.8.8`, rồi thử lại.

4. Kiểm tra firewall/proxy công ty có chặn kết nối ra ngoài không (đặc biệt UDP/QUIC).  
   Cấu hình hiện tại đã ép `http2` để tránh phụ thuộc QUIC.
