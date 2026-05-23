# Kế Hoạch Áp Dụng Redis Cho Bảo Mật Đăng Nhập

## 1) Mục tiêu
- Tăng bảo mật cho luồng đăng nhập.
- Giảm rủi ro brute-force, replay refresh token, và spam OTP.
- Chuẩn bị khả năng scale nhiều instance backend.

## 2) Có nên áp dụng Redis không?
**Có, nên áp dụng.**  
Với trạng thái hiện tại của dự án (đã có refresh token, OTP, reset password), Redis mang lại lợi ích rõ ràng nhất ở phần auth/security.

## 3) Phạm vi áp dụng ưu tiên (bắt buộc)
1. Rate limit cho endpoint nhạy cảm:
   - `POST /api/user/login`
   - `POST /api/user/verify-email`
   - `POST /api/user/forgot-password`
   - `POST /api/user/reset-password`
   - `POST /api/user/refresh`
2. Lưu blacklist/revoke refresh token theo `jti` hoặc token hash.
3. Lưu counter OTP sai + cooldown theo email/IP.

## 4) Phạm vi áp dụng giai đoạn sau (khuyến nghị)
1. Cache dữ liệu đọc nhiều:
   - Category tree
   - Product list/filter phổ biến
2. Pub/Sub cho notification/chat khi chạy nhiều backend instance.

## 5) Thiết kế kỹ thuật đề xuất
## Key naming convention
- `rl:login:{ip}`: rate limit login theo IP
- `rl:login-email:{email}`: rate limit login theo email
- `otp:attempt:{email}`: số lần nhập OTP sai
- `otp:cooldown:{email}`: thời gian chờ gửi/xác minh OTP
- `auth:refresh:allow:{userId}:{jti}`: refresh token đang hợp lệ
- `auth:refresh:deny:{jti}`: refresh token đã revoke

## TTL đề xuất
- Rate limit login: 15 phút
- Cooldown OTP: 60-120 giây
- Attempt OTP sai: 15 phút
- Refresh deny-list: bằng thời gian sống còn lại của refresh token

## 6) Lộ trình triển khai
## Phase 1 (nhanh, tác động lớn)
1. Dùng Redis cho rate-limit auth endpoints.
2. Chặn brute-force theo cả IP và email.
3. Trả thông báo lỗi thống nhất, không lộ user có tồn tại hay không.

## Phase 2 (siết phiên đăng nhập)
1. Thêm `jti` vào refresh token.
2. Mỗi lần refresh: rotate token cũ -> token mới.
3. Ghi revoke token cũ vào Redis deny-list.
4. Logout/reset password: revoke toàn bộ refresh token đang còn hiệu lực.

## Phase 3 (OTP/reset token hardening)
1. Thêm counter OTP sai trong Redis.
2. Khi vượt ngưỡng: khóa tạm xác minh OTP.
3. Kết hợp với hash token trong DB (không lưu plaintext token).

## 7) Biến môi trường cần thêm
```env
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=datn
AUTH_RL_WINDOW_SEC=900
AUTH_RL_MAX_LOGIN_IP=20
AUTH_RL_MAX_LOGIN_EMAIL=10
OTP_MAX_ATTEMPTS=5
OTP_COOLDOWN_SEC=90
```

## 8) Tiêu chí hoàn thành
1. Tấn công brute-force login bị giới hạn rõ ràng.
2. Refresh token cũ không dùng lại được sau khi rotate/logout.
3. OTP sai quá ngưỡng bị chặn tạm thời.
4. Không còn token nhạy cảm nằm trên URL query.

## 9) Ghi chú vận hành
- Redis nên bật persistence (AOF) nếu dùng cho revoke/session security.
- Production nên có auth cho Redis và giới hạn network access nội bộ.
- Có healthcheck + alert khi Redis timeout/down.

