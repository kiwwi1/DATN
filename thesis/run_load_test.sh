#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# run_load_test.sh — Chạy kiểm thử tải k6 cho đồ án
#
# Cách dùng:
#   chmod +x run_load_test.sh
#   ./run_load_test.sh
#
# Trước khi chạy, điền PRODUCT_ID và TOKEN vào hai biến bên dưới.
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. Cấu hình — BẮT BUỘC PHẢI THAY ────────────────────────────────────────
PRODUCT_ID="THAY_BANG_PRODUCT_ID_THAT"     # lấy từ URL trang sản phẩm trong admin
TOKEN="THAY_BANG_JWT_TOKEN_ADMIN"           # lấy từ localStorage hoặc cookie sau khi login
VARIANT_KEY=""                              # để trống nếu sản phẩm không có biến thể
BASE_URL="http://localhost:4000"

# ── 2. Kiểm tra k6 đã cài chưa ───────────────────────────────────────────────
if ! command -v k6 &> /dev/null; then
  echo "❌  k6 chưa được cài. Đang cài đặt..."
  sudo snap install k6
  echo "✅  Cài xong k6."
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K6_SCRIPT="$SCRIPT_DIR/k6_concurrency.js"

# ── 3. Kiểm tra biến bắt buộc ────────────────────────────────────────────────
if [ "$PRODUCT_ID" = "THAY_BANG_PRODUCT_ID_THAT" ] || [ -z "$PRODUCT_ID" ]; then
  echo "❌  Vui lòng điền PRODUCT_ID vào file run_load_test.sh trước khi chạy."
  exit 1
fi

if [ "$TOKEN" = "THAY_BANG_JWT_TOKEN_ADMIN" ] || [ -z "$TOKEN" ]; then
  echo "❌  Vui lòng điền TOKEN vào file run_load_test.sh trước khi chạy."
  exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  KIỂM THỬ TẢI — Atomic Stock Reservation Concurrency"
echo "  Product ID : $PRODUCT_ID"
echo "  Backend    : $BASE_URL"
echo "════════════════════════════════════════════════════════════════"

# ── 4. Scenario 1: Tải trung bình — 100 yêu cầu đồng thời, kho 20 ───────────
echo ""
echo "▶  SCENARIO 1: Tải trung bình (100 VUs, kho ban đầu = 20)"
echo "────────────────────────────────────────────────────────────────"

k6 run \
  -e PRODUCT_ID="$PRODUCT_ID" \
  -e VARIANT_KEY="$VARIANT_KEY" \
  -e TOKEN="$TOKEN" \
  -e BASE_URL="$BASE_URL" \
  -e NUM_REQUESTS=100 \
  -e INITIAL_STOCK=20 \
  --no-color \
  "$K6_SCRIPT" 2>&1 | tee /tmp/k6_scenario1.txt

echo ""
sleep 3   # chờ DB ổn định trước khi chạy scenario tiếp

# ── 5. Scenario 2: Tải cao — 250 yêu cầu đồng thời, kho 50 ──────────────────
echo "▶  SCENARIO 2: Tải cao (250 VUs, kho ban đầu = 50)"
echo "────────────────────────────────────────────────────────────────"

k6 run \
  -e PRODUCT_ID="$PRODUCT_ID" \
  -e VARIANT_KEY="$VARIANT_KEY" \
  -e TOKEN="$TOKEN" \
  -e BASE_URL="$BASE_URL" \
  -e NUM_REQUESTS=250 \
  -e INITIAL_STOCK=50 \
  --no-color \
  "$K6_SCRIPT" 2>&1 | tee /tmp/k6_scenario2.txt

# ── 6. Tổng hợp ───────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  HOÀN TẤT — Kết quả được lưu tại:"
echo "    Scenario 1: /tmp/k6_scenario1.txt"
echo "    Scenario 2: /tmp/k6_scenario2.txt"
echo "  Sao chép các số liệu vào Bảng 4.x trong đồ án."
echo "════════════════════════════════════════════════════════════════"
echo ""
