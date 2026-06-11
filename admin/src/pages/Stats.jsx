import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  'Order Placed': 'bg-sky-50 text-sky-700 border border-sky-100',
  Packing: 'bg-amber-50 text-amber-700 border border-amber-100',
  Shipped: 'bg-violet-50 text-violet-700 border border-violet-100',
  'Out for delivery': 'bg-orange-50 text-orange-700 border border-orange-100',
  Delivered: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  Cancelled: 'bg-rose-50 text-rose-700 border border-rose-100',
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
    <div className="rounded-xl border border-slate-150 bg-white/95 backdrop-blur-sm px-3.5 py-2.5 text-xs shadow-md">
      <p className="mb-1.5 font-bold text-slate-800">{label}</p>
      {payload.map((item, index) => {
        let nameLabel = item.name
        if (item.name === 'revenue' || item.name === 'gross') nameLabel = 'Doanh thu thô'
        else if (item.name === 'netRevenue' || item.name === 'net') nameLabel = 'Doanh thu thực nhận'
        else if (item.name === 'orders') nameLabel = 'Đơn hàng'
        return (
          <p key={index} style={{ color: item.color }} className="flex items-center gap-1.5 py-0.5">
            <span className="font-medium text-slate-500">{nameLabel}:</span>
            <span className="font-bold">{item.name === 'orders' ? item.value : formatPrice(item.value)}</span>
          </p>
        )
      })}
    </div>
  )
}

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-150 bg-white/95 backdrop-blur-sm px-3.5 py-2.5 text-xs shadow-md">
      <p style={{ color: payload[0].payload.fill }} className="font-bold text-sm mb-1">
        {payload[0].name}
      </p>
      <p className="text-slate-600 font-medium">
        Số lượng: <span className="font-bold text-slate-800">{payload[0].value} sản phẩm</span> ({payload[0].payload.pct}%)
      </p>
    </div>
  )
}

