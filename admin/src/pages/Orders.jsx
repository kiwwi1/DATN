import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { useSearchParams } from 'react-router-dom'
import { backendUrl } from '../App.jsx'
import { assets } from '../assets/assets.js'
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
  approved: 'Đã duyệt — chờ nhận hàng',
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
    <section className="space-y-4">
      <div>
        <h1 className="admin-page-title">Đơn hàng của tôi</h1>
        <p className="admin-page-subtitle">Theo dõi trạng thái đơn, mã vận đơn và thông tin thanh toán.</p>
      </div>

      {loading ? (
        <div className="admin-card flex flex-col items-center justify-center py-16">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500">Đang tải đơn hàng...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="admin-card flex flex-col items-center justify-center py-20 text-slate-400">
          <img src={assets.parcel_icon} alt="no orders" className="mb-4 h-16 w-16 opacity-30" />
          <p className="text-base font-medium text-slate-500">Chưa có đơn hàng nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleOrders.map((order, index) => {
            const addressMeta = getOrderAddressMeta(order.address)
            return (
              <article
                id={`vendor-order-${order._id}`}
                key={order._id || index}
                className={`admin-card p-4 ${
                  String(order._id) === String(focusOrderId) ? 'ring-2 ring-pink-400' : ''
                }`}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex items-start gap-3">
                    <img src={assets.parcel_icon} alt="parcel" className="mt-0.5 h-10 w-10 flex-shrink-0" />
                    <div className="space-y-2">
                      <div className="space-y-1">
                        {order.items.map((item, itemIndex) => {
                          const variant = renderItemVariant(item)
                          return (
                            <p key={itemIndex} className="text-sm text-slate-700">
                              <span className="font-semibold">{item.name}</span>
                              <span className="text-slate-500"> × {item.quantity}</span>
                              {variant && (
                                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                  {variant}
                                </span>
                              )}
                            </p>
                          )
                        })}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{addressMeta.receiverName}</p>
                        <p className="text-xs text-slate-500">{addressMeta.fullAddress}</p>
                        <p className="text-xs text-slate-500">{addressMeta.phone}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid w-full gap-3 md:grid-cols-[1fr_auto] xl:w-auto xl:min-w-[380px]">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      <p className="flex items-center justify-between gap-3">
                        <span>Số sản phẩm:</span>
                        <span className="font-semibold text-slate-800">{order.items.length}</span>
                      </p>
                      <p className="mt-1 flex items-center justify-between gap-3">
                        <span>Thanh toán:</span>
                        <span className="font-semibold text-slate-800">{order.paymentMethod}</span>
                      </p>
                      <p className="mt-1 flex items-center justify-between gap-3">
                        <span>Trạng thái TT:</span>
                        <span className={`font-semibold ${order.payment ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {order.payment ? 'Đã thanh toán' : 'Chờ thanh toán'}
                        </span>
                      </p>
                      <p className="mt-1 flex items-center justify-between gap-3">
                        <span>Ngày:</span>
                        <span className="font-semibold text-slate-800">{new Date(order.date).toLocaleDateString('vi-VN')}</span>
                      </p>
                    </div>

                    <div className="space-y-2 md:min-w-[230px]">
                      <p className="text-right text-lg font-bold text-pink-600">{formatPrice(getDisplayAmount(order))}</p>

                      <div>
                        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">Mã vận đơn</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Nhập mã vận đơn"
                            value={trackingInputs[order._id] || ''}
                            onChange={(event) =>
                              setTrackingInputs((prev) => ({
                                ...prev,
                                [order._id]: event.target.value,
                              }))
                            }
                            className="admin-input py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => saveTrackingNumber(order._id, order.status)}
                            className="admin-btn-secondary px-3 py-1.5 text-xs"
                          >
                            {(trackingInputs[order._id] || '').trim() ? 'Lưu' : 'Tự tạo'}
                          </button>
                        </div>
                      </div>

                      {['Delivered', 'Cancelled', 'Refunded'].includes(order.status) ? (
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' :
                            order.status === 'Refunded' ? 'bg-blue-100 text-blue-700' :
                            'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {STATUS_LABELS[order.status]}
                        </span>
                      ) : (
                        <select
                          onChange={(event) => updateOrderStatus(order._id, event.target.value)}
                          value={order.status}
                          className="admin-select py-1.5 text-xs"
                        >
                          <option value="Order Placed">Đã đặt hàng</option>
                          <option value="Packing">Đang đóng gói</option>
                          <option value="Shipped">Đã bàn giao vận chuyển</option>
                          <option value="Out for delivery">Đang giao</option>
                          <option value="Delivered">Đã giao</option>
                        </select>
                      )}

                      {order.cancelReason && <p className="text-xs text-slate-400">Lý do hủy: {order.cancelReason}</p>}
                    </div>
                  </div>
                </div>

                {/* Return Request Panel */}
                {returnRequests[String(order._id)] && (() => {
                  const rr = returnRequests[String(order._id)]
                  const isPending  = rr.status === 'pending'
                  const isApproved = rr.status === 'approved'
                  return (
                    <div className={`mt-3 rounded-lg border p-3 text-sm ${
                      isPending ? 'border-amber-200 bg-amber-50' :
                      isApproved ? 'border-blue-200 bg-blue-50' :
                      'border-slate-200 bg-slate-50'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-700">
                          🔄 Yêu cầu trả hàng
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          isPending  ? 'bg-amber-100 text-amber-700' :
                          isApproved ? 'bg-blue-100 text-blue-700' :
                          rr.status === 'refunded' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {RETURN_STATUS_LABELS[rr.status] || rr.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mb-1">
                        <span className="font-medium">Lý do:</span> {RETURN_REASON_LABELS[rr.reason] || rr.reason}
                      </p>
                      {rr.description && (
                        <p className="text-xs text-slate-500 mb-2">"{rr.description}"</p>
                      )}
                      {isPending && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Ghi chú phản hồi (tuỳ chọn)..."
                            value={returnNotes[rr._id] || ''}
                            onChange={(e) => setReturnNotes((prev) => ({ ...prev, [rr._id]: e.target.value }))}
                            className="admin-input py-1 text-xs w-full"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReviewReturn(rr._id, true)}
                              disabled={processingReturn === rr._id}
                              className="flex-1 rounded bg-emerald-600 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              ✓ Chấp nhận
                            </button>
                            <button
                              onClick={() => handleReviewReturn(rr._id, false)}
                              disabled={processingReturn === rr._id}
                              className="flex-1 rounded bg-rose-600 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                            >
                              ✗ Từ chối
                            </button>
                          </div>
                        </div>
                      )}
                      {isApproved && (
                        <button
                          onClick={() => handleConfirmReceived(rr._id)}
                          disabled={processingReturn === rr._id}
                          className="w-full rounded bg-blue-600 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {processingReturn === rr._id ? 'Đang xử lý...' : '📦 Đã nhận hàng hoàn trả → Hoàn tiền'}
                        </button>
                      )}
                      {rr.vendorNote && rr.status === 'rejected' && (
                        <p className="text-xs text-rose-600 mt-1">Lý do từ chối: {rr.vendorNote}</p>
                      )}
                      {rr.stripeRefundId && (
                        <p className="text-xs text-emerald-600 mt-1">Stripe Refund ID: {rr.stripeRefundId}</p>
                      )}
                      {rr.isManualRefund && rr.status === 'refunded' && (
                        <p className="text-xs text-amber-600 mt-1">⚠ Hoàn tiền thủ công — vui lòng xử lý với khách hàng</p>
                      )}
                    </div>
                  )
                })()}
              </article>
            )
          })}

          {hasMoreOrders && (
            <div ref={sentinelRef} className="admin-card flex items-center justify-center py-3 text-xs text-slate-500">
              Kéo xuống để tải thêm đơn hàng...
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default Orders
