import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'
import { backendUrl } from '../App'
import { formatPrice } from '../utils/priceFormat'
import { formatImageUrl } from '../utils/imageUtils'

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16']

const STATUS_STYLE = {
  'Order Placed': 'bg-sky-100 text-sky-700',
  Packing: 'bg-amber-100 text-amber-700',
  Shipped: 'bg-violet-100 text-violet-700',
  'Out for delivery': 'bg-orange-100 text-orange-700',
  Delivered: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-rose-100 text-rose-700',
}

const STATUS_LABEL = {
  'Order Placed': 'Đã đặt',
  Packing: 'Đóng gói',
  Shipped: 'Vận chuyển',
  'Out for delivery': 'Đang giao',
  Delivered: 'Đã giao',
  Cancelled: 'Đã hủy',
}

const fmtK = (value) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return String(value)
}

const RevenueTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-semibold text-slate-700">{label}</p>
      {payload.map((item, index) => (
        <p key={index} style={{ color: item.color }}>
          {item.name === 'revenue' ? 'Doanh thu' : item.name === 'orders' ? 'Đơn hàng' : item.name}:{' '}
          <strong>{item.name === 'revenue' ? formatPrice(item.value) : item.value}</strong>
        </p>
      ))}
    </div>
  )
}

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p style={{ color: payload[0].payload.fill }} className="font-semibold">
        {payload[0].name}
      </p>
      <p className="text-slate-600">
        {payload[0].value} sản phẩm ({payload[0].payload.pct}%)
      </p>
    </div>
  )
}

const StatCard = ({ label, value, sub, icon, bg }) => (
  <div className="admin-card p-4">
    <div className="flex items-center gap-3">
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg text-lg ${bg}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="truncate text-lg font-bold text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  </div>
)

const ChartCard = ({ title, subtitle, children }) => (
  <div className="admin-card p-5">
    <h3 className="text-base font-semibold text-slate-800">{title}</h3>
    {subtitle ? <p className="mb-4 mt-0.5 text-xs text-slate-500">{subtitle}</p> : <div className="mb-4" />}
    {children}
  </div>
)

