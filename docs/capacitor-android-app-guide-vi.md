# Hướng dẫn Build App Android từ Frontend React bằng Capacitor

## Tổng quan

Dự án này sử dụng **Ionic Capacitor** để đóng gói toàn bộ mã nguồn React (thư mục `frontend/`) thành một ứng dụng Android native (`.apk`), mà **không cần viết lại bất kỳ đoạn code nào**.

### Kiến trúc hoạt động

```
+------------------------------------------------+
|  Ứng dụng Android Native (.apk)               |
|                                                |
|  +------------------------------------------+ |
|  |  WebView (Chromium nhúng toàn màn hình)  | |
|  |                                          | |
|  |   React App (HTML/CSS/JS từ dist/)       | |
|  |   ← Load từ bộ nhớ máy, không qua mạng  | |
|  +------------------------------------------+ |
|                                                |
|  Capacitor Bridge ← Cầu nối Web ↔ Native     |
|  Android SDK (Camera, Storage, GPS, ...)      |
+------------------------------------------------+
         |
         | HTTP/HTTPS qua mạng (Wi-Fi / 4G)
         |
+-----------------------------+
|  Backend Express (port 4000)|
|  ← Local hoặc qua Ngrok    |
+-----------------------------+
```

---

## Yêu cầu môi trường

| Công cụ | Phiên bản | Ghi chú |
|---|---|---|
| Node.js | 18+ | Đã có sẵn trong dự án |
| Android Studio | Mới nhất (Ladybug+) | Cần cài thêm |
| Android SDK | API Level 33+ (Android 13) | Cài trong Android Studio |
| JDK | 17+ | Đi kèm Android Studio |
| Ngrok | Bất kỳ | Để expose backend ra internet |

---

## Cài đặt đã được thực hiện

Các bước sau đã được cấu hình sẵn trong dự án, không cần làm lại.

### 1. Cài packages Capacitor

```bash
# Trong thư mục frontend/
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### 2. File cấu hình `capacitor.config.ts`

File [`frontend/capacitor.config.ts`](../frontend/capacitor.config.ts) đã được tạo với các cài đặt sau:

```typescript
const config: CapacitorConfig = {
  appId: 'com.datn.shop',   // Package name trên Android
  appName: 'DATN Shop',     // Tên app hiển thị trên điện thoại
  webDir: 'dist',           // Thư mục output của Vite
  android: {
    allowMixedContent: true,          // Cho phép gọi HTTP khi dev local
    webContentsDebuggingEnabled: true, // Bật Chrome DevTools debug
  },
};
```

> **Khi build production:** Đặt `webContentsDebuggingEnabled: false` để tắt debug mode.

### 3. Cập nhật `vite.config.js`

Đã thêm `base: './'` vào [`frontend/vite.config.js`](../frontend/vite.config.js).

```javascript
// vite.config.js
base: './',
```

**Lý do bắt buộc:** Khi WebView load app từ bộ nhớ máy (`file://`), tất cả đường dẫn assets (JS, CSS, ảnh) phải là đường dẫn **tương đối** (ví dụ: `./assets/index.js`) thay vì **tuyệt đối** (ví dụ: `/assets/index.js`). Nếu thiếu dòng này, app sẽ bị màn hình trắng hoàn toàn khi khởi động.

---

## Quy trình Build APK

Thực hiện các lệnh sau mỗi khi bạn muốn tạo file APK mới:

### Bước 1: Cấu hình backend URL cho mobile

