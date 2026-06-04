import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // ============================================================
  // Thông tin cơ bản của ứng dụng
  // ============================================================
  appId: 'com.datn.shop',       // Package name trên Android / Bundle ID trên iOS
  appName: 'DATN Shop',         // Tên hiển thị trên màn hình điện thoại
  webDir: 'dist',               // Thư mục output sau khi `npm run build`

  // ============================================================
  // Cấu hình cho Android
  // ============================================================
  android: {
    // Cho phép gọi HTTP (không chỉ HTTPS) khi đang dev local
    // Quan trọng khi backend chạy trên http://192.168.x.x:4000
    allowMixedContent: true,

    // Bật WebView debugging để xem Console Log từ Chrome DevTools
    // Tắt đi khi build production (đặt false hoặc xóa dòng này)
    webContentsDebuggingEnabled: true,
  },

  // ============================================================
  // Cấu hình Server
  // Dùng khi muốn app load từ URL thay vì từ file local (file://)
  // Để trống khi dùng local assets (khuyên dùng)
  // ============================================================
  // server: {
  //   url: 'http://192.168.1.50:5173',  // Bật dòng này khi muốn live-reload từ Vite dev server
  //   cleartext: true,                   // Cho phép HTTP (không HTTPS)
  // },

  // ============================================================
  // Cấu hình plugin
  // ============================================================
  plugins: {
    // Cấu hình SplashScreen (màn hình chào khi mở app)
    SplashScreen: {
      launchShowDuration: 2000,      // Hiển thị splash trong 2 giây
      backgroundColor: '#ffffff',    // Màu nền splash screen
      showSpinner: false,
      androidSpinnerStyle: 'small',
      iosSpinnerStyle: 'small',
      spinnerColor: '#4f46e5',
    },

    // Cấu hình StatusBar (thanh trạng thái phía trên điện thoại)
    StatusBar: {
      style: 'Default',              // 'Dark' | 'Light' | 'Default'
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