const Stats = ({ token }) => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [productRankMode, setProductRankMode] = useState('top')

  const fetchStats = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const response = await axios.get(`${backendUrl}/api/order/vendor-stats`, { headers: { token } })
      if (response.data.success) {
        setStats(response.data.stats)
      } else {
        toast.error(response.data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể tải thống kê')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  if (loading) {
    return (
      <div className="admin-card flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500">Đang tải thống kê...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="admin-card flex h-64 flex-col items-center justify-center text-slate-400">
        <p>Không có dữ liệu thống kê</p>
        <button type="button" onClick={fetchStats} className="mt-2 text-sm font-medium text-pink-600 hover:underline">
          Thử lại
        </button>
      </div>
    )
  }

  const periodRevenue = {
    today: stats.revenue.today,
    week: stats.revenue.week,
    month: stats.revenue.month,
    total: stats.revenue.total,
  }
  const periodLabel = {
    today: 'Hôm nay',
    week: '7 ngày',
    month: 'Tháng này',
    total: 'Tất cả',
  }

  const pieTotal = stats.products.categoryChart.reduce((sum, item) => sum + item.value, 0)
  const pieData = stats.products.categoryChart.map((item) => ({
    ...item,
    pct: pieTotal > 0 ? Math.round((item.value / pieTotal) * 100) : 0,
  }))

  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct }) => {
    if (pct < 5) return null
    const radian = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * radian)
    const y = cy + radius * Math.sin(-midAngle * radian)
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="600">
        {pct}%
      </text>
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="admin-page-title">Thống kê cửa hàng</h1>
          <p className="admin-page-subtitle">Tổng quan doanh thu, đơn hàng và hiệu suất sản phẩm.</p>
        </div>
        <button type="button" onClick={fetchStats} className="admin-btn-secondary self-start sm:self-auto">
          Làm mới
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Hôm nay" value={formatPrice(stats.revenue.today)} icon="₫" bg="bg-sky-100 text-sky-700" />
        <StatCard label="7 ngày qua" value={formatPrice(stats.revenue.week)} icon="7d" bg="bg-violet-100 text-violet-700" />
        <StatCard label="Tháng này" value={formatPrice(stats.revenue.month)} icon="30d" bg="bg-emerald-100 text-emerald-700" />
        <StatCard label="Tổng doanh thu" value={formatPrice(stats.revenue.total)} icon="Σ" bg="bg-amber-100 text-amber-700" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Sản phẩm"
          value={stats.products.total}
          icon="SP"
          bg="bg-indigo-100 text-indigo-700"
          sub={stats.products.lowStock > 0 ? `${stats.products.lowStock} sắp hết hàng` : 'Kho ổn định'}
        />
        <StatCard label="Tổng tồn kho" value={stats.products.totalStock} icon="Kho" bg="bg-cyan-100 text-cyan-700" />
        <StatCard
          label="Tổng đơn hàng"
          value={stats.orders.total}
          icon="Đơn"
          bg="bg-orange-100 text-orange-700"
          sub={`${stats.orders.byStatus?.Delivered || 0} đã giao thành công`}
        />
        <StatCard
          label="Đơn đã hủy"
          value={stats.orders.byStatus?.Cancelled || 0}
          icon="Hủy"
          bg="bg-rose-100 text-rose-700"
          sub="Toàn thời gian"
        />
      </div>

      <ChartCard title="Doanh thu theo ngày" subtitle="30 ngày gần nhất (không tính đơn hủy)">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-lg bg-sky-50 px-4 py-2">
            <span className="text-xs text-sky-600">{periodLabel[period]}: </span>
            <span className="text-base font-bold text-sky-700">{formatPrice(periodRevenue[period])}</span>
          </div>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {['today', 'week', 'month', 'total'].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPeriod(item)}
                className={`rounded px-3 py-1 text-xs font-medium transition ${
                  period === item ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {periodLabel[item]}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={stats.revenue.chart} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => {
                const date = new Date(value)
                return `${date.getDate()}/${date.getMonth() + 1}`
              }}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              interval={4}
            />
            <YAxis
              tickFormatter={fmtK}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={42}
            />
            <Tooltip content={<RevenueTooltip />} />
            <Line
              type="monotone"
              dataKey="revenue"
              name="revenue"
              stroke="#ec4899"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: '#ec4899' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Đơn hàng theo tháng" subtitle="12 tháng gần nhất (xanh: số đơn, cam: doanh thu)">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={stats.orders.monthlyChart} margin={{ top: 5, right: 10, left: 10, bottom: 5 }} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <YAxis
              yAxisId="left"
              orientation="left"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={fmtK}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={42}
            />
            <Tooltip content={<RevenueTooltip />} />
            <Legend formatter={(value) => (value === 'orders' ? 'Số đơn' : 'Doanh thu')} wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="orders" name="orders" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar yAxisId="right" dataKey="revenue" name="revenue" fill="#fb923c" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Tỷ lệ danh mục sản phẩm" subtitle="Theo số lượng sản phẩm đang bán">
          {pieData.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-400">Chưa có sản phẩm nào</p>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
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
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              <div className="flex min-w-0 flex-1 flex-col gap-2 text-xs">
                {pieData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                    <span className="flex-1 truncate text-slate-600">{item.name}</span>
                    <span className="font-semibold text-slate-800">{item.value}</span>
                    <span className="w-8 text-right text-slate-400">{item.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title={productRankMode === 'top' ? 'Top sản phẩm bán chạy' : 'Sản phẩm bán chậm'}
          subtitle={
            productRankMode === 'top'
              ? 'Xếp hạng theo số lượng đã bán'
              : 'Sản phẩm đang hoạt động có lượng bán thấp nhất'
          }
        >
          <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setProductRankMode('top')}
              className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition ${
                productRankMode === 'top' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Bán chạy
            </button>
            <button
              type="button"
              onClick={() => setProductRankMode('slow')}
              className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition ${
                productRankMode === 'slow' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Bán chậm
            </button>
          </div>

          {(() => {
            const rankingList = productRankMode === 'top' ? stats.products.topSelling : (stats.products.slowSelling ?? [])
            if (rankingList.length === 0) {
              return (
                <p className="py-10 text-center text-xs text-slate-400">
                  {productRankMode === 'top'
                    ? 'Chưa có dữ liệu bán hàng'
                    : 'Không có sản phẩm đang hoạt động để hiển thị'}
                </p>
              )
            }
            return (
              <div className="space-y-3">
                {rankingList.map((product, index) => (
                  <div key={product._id?.toString?.() ?? `${productRankMode}-${product.name}-${index}`} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {index + 1}
                    </span>
                    {product.image && (
                      <img src={formatImageUrl(product.image, { variant: "thumb", width: 96, height: 96, fit: "cover", quality: 76, format: "webp" })} alt={product.name} className="h-9 w-9 flex-shrink-0 rounded border border-slate-200 object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{product.name}</p>
                      <p className="text-xs text-slate-500">
                        {productRankMode === 'slow'
                          ? `Tồn: ${product.stock ?? 0} · ${formatPrice(product.revenue)}`
                          : formatPrice(product.revenue)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${productRankMode === 'slow' ? 'text-amber-700' : 'text-pink-600'}`}>{product.sold}</p>
                      <p className="text-xs text-slate-400">đã bán</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </ChartCard>
      </div>

      <ChartCard
        title="Sản phẩm sắp hết hàng"
        subtitle={`Ngưỡng tồn ≤ 5 · ${stats.products.lowStock ?? 0} sản phẩm (tối đa 20)`}
      >
        {(stats.products.lowStockItems ?? []).length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-400">Không có sản phẩm nào dưới ngưỡng tồn kho</p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {(stats.products.lowStockItems ?? []).map((product) => (
              <div
                key={product._id?.toString?.() ?? product.name}
                className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/60 px-2 py-2"
              >
                {product.image && (
                  <img src={formatImageUrl(product.image, { variant: "thumb", width: 96, height: 96, fit: "cover", quality: 76, format: "webp" })} alt={product.name} className="h-9 w-9 flex-shrink-0 rounded border border-amber-100 object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{product.name}</p>
                  {!product.isActive && <p className="text-[10px] text-slate-400">Đang ẩn</p>}
                </div>
                <span
                  className={`rounded-md px-2 py-1 text-xs font-bold tabular-nums ${
                    (product.stock ?? 0) === 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {product.stock ?? 0} còn
                </span>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      <ChartCard title="Đơn hàng gần đây">
        {stats.orders.recent.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">Chưa có đơn hàng nào</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="pb-2 text-left font-semibold">Mã đơn</th>
                  <th className="pb-2 text-left font-semibold">Ngày</th>
                  <th className="pb-2 text-left font-semibold">Số SP</th>
                  <th className="pb-2 text-right font-semibold">Doanh thu</th>
                  <th className="pb-2 text-right font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.orders.recent.map((order) => (
                  <tr key={order._id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">
                      #{order._id.toString().slice(-6).toUpperCase()}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-slate-600">{new Date(order.date).toLocaleDateString('vi-VN')}</td>
                    <td className="py-2.5 pr-3 text-xs text-slate-600">{order.itemCount} sp</td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-slate-800">{formatPrice(order.amount)}</td>
                    <td className="py-2.5 text-right">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[order.status] || 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABEL[order.status] || order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </section>
  )
}

export default Stats
