import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { useSearchParams } from 'react-router-dom'
import { backendUrl } from '../App.jsx'
import { formatPrice } from '../utils/priceFormat'

const SHIPPING_STATUSES = new Set(['Shipped', 'Out for delivery', 'Delivered'])
const INITIAL_VISIBLE_ORDERS = 8
const LOAD_MORE_STEP = 6

const getOrderAddressMeta = (address = {}) => {
  const receiverName = address.receiverName || `${address.firstName || ''} ${address.lastName || ''}`.trim()
  const fullAddress =
    address.fullAddress ||
    [address.addressLine || address.street, address.ward || address.state, address.city].filter(Boolean).join(', ') ||
    'N/A'
  const phone = address.phone || 'N/A'
  return { receiverName: receiverName || 'N/A', fullAddress, phone }
}

const STATUS_LABELS = {
  'Order Placed': 'Đã đặt hàng',
  Packing: 'Đang đóng gói',
  Shipped: 'Đã bàn giao vận chuyển',
  'Out for delivery': 'Đang giao',
  Delivered: 'Đã giao',
  Cancelled: 'Đã hủy',
  Refunded: 'Đã hoàn tiền',
}

const RETURN_STATUS_LABELS = {
  pending:  'Chờ duyệt',
  approved: 'Đã duyệt — chờ nhận',
  rejected: 'Đã từ chối',
  received: 'Đã nhận hàng',
  refunded: 'Đã hoàn tiền',
}

const RETURN_REASON_LABELS = {
  damaged:          'Hàng bị hỏng / lỗi',
  wrong_item:       'Sai sản phẩm',
  not_as_described: 'Không đúng mô tả',
  changed_mind:     'Đổi ý / không còn nhu cầu',
  other:            'Lý do khác',
}