const StatCard = ({ label, value, sub, netValue, icon, bg, onClick }) => (
  <div 
    onClick={onClick}
    className={`admin-card p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-in-out ${
      onClick ? 'cursor-pointer hover:border-pink-300' : ''
    }`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="truncate text-xl font-bold text-slate-800 mt-1">{value}</p>
        {netValue && (
          <p className="text-[11px] font-bold text-emerald-600 mt-1.5">
            Thực nhận: <span className="font-extrabold">{netValue}</span>
          </p>
        )}
        {sub && <p className="text-xs font-semibold text-slate-400 mt-2 flex items-center gap-1">{sub}</p>}
      </div>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm border border-slate-100 ${bg}`}>
        {icon}
      </div>
    </div>
  </div>
)

const ChartCard = ({ title, subtitle, children }) => (
  <div className="admin-card p-5 hover:shadow-sm transition-all duration-200">
    <h3 className="text-base font-bold text-slate-800 tracking-tight">{title}</h3>
    {subtitle ? <p className="mb-5 mt-1 text-xs text-slate-400 leading-normal font-medium">{subtitle}</p> : <div className="mb-4" />}
    {children}
  </div>
)

const Stats = ({ token }) => {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [productRankMode, setProductRankMode] = useState('top')

  const [startDateInput, setStartDateInput] = useState('')
  const [endDateInput, setEndDateInput] = useState('')
  const [activeDateRange, setActiveDateRange] = useState({ start: '', end: '' })

  const fetchStats = useCallback(async (customRange) => {
    if (!token) return
    setLoading(true)
    try {
      const params = {}
      const range = customRange || activeDateRange
      if (range.start) params.startDate = new Date(range.start).getTime()
      if (range.end) params.endDate = new Date(range.end).getTime() + (24 * 60 * 60 * 1000 - 1)

      const response = await axios.get(`${backendUrl}/api/order/vendor-stats`, {
        headers: { token },
        params,
      })
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
  }, [token, activeDateRange])

  useEffect(() => {
    fetchStats()
  }, [token])

  const handleApplyFilter = () => {
    if (startDateInput && endDateInput && new Date(startDateInput) > new Date(endDateInput)) {
      toast.error('Ngày bắt đầu không thể lớn hơn ngày kết thúc')
      return
    }
    const newRange = { start: startDateInput, end: endDateInput }
    setActiveDateRange(newRange)
    fetchStats(newRange)
  }

  const handleClearFilter = () => {
    setStartDateInput('')
    setEndDateInput('')
    const newRange = { start: '', end: '' }
    setActiveDateRange(newRange)
    fetchStats(newRange)
  }

  const exportToCSV = (data, headers, filename) => {
    const csvRows = []
    csvRows.push(headers.join(","))
    for (const row of data) {
      csvRows.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    }
    const csvContent = "\uFEFF" + csvRows.join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExportSalesReport = () => {
    if (!stats?.revenue?.chart) return
    const headers = ['Ngay', 'Doanh thu tho (VND)', 'Doanh thu thuc nhan (VND)']
    const data = stats.revenue.chart.map((point) => [
      point.date,
      point.revenue,
      point.netRevenue || 0,
    ])
    exportToCSV(data, headers, `bao_cao_doanh_thu_${activeDateRange.start || 'all'}_den_${activeDateRange.end || 'all'}.csv`)
  }

  const handleExportProductReport = () => {
    if (!stats?.products?.topSelling && !stats?.products?.slowSelling) return
    const headers = ['Ten san pham', 'So luong da ban', 'Doanh thu tho (VND)', 'Doanh thu thuc nhan (VND)']
    const productsMap = new Map()
    const addProduct = (p) => {
      const id = p._id || p.name
      if (!productsMap.has(id)) {
        productsMap.set(id, [p.name, p.sold || 0, p.revenue || 0, p.netRevenue || 0])
      }
    }
    ;(stats.products.topSelling || []).forEach(addProduct)
    ;(stats.products.slowSelling || []).forEach(addProduct)
    const data = Array.from(productsMap.values())
    exportToCSV(data, headers, 'bao_cao_hieu_suat_san_pham.csv')
  }

  if (loading) {
    return (
      <div className="admin-card flex h-64 items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600" />
          <p className="mt-3.5 text-sm font-semibold text-slate-500 animate-pulse">Đang tải thống kê cửa hàng...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="admin-card flex h-64 flex-col items-center justify-center text-slate-400 p-6 text-center">
        <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm font-medium text-slate-500">Không tìm thấy dữ liệu thống kê của cửa hàng</p>
        <button
          type="button"
          onClick={() => fetchStats()}
          className="mt-3 inline-flex items-center gap-1 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
        >
          Tải lại dữ liệu
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

  const periodNetRevenue = {
    today: stats.revenue.todayNet || 0,
    week: stats.revenue.weekNet || 0,
    month: stats.revenue.monthNet || 0,
    total: stats.revenue.totalNet || 0,
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
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="700">
        {pct}%
      </text>
    )
  }

  return (
    <section className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 bg-white p-5 rounded-2xl border border-slate-150 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="admin-page-title text-2xl font-bold tracking-tight text-slate-800">Thống kê cửa hàng</h1>
          <p className="admin-page-subtitle text-xs text-slate-400 mt-1 font-medium">Tổng quan doanh thu thô, thực nhận, tồn kho và các đơn hàng phát sinh.</p>
        </div>
        
        {/* Date Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Từ ngày</span>
              <input
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                className="admin-input py-1.5 px-2.5 rounded-lg border border-slate-200 focus:border-pink-500 text-xs"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Đến ngày</span>
              <input
                type="date"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
                className="admin-input py-1.5 px-2.5 rounded-lg border border-slate-200 focus:border-pink-500 text-xs"
              />
            </div>
          </div>
          <div className="flex gap-1.5 mt-auto pt-4 sm:pt-0">
            <button
              type="button"
              onClick={handleApplyFilter}
              className="admin-btn-primary py-1.5 px-3 text-xs font-bold rounded-lg shadow-sm"
            >
              Lọc
            </button>
            {(activeDateRange.start || activeDateRange.end) && (
              <button
                type="button"
                onClick={handleClearFilter}
                className="admin-btn-secondary py-1.5 px-3 text-xs font-bold rounded-lg hover:bg-slate-50"
              >
                Xóa lọc
              </button>
            )}
            <button
              type="button"
              onClick={() => fetchStats()}
              className="admin-btn-secondary flex items-center justify-center p-1.5 rounded-lg hover:bg-slate-50 shadow-sm"
              title="Làm mới"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 12H19c0 .72-.11 1.405-.316 2.052m-1.785-5.18L19 9h-5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Revenue Statistics Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Hiệu suất doanh thu</h2>
          <button
            type="button"
            onClick={handleExportSalesReport}
            className="text-[11px] font-bold text-pink-600 hover:text-pink-700 flex items-center gap-1 bg-pink-50/50 hover:bg-pink-50 border border-pink-100 px-2.5 py-1 rounded-lg shadow-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Xuất báo cáo doanh số
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Hôm nay"
            value={formatPrice(stats.revenue.today)}
            netValue={formatPrice(stats.revenue.todayNet || 0)}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            bg="bg-sky-50 text-sky-500"
          />
          <StatCard
            label="7 ngày qua"
            value={formatPrice(stats.revenue.week)}
            netValue={formatPrice(stats.revenue.weekNet || 0)}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
            bg="bg-violet-50 text-violet-500"
          />
          <StatCard
            label="Tháng này"
            value={formatPrice(stats.revenue.month)}
            netValue={formatPrice(stats.revenue.monthNet || 0)}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            bg="bg-emerald-50 text-emerald-500"
          />
          <StatCard
            label="Tổng doanh thu"
            value={formatPrice(stats.revenue.total)}
            netValue={formatPrice(stats.revenue.totalNet || 0)}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            bg="bg-amber-50 text-amber-500"
          />
        </div>
      </div>

      {/* Inventory & Order Statistics Grid */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Sản phẩm & Vận hành</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Sản phẩm đang bán"
            value={stats.products.total}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
            bg="bg-indigo-50 text-indigo-500"
            onClick={() => navigate('/list?visibility=visible')}
            sub={
              stats.products.lowStock > 0 ? (
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/list?stock=low_stock');
                  }}
                  className="flex items-center gap-1 cursor-pointer hover:text-amber-700 hover:underline"
                >
                  <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  <span className="text-amber-600 font-semibold">{stats.products.lowStock} sắp hết hàng</span>
                </span>
              ) : (
                'Kho ổn định'
              )
            }
          />
          <StatCard
            label="Tổng số lượng tồn"
            value={stats.products.totalStock}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
            bg="bg-cyan-50 text-cyan-500"
            onClick={() => navigate('/list')}
          />
          <StatCard
            label="Tổng số đơn hàng"
            value={stats.orders.total}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            }
            bg="bg-orange-50 text-orange-500"
            sub={`${stats.orders.byStatus?.Delivered || 0} đã giao thành công`}
            onClick={() => navigate('/orders')}
          />
          <StatCard
            label="Đơn đã hủy bỏ"
            value={stats.orders.byStatus?.Cancelled || 0}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            bg="bg-rose-50 text-rose-500"
            sub="Hủy toàn thời gian"
            onClick={() => navigate('/orders?status=Cancelled')}
          />
        </div>
      </div>

      {/* Revenue Line Chart Card */}
      <ChartCard title="Xu hướng doanh thu theo ngày" subtitle="Phân tích doanh thu thô và doanh thu thực nhận (không bao gồm các đơn hàng đã bị hủy)">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <div className="flex items-center gap-4 px-1 text-xs">
            <div>
              <span className="font-semibold text-slate-500">{periodLabel[period]} (Thô): </span>
              <span className="text-sm font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-xs ml-1">
                {formatPrice(periodRevenue[period])}
              </span>
            </div>
            <div>
              <span className="font-semibold text-slate-500">{periodLabel[period]} (Thực nhận): </span>
              <span className="text-sm font-bold text-emerald-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-xs ml-1">
                {formatPrice(periodNetRevenue[period])}
              </span>
            </div>
          </div>
          <div className="flex gap-1 bg-slate-200/60 p-1 rounded-lg">
            {['today', 'week', 'month', 'total'].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPeriod(item)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all duration-150 ${
                  period === item 
                    ? 'bg-white text-pink-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {periodLabel[item]}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={stats.revenue.chart} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => {
                const date = new Date(value)
                return `${date.getDate()}/${date.getMonth() + 1}`
              }}
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              dy={8}
              interval={stats.revenue.chart.length > 30 ? 6 : stats.revenue.chart.length > 15 ? 3 : 1}
            />
            <YAxis
              tickFormatter={fmtK}
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              dx={-8}
              width={42}
            />
            <Tooltip content={<RevenueTooltip />} />
            <Legend 
              formatter={(value) => (value === 'revenue' || value === 'gross' ? 'Doanh thu thô' : 'Doanh thu thực nhận')} 
              wrapperStyle={{ fontSize: 11, fontWeight: 600, pt: 10 }} 
            />
            <Line
              type="monotone"
              dataKey="revenue"
              name="gross"
              stroke="#ec4899"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: '#ec4899', stroke: '#fff', strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="netRevenue"
              name="net"
              stroke="#10b981"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Monthly Bar Chart Card */}
      <ChartCard title="Lượng đơn hàng & Doanh số theo tháng" subtitle="Hiệu suất 12 tháng gần nhất (cột xanh: lượng đơn hàng, cột cam: doanh thu tương ứng)">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={stats.orders.monthlyChart} margin={{ top: 5, right: 10, left: 10, bottom: 5 }} barGap={6}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }} tickLine={false} axisLine={false} dy={8} />
            <YAxis
              yAxisId="left"
              orientation="left"
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              dx={-8}
              width={30}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={fmtK}
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              dx={8}
              width={42}
            />
            <Tooltip content={<RevenueTooltip />} />
            <Legend 
              formatter={(value) => (value === 'orders' ? 'Số lượng đơn' : 'Doanh thu thô')} 
              wrapperStyle={{ fontSize: 11, fontWeight: 600, pt: 10 }} 
            />
            <Bar yAxisId="left" dataKey="orders" name="orders" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={20} />
            <Bar yAxisId="right" dataKey="revenue" name="revenue" fill="#fb923c" radius={[4, 4, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Double Column: Category Pie Chart and Product Ranking List */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        
        {/* Category Pie Chart Card */}
        <ChartCard title="Phân bố danh mục sản phẩm" subtitle="Theo tỉ lệ phần trăm số lượng sản phẩm đang đăng bán">
          {pieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <svg className="w-10 h-10 text-slate-350 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              <p className="text-xs font-semibold text-slate-400">Chưa có sản phẩm nào để phân tích danh mục</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 sm:flex-row justify-center py-2">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    labelLine={false}
                    label={renderPieLabel}
                  >
                    {pieData.map((item, index) => (
                      <Cell 
                        key={index} 
                        fill={PIE_COLORS[index % PIE_COLORS.length]} 
                        onClick={() => item.id && navigate(`/list?category=${item.id}`)}
                        className="cursor-pointer outline-none"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              <div className="flex min-w-0 flex-1 flex-col gap-2.5 text-xs w-full">
                {pieData.map((item, index) => (
                  <div 
                    key={index} 
                    onClick={() => item.id && navigate(`/list?category=${item.id}`)}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span className="h-3 w-3 flex-shrink-0 rounded-md" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                    <span className="flex-1 truncate font-semibold text-slate-600 hover:text-pink-650 transition-colors">{item.name}</span>
                    <span className="font-bold text-slate-800">{item.value} sp</span>
                    <span className="w-10 text-right text-slate-450 font-bold">{item.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        {/* Product Ranking List Card */}
        <ChartCard
          title={productRankMode === 'top' ? 'Top sản phẩm bán chạy nhất' : 'Danh sách sản phẩm bán chậm'}
          subtitle={
            productRankMode === 'top'
              ? 'Xếp hạng dựa trên lượng sản phẩm bán ra thành công'
              : 'Sản phẩm có hiệu suất bán hàng thấp nhất trong các sản phẩm đang hiển thị'
          }
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 flex-1 sm:flex-none">
              <button
                key="top-btn"
                type="button"
                onClick={() => setProductRankMode('top')}
                className={`flex-1 rounded-md py-1.5 px-3 text-xs font-bold transition-all duration-150 ${
                  productRankMode === 'top' 
                    ? 'bg-white text-pink-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Bán chạy
              </button>
              <button
                key="slow-btn"
                type="button"
                onClick={() => setProductRankMode('slow')}
                className={`flex-1 rounded-md py-1.5 px-3 text-xs font-bold transition-all duration-150 ${
                  productRankMode === 'slow' 
                    ? 'bg-white text-amber-700 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Bán chậm
              </button>
            </div>
            
            <button
              type="button"
              onClick={handleExportProductReport}
              className="text-[11px] font-bold text-pink-600 hover:text-pink-700 flex items-center gap-1 bg-pink-50/50 hover:bg-pink-50 border border-pink-100 px-2 py-1 rounded-lg shadow-xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Xuất sản phẩm
            </button>
          </div>

          {(() => {
            const rankingList = productRankMode === 'top' ? stats.products.topSelling : (stats.products.slowSelling ?? [])
            if (rankingList.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-12 text-slate-450 text-center">
                  <svg className="w-10 h-10 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-xs font-semibold">
                    {productRankMode === 'top' ? 'Chưa phát sinh dữ liệu bán hàng' : 'Không có sản phẩm nào'}
                  </p>
                </div>
              )
            }
            return (
              <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1">
                {rankingList.map((product, index) => {
                  let rankBadge = 'bg-slate-50 text-slate-500 border border-slate-100'
                  if (index === 0) rankBadge = 'bg-amber-100 text-amber-800 border border-amber-200'
                  else if (index === 1) rankBadge = 'bg-slate-100 text-slate-700 border border-slate-200'
                  else if (index === 2) rankBadge = 'bg-orange-100 text-orange-800 border border-orange-200'
                  
                  return (
                    <div 
                      key={product._id?.toString?.() ?? `${productRankMode}-${product.name}-${index}`} 
                      className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-50/80 transition-colors duration-150 cursor-pointer"
                      onClick={() => navigate(`/list?q=${encodeURIComponent(product.name)}`)}
                    >
                      <span className={`flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${rankBadge}`}>
                        {index + 1}
                      </span>
                      {product.image && (
                        <img src={formatImageUrl(product.image, { variant: "thumb", width: 96, height: 96, fit: "cover", quality: 76, format: "webp" })} alt={product.name} className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 object-cover shadow-xs" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-700">{product.name}</p>
                        <p className="text-xs text-slate-450 mt-0.5 font-medium">
                          {productRankMode === 'slow'
                            ? `Tồn: ${product.stock ?? 0} · Doanh thu thô: ${formatPrice(product.revenue)}`
                            : `Doanh thu thô: ${formatPrice(product.revenue)}`}
                          {product.netRevenue > 0 && (
                            <span className="block text-emerald-600 font-bold mt-0.5">
                              Thực nhận: {formatPrice(product.netRevenue)}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${productRankMode === 'slow' ? 'text-amber-700' : 'text-pink-600'}`}>{product.sold}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đã bán</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </ChartCard>
      </div>

      {/* Low Stock Warning Card */}
      <ChartCard
        title="Cảnh báo sản phẩm sắp hết hàng"
        subtitle={`Hệ thống cảnh báo khi số lượng tồn kho đạt mức cảnh báo ≤ 5 · Có ${stats.products.lowStock ?? 0} sản phẩm nằm trong danh sách`}
      >
        {(stats.products.lowStockItems ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-450 bg-slate-50/50 border border-slate-100 rounded-xl p-4">
            <svg className="w-8 h-8 text-slate-350 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs font-semibold">Tồn kho của tất cả sản phẩm đều đang ở mức an toàn</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
            {(stats.products.lowStockItems ?? []).map((product) => (
              <div
                key={product._id?.toString?.() ?? product.name}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/30 p-3 hover:bg-amber-50/50 transition-colors duration-150 cursor-pointer"
                onClick={() => navigate(`/list?q=${encodeURIComponent(product.name)}`)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {product.image && (
                    <img src={formatImageUrl(product.image, { variant: "thumb", width: 96, height: 96, fit: "cover", quality: 76, format: "webp" })} alt={product.name} className="h-10 w-10 shrink-0 rounded-lg border border-amber-100 object-cover shadow-xs" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">{product.name}</p>
                    {!product.isActive && <p className="text-[10px] font-medium text-slate-400 mt-0.5">Đang ẩn hiển thị</p>}
                  </div>
                </div>
                <span
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold tabular-nums shrink-0 ${
                    (product.stock ?? 0) === 0 ? 'bg-rose-100 text-rose-700 border border-rose-200/40' : 'bg-amber-100 text-amber-800 border border-amber-200/40'
                  }`}
                >
                  {(product.stock ?? 0) === 0 ? 'Hết hàng' : `Còn lại: ${product.stock}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      {/* Recent Orders Table Card */}
      <ChartCard title="Các đơn hàng phát sinh gần đây" subtitle="Danh sách 5 đơn hàng mới nhận gần nhất cần theo dõi (Bấm vào đơn hàng để xem chi tiết)">
        {stats.orders.recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-450 bg-slate-50/50 border border-slate-100 rounded-xl p-4">
            <svg className="w-8 h-8 text-slate-350 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-xs font-semibold">Cửa hàng chưa phát sinh đơn hàng nào gần đây</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 text-left font-bold">Mã đơn hàng</th>
                  <th className="pb-3 text-left font-bold">Ngày đặt</th>
                  <th className="pb-3 text-left font-bold">Số lượng</th>
                  <th className="pb-3 text-right font-bold">Doanh thu thô</th>
                  <th className="pb-3 text-right font-bold">Thực nhận</th>
                  <th className="pb-3 text-right font-bold">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.orders.recent.map((order) => (
                  <tr 
                    key={order._id} 
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/orders?orderId=${order._id}`)}
                  >
                    <td className="py-3 pr-3 font-mono text-xs font-bold text-slate-500">
                      #{order._id.toString().slice(-6).toUpperCase()}
                    </td>
                    <td className="py-3 pr-3 text-xs font-medium text-slate-650">{new Date(order.date).toLocaleDateString('vi-VN')}</td>
                    <td className="py-3 pr-3 text-xs font-medium text-slate-650">{order.itemCount} sản phẩm</td>
                    <td className="py-3 pr-3 text-right font-bold text-slate-800">{formatPrice(order.amount)}</td>
                    <td className="py-3 pr-3 text-right font-bold text-emerald-600">{formatPrice(order.netAmount || 0)}</td>
                    <td className="py-3 text-right">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase ${STATUS_STYLE[order.status] || 'bg-slate-100 text-slate-600'}`}>
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
