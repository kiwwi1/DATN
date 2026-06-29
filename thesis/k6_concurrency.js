/**
 * k6 Load Test — Atomic Stock Reservation under High Concurrency
 *
 * Usage:
 *   k6 run -e PRODUCT_ID=<id> -e TOKEN=<jwt> -e NUM_REQUESTS=100 -e INITIAL_STOCK=20 k6_concurrency.js
 *
 * Output: prints a summary table matching the thesis report format.
 */

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// ── Custom metrics (per concurrent operation, not per HTTP request) ──────────
const opDuration   = new Trend('op_duration_ms', true);   // individual op latency
const successCnt   = new Counter('orders_success');
const outOfStockCnt = new Counter('orders_out_of_stock');
const duplicateCnt = new Counter('orders_duplicate');
const oversellRate = new Rate('oversell_detected');

// ── Parameters from environment variables ────────────────────────────────────
const NUM_REQUESTS  = parseInt(__ENV.NUM_REQUESTS  || '100');
const INITIAL_STOCK = parseInt(__ENV.INITIAL_STOCK || '20');
const PRODUCT_ID    = __ENV.PRODUCT_ID || '';
const VARIANT_KEY   = __ENV.VARIANT_KEY || '';
const TOKEN         = __ENV.TOKEN       || '';
const BASE_URL      = __ENV.BASE_URL    || 'http://localhost:4000';

// ── k6 options: single VU, single iteration (concurrency is inside backend) ──
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    'op_duration_ms': ['p(95) < 3000'],
    'http_req_failed': ['rate == 0'],
  },
};

// ── Main test function ────────────────────────────────────────────────────────
export default function () {
  if (!PRODUCT_ID || !TOKEN) {
    console.error('ERROR: PRODUCT_ID and TOKEN are required. Pass via -e flag.');
    return;
  }

  const payload = JSON.stringify({
    productId:       PRODUCT_ID,
    variantKey:      VARIANT_KEY,
    numRequests:     NUM_REQUESTS,
    initialStock:    INITIAL_STOCK,
    idempotencyMode: 'unique',          // unique key per request = pure stock contention
  });

  const wallStart = Date.now();

  const res = http.post(
    `${BASE_URL}/api/simulation/concurrency`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'token': TOKEN,
      },
      timeout: '120s',
    }
  );

  const wallTime = Date.now() - wallStart;   // total wall-clock time for all N concurrent ops

  // ── Basic HTTP checks ───────────────────────────────────────────────────────
  const ok = check(res, {
    'HTTP 200':          (r) => r.status === 200,
    'success:true':      (r) => { try { return r.json('success') === true; } catch { return false; } },
  });

  if (!ok || res.status !== 200) {
    console.error(`Request failed — HTTP ${res.status}: ${res.body}`);
    return;
  }

  // ── Parse response body ─────────────────────────────────────────────────────
  const body    = res.json();
  const stats   = body.stats   || {};
  const results = body.results || [];

  // ── Record per-operation durations into k6 custom metric ───────────────────
  results.forEach(r => {
    if (typeof r.duration === 'number') {
      opDuration.add(r.duration);
    }
  });

  // ── Record business-logic counters ──────────────────────────────────────────
  successCnt.add(stats.success     || 0);
  outOfStockCnt.add(stats.outOfStock || 0);
  duplicateCnt.add(stats.duplicate  || 0);

  const leaked = stats.stockLeak || 0;
  oversellRate.add(leaked > 0 ? 1 : 0);

  // ── Compute per-operation latency stats from results array ──────────────────
  const durations = results.map(r => r.duration).filter(d => typeof d === 'number');
  const avgDur    = durations.length > 0
    ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)
    : 'N/A';
  const minDur    = durations.length > 0 ? Math.min(...durations) : 'N/A';
  const maxDur    = durations.length > 0 ? Math.max(...durations) : 'N/A';
  const throughput = wallTime > 0
    ? (NUM_REQUESTS / (wallTime / 1000)).toFixed(2)
    : 'N/A';
  const oversellPct = leaked === 0
    ? '0.00%'
    : ((leaked / INITIAL_STOCK) * 100).toFixed(2) + '%';

  // ── Print thesis-format summary table ──────────────────────────────────────
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  KẾT QUẢ KIỂM THỬ TẢI — ${NUM_REQUESTS} VUs / Kho ban đầu: ${INITIAL_STOCK}`.padEnd(63) + '║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Yêu cầu đồng thời:              ${String(stats.total).padEnd(28)}║`);
  console.log(`║  Tồn kho ban đầu:                ${String(stats.initialStock).padEnd(28)}║`);
  console.log(`║  Đơn hàng thành công:             ${String(stats.success).padEnd(27)}║`);
  console.log(`║  Từ chối (Hết hàng):              ${String(stats.outOfStock).padEnd(27)}║`);
  console.log(`║  Tỉ lệ bán vượt (Oversell Rate):  ${String(oversellPct).padEnd(26)}║`);
  console.log(`║  Tổng thời gian thực thi:         ${String(wallTime + ' ms').padEnd(27)}║`);
  console.log(`║  Latency trung bình (Avg):        ${String(avgDur + ' ms').padEnd(27)}║`);
  console.log(`║  Latency nhanh nhất (Min):        ${String(minDur + ' ms').padEnd(27)}║`);
  console.log(`║  Latency chậm nhất (Max):         ${String(maxDur + ' ms').padEnd(27)}║`);
  console.log(`║  Thông lượng (Throughput):        ${String(throughput + ' reqs/s').padEnd(27)}║`);
  console.log(`║  Tồn kho cuối trong DB:           ${String(stats.finalStock).padEnd(27)}║`);
  console.log(`║  Stock Leak (Oversell count):     ${String(leaked + ' đơn').padEnd(27)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
}
