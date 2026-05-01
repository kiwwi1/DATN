import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { backendUrl } from '../App'
import { formatPrice } from '../utils/priceFormat'
import { formatImageUrl } from '../utils/imageUtils'
import { toast } from 'react-toastify'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// ── Colour palette ─────────────────────────────────────────────────────────────
const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16']

const STATUS_STYLE = {
  'Order Placed':     'bg-blue-50 text-blue-600',
  'Packing':          'bg-yellow-50 text-yellow-600',
  'Shipped':          'bg-purple-50 text-purple-600',
  'Out for delivery': 'bg-orange-50 text-orange-600',
  'Delivered':        'bg-green-50 text-green-700',
  'Cancelled':        'bg-red-50 text-red-500',
}
const STATUS_VN = {
  'Order Placed':     'Đã đặt',
  'Packing':          'Đóng gói',
  'Shipped':          'Vận chuyển',
  'Out for delivery': 'Đang giao',
  'Delivered':        'Đã giao',
  'Cancelled':        'Đã huỷ',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtK = (v) => {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)         return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

// ── Custom tooltip for line/bar ────────────────────────────────────────────────
const RevenueTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name === 'revenue' ? 'Doanh thu' : p.name === 'orders' ? 'Đơn hàng' : p.name}: <strong>
            {p.name === 'revenue' ? formatPrice(p.value) : p.value}
          </strong>
        </p>
      ))}
    </div>
  )
}

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p style={{ color: payload[0].payload.fill }} className="font-semibold">{payload[0].name}</p>
      <p className="text-gray-600">{payload[0].value} sản phẩm ({payload[0].payload.pct}%)</p>
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon, bg }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${bg}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-gray-800 mt-0.5 truncate">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
)

// ── Chart Card wrapper ─────────────────────────────────────────────────────────
const ChartCard = ({ title, subtitle, children }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
    <h3 className="font-semibold text-gray-800">{title}</h3>
    {subtitle && <p className="text-xs text-gray-400 mt-0.5 mb-4">{subtitle}</p>}
    {!subtitle && <div className="mb-4" />}
    {children}
  </div>
)