Mở file `frontend/.env`, đổi `VITE_BACKEND_URL` thành URL Ngrok (xem phần [Kết nối Backend qua Ngrok](#kết-nối-backend-qua-ngrok) bên dưới).

```env
# frontend/.env
VITE_BACKEND_URL=https://xxxx-xx-xx-xxx-xx.ngrok-free.app
```

### Bước 2: Build React app

```bash
# Trong thư mục frontend/
npm run build
```

Lệnh này tạo ra thư mục `frontend/dist/` chứa toàn bộ mã nguồn web đã được tối ưu hóa.

### Bước 3: Thêm platform Android (chỉ chạy 1 lần duy nhất)

```bash
npx cap add android
```

Lệnh này tạo ra thư mục `frontend/android/` — đây là một dự án Android Studio đầy đủ.

### Bước 4: Đồng bộ code web vào Android project

```bash
npx cap sync
```

Lệnh này sao chép toàn bộ nội dung của `dist/` vào đúng vị trí bên trong thư mục `android/` để ứng dụng native có thể load.

### Bước 5A: Build APK bằng Android Studio (Khuyên dùng)

```bash
npx cap open android
```

Android Studio sẽ tự động mở dự án. Sau khi Gradle sync xong (~1-2 phút lần đầu):
1. Trên menu: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Khi hoàn tất, bấm nút **"locate"** ở thông báo góc dưới phải để tìm file.

File APK nằm tại: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

### Bước 5B: Build APK bằng dòng lệnh (Không cần mở Android Studio)

```bash
cd android
.\gradlew.bat assembleDebug
```

File APK nằm tại cùng đường dẫn như trên.

---

## Kết nối Backend qua Ngrok

### Tại sao cần Ngrok?

| Vấn đề | Không có Ngrok | Có Ngrok |
|---|---|---|
| **IP Backend** | Điện thoại không biết `localhost` là gì | Đường dẫn online cố định |
| **Bảo mật HTTP** | Android chặn kết nối `http://` | Ngrok cung cấp `https://` miễn phí |
| **Chung mạng** | Bắt buộc cùng Wi-Fi | Chạy qua 4G/5G ở bất cứ đâu |
| **Demo đồ án** | Rủi ro mạng hội đồng chặn port | Hoạt động ổn định mọi môi trường |

### Thiết lập Ngrok

**Bước 1:** Cài Ngrok tại [ngrok.com/download](https://ngrok.com/download) (hoặc `winget install ngrok`)

**Bước 2:** Đăng ký tài khoản miễn phí và lấy authtoken, sau đó cấu hình:
```bash
ngrok config add-authtoken <YOUR_TOKEN>
```

**Bước 3:** Khởi động backend trước:
```bash
# Trong thư mục backend/
npm run server
```

**Bước 4:** Chạy Ngrok expose port 4000:
```bash
ngrok http 4000
```

Ngrok sẽ hiển thị một đường dẫn dạng:
```
Forwarding   https://abcd-123-45-67-890.ngrok-free.app → http://localhost:4000
```

**Bước 5:** Cập nhật `frontend/.env` với URL đó, build lại và sync:
```bash
# Cập nhật .env với URL Ngrok
npm run build
npx cap sync
```

> ⚠️ **Quan trọng khi demo:** Giữ nguyên terminal đang chạy Ngrok. Phiên bản miễn phí sẽ đổi URL mỗi khi bạn khởi động lại Ngrok, và bạn sẽ phải build lại APK với URL mới.

---

## Xử lý Cookie Auth (HttpOnly)

Backend của dự án dùng **HttpOnly Cookie** để lưu Refresh Token. Đây là điểm cần lưu ý khi chạy trên app mobile.

### Vấn đề

WebView trên điện thoại áp dụng quy tắc bảo mật cookie nghiêm ngặt. Khi origin của app (`capacitor://localhost`) khác với domain của backend (`https://xxx.ngrok-free.app`), trình duyệt nhúng **tự động chặn** việc gửi/nhận cookie.

### Giải pháp cho môi trường demo đồ án

Cấu hình backend cho phép cookie cross-origin khi nhận request từ Capacitor:

```javascript
// backend/src/server.js hoặc app.js
const allowedOrigins = [
  'http://localhost:5173',     // Vite dev server (web)
  'http://localhost:5174',     // Admin dev server (web)
  'http://localhost',          // Capacitor Android origin
  'capacitor://localhost',     // Capacitor iOS origin
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,           // Bắt buộc để cookie hoạt động
}));
```

Thêm vào cấu hình session/cookie:
```javascript
// Cấu hình cookie phải có sameSite: 'none' và secure: true khi qua Ngrok HTTPS
res.cookie('refreshToken', token, {
  httpOnly: true,
  secure: true,        // Bắt buộc khi dùng HTTPS (Ngrok)
  sameSite: 'none',    // Cho phép cross-site cookie
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

---

## Workflow Update Code nhanh

Mỗi khi bạn sửa code React và muốn cập nhật app:

```bash
# 1. Build lại
npm run build

# 2. Sync sang Android
npx cap sync

# 3. Mở Android Studio và Run (Ctrl+R) hoặc Build APK lại
npx cap open android
```

---

## Cấu trúc thư mục sau khi cài Capacitor

```
frontend/
├── android/               # Dự án Android (tự động sinh ra bởi Capacitor)
│   ├── app/
│   │   └── src/main/assets/public/   # Code web đã build được copy vào đây
│   └── ...
├── dist/                  # Output của npm run build (Vite)
├── src/                   # Mã nguồn React gốc
├── capacitor.config.ts    # Cấu hình Capacitor
├── vite.config.js         # Cấu hình Vite (đã thêm base: './')
└── package.json
```

---

## Debugging App trên điện thoại thật

Sau khi cài APK lên điện thoại Android (hoặc chạy qua Android Studio emulator), bạn có thể xem toàn bộ Console Log, Network Request và inspect DOM y hệt như debug trên Chrome:

1. Bật USB Debugging trên điện thoại (Cài đặt → Tùy chọn nhà phát triển → Gỡ lỗi USB).
2. Cắm điện thoại vào máy tính bằng cáp USB.
3. Mở Chrome trên máy tính, gõ vào thanh địa chỉ: `chrome://inspect/#devices`
4. App của bạn sẽ xuất hiện trong danh sách. Bấm **"inspect"** để mở DevTools đầy đủ tính năng.
