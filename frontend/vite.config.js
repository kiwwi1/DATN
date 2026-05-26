import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],

    // base: './' là BẮT BUỘC cho Capacitor.
    // Khi app chạy từ bộ nhớ điện thoại (file://), Vite cần dùng
    // đường dẫn tương đối thay vì tuyệt đối (/assets/...) để tránh lỗi 404.
    base: './',

    define: {
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID),
    },
    server: {
      port: 5173,
      host: true,
      watch: {
        usePolling: process.env.CHOKIDAR_USEPOLLING === 'true',
      },
    },
    build: {
      // Tăng giới hạn chunk size warning (mặc định 500kb, app thực tế thường lớn hơn)
      chunkSizeWarningLimit: 1000,
    },
  }
})