// ── Main ───────────────────────────────────────────────────────────────────────
const Stats = ({ token }) => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [productRankMode, setProductRankMode] = useState('top')

  const fetchStats = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await axios.get(backendUrl + '/api/order/vendor-stats', { headers: { token } })
      if (res.data.success) setStats(res.data.stats)
      else toast.error(res.data.message)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể tải thống kê')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchStats() }, [fetchStats])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          <p className="text-sm text-gray-500 mt-3">Đang tải thống kê...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <p>Không có dữ liệu thống kê</p>
        <button onClick={fetchStats} className="mt-3 text-blue-500 text-sm hover:underline">Thử lại</button>
      </div>
    )
  }

  const periodRevenue = { today: stats.revenue.today, week: stats.revenue.week, month: stats.revenue.month, total: stats.revenue.total }
  const periodLabel   = { today: 'Hôm nay', week: '7 ngày', month: 'Tháng này', total: 'Tất cả' }

  // Pie data with percent
  const pieTotal = stats.products.categoryChart.reduce((s, d) => s + d.value, 0)
  const pieData  = stats.products.categoryChart.map(d => ({
    ...d,
    pct: pieTotal > 0 ? Math.round((d.value / pieTotal) * 100) : 0,
  }))

  // Custom label for pie
  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct }) => {
    if (pct < 5) return null
    const RADIAN = Math.PI / 180
    const r = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + r * Math.cos(-midAngle * RADIAN)
    const y = cy + r * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="600">
        {pct}%
      </text>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Thống kê cửa hàng</h2>
          <p className="text-sm text-gray-400 mt-0.5">Tổng quan doanh thu và hoạt động kinh doanh</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors self-start sm:self-auto"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Làm mới
        </button>
      </div>

      {/* ── Revenue KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Hôm nay"        value={formatPrice(stats.revenue.today)} icon="📅" bg="bg-blue-50" />
        <StatCard label="7 ngày qua"     value={formatPrice(stats.revenue.week)}  icon="📆" bg="bg-purple-50" />
        <StatCard label="Tháng này"      value={formatPrice(stats.revenue.month)} icon="🗓️" bg="bg-green-50" />
        <StatCard label="Tổng doanh thu" value={formatPrice(stats.revenue.total)} icon="💰" bg="bg-yellow-50" />
      </div>

      {/* ── Product + Order KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Sản phẩm"      value={stats.products.total}      icon="📦" bg="bg-indigo-50"
          sub={stats.products.lowStock > 0 ? `${stats.products.lowStock} sắp hết hàng ⚠️` : 'Kho đủ hàng ✓'} />
        <StatCard label="Tổng tồn kho"  value={stats.products.totalStock} icon="🏪" bg="bg-cyan-50" />
        <StatCard label="Tổng đơn hàng" value={stats.orders.total}        icon="🛒" bg="bg-orange-50"
          sub={`${stats.orders.byStatus?.Delivered || 0} đã giao thành công`} />
        <StatCard label="Đơn đã huỷ"   value={stats.orders.byStatus?.Cancelled || 0} icon="❌" bg="bg-red-50"
          sub="Tất cả thời gian" />
      </div>

      {/* ── 1. Line chart: Doanh thu theo ngày ── */}
      <ChartCard
        title="📈 Doanh thu theo ngày"
        subtitle="30 ngày gần nhất (không tính đơn huỷ)"
      >
        {/* Period selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-4 py-2">
            <span className="text-xs text-blue-500 font-medium">{periodLabel[period]}:</span>
            <span className="text-base font-bold text-blue-700">{formatPrice(periodRevenue[period])}</span>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {['today','week','month','total'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${period === p ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {periodLabel[p]}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={stats.revenue.chart} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth()+1}` }}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              interval={4}
            />
            <YAxis
              tickFormatter={fmtK}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              width={42}
            />
            <Tooltip content={<RevenueTooltip />} />
            <Line
              type="monotone"
              dataKey="revenue"
              name="revenue"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: '#3b82f6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── 2. Bar chart: Đơn hàng theo tháng ── */}
      <ChartCard
        title="📊 Đơn hàng theo tháng"
        subtitle="12 tháng gần nhất (cột xanh = số đơn, cột cam = doanh thu)"
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={stats.orders.monthlyChart} margin={{ top: 5, right: 10, left: 10, bottom: 5 }} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
            <YAxis
              yAxisId="left"
              orientation="left"
              tickFormatter={(v) => v}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={fmtK}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              width={42}
            />
            <Tooltip content={<RevenueTooltip />} />
            <Legend
              formatter={(value) => value === 'orders' ? 'Số đơn' : 'Doanh thu'}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Bar yAxisId="left"  dataKey="orders"  name="orders"  fill="#3b82f6" radius={[4,4,0,0]} maxBarSize={24} />
            <Bar yAxisId="right" dataKey="revenue" name="revenue" fill="#f97316" radius={[4,4,0,0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── 3. Pie chart + Top products ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie: Tỷ lệ danh mục sản phẩm */}
        <ChartCard title="🥧 Tỷ lệ danh mục sản phẩm" subtitle="Theo số lượng sản phẩm đang bán">
          {pieData.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-10">Chưa có sản phẩm nào</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={88}
                    paddingAngle={2}
                    dataKey="value"
                    labelLine={false}
                    label={renderPieLabel}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="flex flex-col gap-2 text-xs flex-1 min-w-0">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-gray-600 truncate flex-1">{d.name}</span>
                    <span className="font-semibold text-gray-800">{d.value}</span>
                    <span className="text-gray-400 w-8 text-right">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        {/* Top / slow selling products */}
        <ChartCard
          title={productRankMode === 'top' ? '🏆 Top sản phẩm bán chạy' : '🐢 Sản phẩm bán chậm'}
          subtitle={productRankMode === 'top'
            ? 'Xếp hạng theo số lượng đã bán'
            : 'Sản phẩm đang bán (đang hoạt động), ít lượt bán nhất'}
        >
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4">
            <button
              type="button"
              onClick={() => setProductRankMode('top')}
              className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                productRankMode === 'top' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Bán chạy
            </button>
            <button
              type="button"
              onClick={() => setProductRankMode('slow')}
              className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                productRankMode === 'slow' ? 'bg-white shadow text-amber-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Bán chậm
            </button>
          </div>
          {(() => {
            const list = productRankMode === 'top'
              ? stats.products.topSelling
              : (stats.products.slowSelling ?? [])
            if (list.length === 0) {
              return (
                <p className="text-xs text-gray-400 text-center py-10">
                  {productRankMode === 'top' ? 'Chưa có dữ liệu bán hàng' : 'Không có sản phẩm đang hoạt động để hiển thị'}
                </p>
              )
            }
            return (
              <div className="space-y-3">
                {list.map((p, i) => (
                  <div key={p._id?.toString?.() ?? `${productRankMode}-${p.name}-${i}`} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                      productRankMode === 'slow'
                        ? i === 0 ? 'bg-amber-100 text-amber-700'
                          : i === 1 ? 'bg-orange-50 text-orange-600'
                            : i === 2 ? 'bg-yellow-50 text-yellow-700'
                              : 'bg-gray-50 text-gray-400'
                        : i === 0 ? 'bg-yellow-100 text-yellow-600'
                          : i === 1 ? 'bg-gray-200 text-gray-600'
                            : i === 2 ? 'bg-orange-100 text-orange-600'
                              : 'bg-gray-50 text-gray-400'}`}>{i + 1}</span>
                    {p.image && <img src={formatImageUrl(p.image)} alt={p.name} className="w-9 h-9 object-cover rounded border flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">
                        {productRankMode === 'slow'
                          ? `Tồn: ${p.stock ?? 0} · ${formatPrice(p.revenue)}`
                          : formatPrice(p.revenue)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${productRankMode === 'slow' ? 'text-amber-700' : 'text-blue-600'}`}>{p.sold}</p>
                      <p className="text-xs text-gray-400">đã bán</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </ChartCard>
      </div>

      <ChartCard
        title="⚠️ Sản phẩm sắp hết hàng"
        subtitle={`Ngưỡng tồn ≤ 5 · ${stats.products.lowStock ?? 0} sản phẩm (hiển thị tối đa 20, ưu tiên tồn thấp nhất)`}
      >
        {(stats.products.lowStockItems ?? []).length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-10">Không có sản phẩm nào dưới ngưỡng tồn kho</p>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {(stats.products.lowStockItems ?? []).map((p) => (
              <div key={p._id?.toString?.() ?? p.name} className="flex items-center gap-3 rounded-lg border border-amber-100/80 bg-amber-50/40 px-2 py-2">
                {p.image && <img src={formatImageUrl(p.image)} alt={p.name} className="w-9 h-9 object-cover rounded border border-amber-100 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                  {!p.isActive && <p className="text-[10px] text-gray-400">Đang ẩn</p>}
                </div>
                <span
                  className={`flex-shrink-0 text-xs font-bold tabular-nums px-2 py-1 rounded-md ${
                    (p.stock ?? 0) === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {p.stock ?? 0} còn
                </span>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      {/* ── Recent Orders table ── */}
      <ChartCard title="🕒 Đơn hàng gần đây">
        {stats.orders.recent.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">Chưa có đơn hàng nào</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b">
                  <th className="text-left pb-2 font-medium">Mã đơn</th>
                  <th className="text-left pb-2 font-medium">Ngày</th>
                  <th className="text-left pb-2 font-medium">Số SP</th>
                  <th className="text-right pb-2 font-medium">Doanh thu</th>
                  <th className="text-right pb-2 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.orders.recent.map((o) => (
                  <tr key={o._id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 pr-3 font-mono text-xs text-gray-500">
                      #{o._id.toString().slice(-6).toUpperCase()}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-gray-600">
                      {new Date(o.date).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-gray-600">{o.itemCount} sp</td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-gray-800">
                      {formatPrice(o.amount)}
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[o.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_VN[o.status] || o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  )
}

export default Stats