const Orders = ({ token }) => {
  const [searchParams] = useSearchParams()
  const focusOrderId = searchParams.get('orderId') || ''
  const [orders, setOrders] = useState([])
  const [trackingInputs, setTrackingInputs] = useState({})
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ORDERS)
  const sentinelRef = useRef(null)
  const [returnRequests, setReturnRequests] = useState({})
  const [returnNotes, setReturnNotes] = useState({})
  const [processingReturn, setProcessingReturn] = useState(null)

  const visibleOrders = useMemo(
    () => orders.slice(0, Math.min(visibleCount, orders.length)),
    [orders, visibleCount]
  )
  const hasMoreOrders = visibleCount < orders.length

  useEffect(() => {
    if (!focusOrderId || orders.length === 0) {
      setVisibleCount(INITIAL_VISIBLE_ORDERS)
      return
    }
    const targetIndex = orders.findIndex((order) => String(order._id) === String(focusOrderId))
    if (targetIndex === -1) {
      setVisibleCount(INITIAL_VISIBLE_ORDERS)
      return
    }
    setVisibleCount(Math.max(INITIAL_VISIBLE_ORDERS, targetIndex + 1))
  }, [orders, focusOrderId])

  useEffect(() => {
    if (!focusOrderId || visibleOrders.length === 0) return
    const id = `vendor-order-${focusOrderId}`
    const target = document.getElementById(id)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [focusOrderId, visibleOrders])

  useEffect(() => {
    if (loading || !hasMoreOrders || !sentinelRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting) return
        setVisibleCount((prev) => Math.min(prev + LOAD_MORE_STEP, orders.length))
      },
      { root: null, rootMargin: '220px 0px', threshold: 0.01 }
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [loading, hasMoreOrders, orders.length])

  const fetchAllOrders = async () => {
    if (!token) return
    setLoading(true)
    try {
      const response = await axios.post(`${backendUrl}/api/order/vendor-list`, {}, { headers: { token } })
      if (response.data.success) {
        const nextOrders = response.data.orders || []
        setOrders(nextOrders)
        const nextTrackingInputs = {}
        nextOrders.forEach((order) => {
          nextTrackingInputs[order._id] = order.trackingNumber || ''
        })
        setTrackingInputs(nextTrackingInputs)
        setVisibleCount(INITIAL_VISIBLE_ORDERS)
      } else {
        toast.error(response.data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Không thể tải đơn hàng')
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = async (orderId, status) => {
    const trackingNumber = (trackingInputs[orderId] || '').trim()

    try {
      const response = await axios.post(
        `${backendUrl}/api/order/vendor-status`,
        { orderId, status, trackingNumber, autoGenerateTracking: SHIPPING_STATUSES.has(status) && !trackingNumber },
        { headers: { token } }
      )
      if (response.data.success) {
        toast.success('Cập nhật trạng thái thành công')
        await fetchAllOrders()
      } else {
        toast.error(response.data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    }
  }

  const saveTrackingNumber = async (orderId, status) => {
    const trackingNumber = (trackingInputs[orderId] || '').trim()
    try {
      const response = await axios.post(
        `${backendUrl}/api/order/vendor-status`,
        { orderId, status, trackingNumber, autoGenerateTracking: !trackingNumber },
        { headers: { token } }
      )
      if (response.data.success) {
        toast.success(trackingNumber ? 'Đã lưu mã vận đơn' : 'Đã tự động tạo mã vận đơn')
        await fetchAllOrders()
      } else {
        toast.error(response.data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    }
  }

  const fetchReturnRequests = async () => {
    if (!token) return
    try {
      const res = await axios.get(`${backendUrl}/api/return/vendor`, { headers: { token } })
      if (res.data.success) {
        const map = {}
        ;(res.data.returnRequests || []).forEach((r) => {
          const oid = r.orderId?._id || r.orderId
          if (oid) map[String(oid)] = r
        })
        setReturnRequests(map)
      }
    } catch { /* non-critical */ }
  }

  const handleReviewReturn = async (returnId, approved) => {
    setProcessingReturn(returnId)
    try {
      const res = await axios.post(
        `${backendUrl}/api/return/${returnId}/review`,
        { approved, vendorNote: returnNotes[returnId] || '' },
        { headers: { token } }
      )
      if (res.data.success) {
        toast.success(approved ? 'Đã duyệt yêu cầu trả hàng' : 'Đã từ chối yêu cầu')
        fetchReturnRequests()
      } else {
        toast.error(res.data.message)
      }
    } catch (e) {
      toast.error(e.response?.data?.message || e.message)
    } finally {
      setProcessingReturn(null)
    }
  }

  const handleConfirmReceived = async (returnId) => {
    if (!window.confirm('Xác nhận đã nhận hàng hoàn trả? Hệ thống sẽ xử lý hoàn tiền ngay.')) return
    setProcessingReturn(returnId)
    try {
      const res = await axios.post(
        `${backendUrl}/api/return/${returnId}/confirm-received`,
        {},
        { headers: { token } }
      )
      if (res.data.success) {
        toast.success('Đã xác nhận nhận hàng — hoàn tiền đang xử lý')
        fetchReturnRequests()
        fetchAllOrders()
      } else {
        toast.error(res.data.message)
      }
    } catch (e) {
      toast.error(e.response?.data?.message || e.message)
    } finally {
      setProcessingReturn(null)
    }
  }

  useEffect(() => {
    fetchAllOrders()
    fetchReturnRequests()
  }, [token])

  const renderItemVariant = (item) => {
    if (item.selectedAttributes && item.selectedAttributes.length > 0) {
      return item.selectedAttributes.map((attribute) => `${attribute.name}: ${attribute.value}`).join(', ')
    }
    if (item.size) return item.size
    return null
  }

  const getDisplayAmount = (order) => {
    if (order.vendorAmount != null) return order.vendorAmount
    return order.items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0)
  }

  return (
    <section className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="admin-page-title text-2xl font-bold tracking-tight text-slate-800">Đơn hàng của tôi</h1>
        <p className="admin-page-subtitle text-xs text-slate-400 mt-1 font-medium">Theo dõi, kiểm tra thông tin vận chuyển, mã vận đơn và tình trạng thanh toán của khách hàng.</p>
      </div>

      {loading ? (
        <div className="admin-card flex flex-col items-center justify-center py-20 bg-white">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600" />
          <p className="mt-4 text-xs font-semibold text-slate-400 animate-pulse">Đang tải danh sách đơn hàng...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="admin-card flex flex-col items-center justify-center py-20 text-slate-400 bg-white text-center">
          <svg className="w-16 h-16 text-slate-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0v10l-8 4m0 0L4 17V7m8 10V11" />
          </svg>
          <p className="text-sm font-semibold text-slate-500">Chưa có đơn hàng nào được đặt</p>
          <p className="mt-1 text-xs text-slate-400 font-medium">Hệ thống sẽ cập nhật ngay khi khách hàng thực hiện giao dịch mua sắm.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleOrders.map((order, index) => {
            const addressMeta = getOrderAddressMeta(order.address)
            const isFocused = String(order._id) === String(focusOrderId)
            
            return (
              <article
                id={`vendor-order-${order._id}`}
                key={order._id || index}
                className={`admin-card p-5 transition-all duration-300 bg-white border ${
                  isFocused 
                    ? 'border-pink-300 ring-2 ring-pink-500/10 shadow-md' 
                    : 'border-slate-200 hover:border-slate-350 hover:shadow-xs'
                }`}
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  {/* Left Column: Products List & Customer */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="p-3 bg-pink-50 border border-pink-100 rounded-2xl text-pink-650 shrink-0 hidden sm:block">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0v10l-8 4m0 0L4 17V7m8 10V11" />
                      </svg>
                    </div>
                    
                    <div className="space-y-3.5 min-w-0 flex-1">
                      {/* Products */}
                      <div className="space-y-2">
                        {order.items.map((item, itemIndex) => {
                          const variant = renderItemVariant(item)
                          return (
                            <div key={itemIndex} className="text-sm font-semibold text-slate-700 flex flex-wrap items-center gap-1.5 leading-relaxed">
                              <span className="text-slate-800 font-bold max-w-[280px] sm:max-w-[400px] truncate">{item.name}</span>
                              <span className="text-pink-600 bg-pink-50 border border-pink-100 px-1.5 py-0.5 rounded text-[10px] font-extrabold font-mono">x{item.quantity}</span>
                              {variant && (
                                <span className="rounded-md bg-slate-100/80 px-2 py-0.5 text-[10px] font-bold text-slate-500 border border-slate-200/50">
                                  {variant}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* Customer Address Card */}
                      <div className="p-3.5 bg-slate-50/50 border border-slate-150 rounded-xl max-w-xl space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                          <svg className="w-4 h-4 text-slate-550" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>{addressMeta.receiverName}</span>
                        </div>
                        <div className="text-[11px] text-slate-450 font-medium leading-relaxed pl-5 space-y-0.5">
                          <p className="flex items-center gap-1">
                            <span>Địa chỉ nhận:</span>
                            <span className="text-slate-700 font-bold">{addressMeta.fullAddress}</span>
                          </p>
                          <p className="flex items-center gap-1">
                            <span>Số điện thoại:</span>
                            <span className="text-slate-700 font-bold">{addressMeta.phone}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Metadata & Controls */}
                  <div className="grid w-full gap-4 md:grid-cols-2 xl:w-auto xl:min-w-[390px] xl:shrink-0">
                    {/* Metadata summary */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-[11px] font-semibold text-slate-500 space-y-2 leading-normal">
                      <p className="flex items-center justify-between gap-3 border-b border-slate-150/50 pb-1.5">
                        <span>Số loại sản phẩm:</span>
                        <span className="font-extrabold text-slate-700">{order.items.length} món</span>
                      </p>
                      <p className="flex items-center justify-between gap-3 border-b border-slate-150/50 pb-1.5">
                        <span>Hình thức thanh toán:</span>
                        <span className="font-extrabold text-slate-700 uppercase">{order.paymentMethod}</span>
                      </p>
                      <p className="flex items-center justify-between gap-3 border-b border-slate-150/50 pb-1.5">
                        <span>Trạng thái thanh toán:</span>
                        <span className={`font-extrabold px-1.5 py-0.5 rounded text-[10px] uppercase ${order.payment ? 'bg-emerald-50 text-emerald-705 border border-emerald-200' : 'bg-amber-50 text-amber-705 border border-amber-200'}`}>
                          {order.payment ? 'Đã trả tiền' : 'Chưa trả tiền'}
                        </span>
                      </p>
                      <p className="flex items-center justify-between gap-3">
                        <span>Ngày đặt hàng:</span>
                        <span className="font-extrabold text-slate-700">{new Date(order.date).toLocaleDateString('vi-VN')}</span>
                      </p>
                    </div>

                    {/* Operational controls */}
                    <div className="space-y-3.5 flex flex-col justify-between">
                      <div>
                        <p className="text-right text-base font-bold text-pink-650 tracking-tight">{formatPrice(getDisplayAmount(order))}</p>
                      </div>

                      {/* Tracking number input */}
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Mã vận đơn</label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Mã bưu gửi"
                            value={trackingInputs[order._id] || ''}
                            onChange={(event) =>
                              setTrackingInputs((prev) => ({
                                ...prev,
                                [order._id]: event.target.value,
                              }))
                            }
                            className="admin-input py-1.5 text-xs rounded-xl focus:border-pink-500 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => saveTrackingNumber(order._id, order.status)}
                            className="admin-btn-secondary px-3 py-1.5 text-xs rounded-xl font-bold shrink-0"
                          >
                            {(trackingInputs[order._id] || '').trim() ? 'Lưu' : 'Tự tạo'}
                          </button>
                        </div>
                      </div>

                      {/* Status select or Badge */}
                      <div>
                        {['Delivered', 'Cancelled', 'Refunded'].includes(order.status) ? (
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
                              order.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              order.status === 'Refunded' ? 'bg-sky-50 text-sky-700 border border-sky-100' :
                              'bg-rose-50 text-rose-700 border border-rose-105'
                            }`}
                          >
                            {STATUS_LABELS[order.status]}
                          </span>
                        ) : (
                          <select
                            onChange={(event) => updateOrderStatus(order._id, event.target.value)}
                            value={order.status}
                            className="admin-select py-1.5 text-xs rounded-xl focus:border-pink-500"
                          >
                            <option value="Order Placed">Đã đặt hàng</option>
                            <option value="Packing">Đang đóng gói</option>
                            <option value="Shipped">Đã bàn giao vận chuyển</option>
                            <option value="Out for delivery">Đang giao</option>
                            <option value="Delivered">Đã giao</option>
                          </select>
                        )}
                      </div>

                      {order.cancelReason && (
                        <p className="text-[11px] text-slate-400 leading-normal italic bg-slate-50 border border-slate-100 rounded-lg p-2 mt-1">
                          Lý do hủy: {order.cancelReason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Return Request Panel */}
                {returnRequests[String(order._id)] && (() => {
                  const rr = returnRequests[String(order._id)]
                  const isPending  = rr.status === 'pending'
                  const isApproved = rr.status === 'approved'
                  
                  return (
                    <div className={`mt-4 rounded-xl border p-4 text-xs font-semibold ${
                      isPending ? 'border-amber-250 bg-amber-50/40 text-amber-800' :
                      isApproved ? 'border-sky-250 bg-sky-50/40 text-sky-850' :
                      rr.status === 'refunded' ? 'border-emerald-250 bg-emerald-50/40 text-emerald-850' :
                      'border-slate-200 bg-slate-50/50 text-slate-700'
                    }`}>
                      <div className="flex items-center justify-between border-b border-dashed border-current/25 pb-2.5 mb-2.5">
                        <span className="font-bold flex items-center gap-1.5 text-sm">
                          <svg className="w-4 h-4 animate-spin-slow shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
                          </svg>
                          Yêu cầu trả hàng hoàn tiền
                        </span>
                        <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isPending  ? 'bg-amber-100 text-amber-700 border border-amber-200/50' :
                          isApproved ? 'bg-sky-100 text-sky-700 border border-sky-200/50' :
                          rr.status === 'refunded' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200/50' :
                          'bg-slate-100 text-slate-500 border border-slate-200/50'
                        }`}>
                          {RETURN_STATUS_LABELS[rr.status] || rr.status}
                        </span>
                      </div>
                      
                      <div className="space-y-1 text-slate-650">
                        <p className="flex items-center gap-1.5">
                          <span className="text-slate-400">Lý do hoàn:</span> 
                          <span className="font-bold text-slate-700">{RETURN_REASON_LABELS[rr.reason] || rr.reason}</span>
                        </p>
                        {rr.description && (
                          <p className="flex items-start gap-1.5 bg-white/60 p-2 rounded-lg border border-slate-200/40 mt-1 italic font-medium leading-relaxed">
                            <span>"</span>{rr.description}<span>"</span>
                          </p>
                        )}
                      </div>

                      {isPending && (
                        <div className="space-y-2 mt-3.5 pt-3 border-t border-dashed border-current/20">
                          <input
                            type="text"
                            placeholder="Ghi chú phản hồi gửi khách hàng (tuỳ chọn)..."
                            value={returnNotes[rr._id] || ''}
                            onChange={(e) => setReturnNotes((prev) => ({ ...prev, [rr._id]: e.target.value }))}
                            className="admin-input py-2 text-xs w-full rounded-xl focus:border-pink-500 font-semibold"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReviewReturn(rr._id, true)}
                              disabled={processingReturn === rr._id}
                              className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2 text-xs font-bold text-white transition-colors disabled:opacity-50"
                            >
                              ✓ Chấp thuận yêu cầu
                            </button>
                            <button
                              onClick={() => handleReviewReturn(rr._id, false)}
                              disabled={processingReturn === rr._id}
                              className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 py-2 text-xs font-bold text-white transition-colors disabled:opacity-50"
                            >
                              ✗ Từ chối yêu cầu
                            </button>
                          </div>
                        </div>
                      )}

                      {isApproved && (
                        <div className="mt-3.5">
                          <button
                            onClick={() => handleConfirmReceived(rr._id)}
                            disabled={processingReturn === rr._id}
                            className="w-full rounded-xl bg-sky-600 hover:bg-sky-700 py-2.5 text-xs font-bold text-white transition-colors disabled:opacity-50"
                          >
                            {processingReturn === rr._id ? 'Đang xử lý...' : '📦 Xác nhận đã nhận hàng hoàn trả → Hoàn tiền khách hàng'}
                          </button>
                        </div>
                      )}

                      {rr.vendorNote && rr.status === 'rejected' && (
                        <p className="text-xs text-rose-600 mt-2 font-bold flex items-center gap-1">
                          <span>✗ Lý do từ chối:</span> 
                          <span className="font-semibold text-slate-700">{rr.vendorNote}</span>
                        </p>
                      )}
                      
                      {rr.stripeRefundId && (
                        <p className="text-[10px] text-emerald-600 mt-2 font-bold font-mono">Stripe Refund ID: {rr.stripeRefundId}</p>
                      )}
                      
                      {rr.isManualRefund && rr.status === 'refunded' && (
                        <p className="text-xs text-amber-600 mt-2 font-bold bg-amber-50 border border-amber-200/50 p-2 rounded-lg">
                          ⚠ Hoàn tiền thủ công — vui lòng tự xử lý liên hệ với khách hàng.
                        </p>
                      )}
                    </div>
                  )
                })()}
              </article>
            )
          })}

          {hasMoreOrders && (
            <div ref={sentinelRef} className="flex items-center justify-center py-6 text-xs text-slate-400 font-semibold animate-pulse">
              Kéo xuống để tải thêm đơn hàng...
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default Orders
