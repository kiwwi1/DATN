import React from 'react'
import { backendUrl } from '../App.jsx'
import axios from 'axios'
import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { assets } from '../assets/assets.js'
import { formatPrice } from '../utils/priceFormat'

const SHIPPING_STATUSES = new Set(['Shipped', 'Out for delivery', 'Delivered'])

const getOrderAddressMeta = (address = {}) => {
  const receiverName = address.receiverName || `${address.firstName || ''} ${address.lastName || ''}`.trim()
  const fullAddress = address.fullAddress
    || [address.addressLine || address.street, address.ward || address.state, address.city].filter(Boolean).join(', ')
    || 'N/A'
  const phone = address.phone || 'N/A'
  return { receiverName: receiverName || 'N/A', fullAddress, phone }
}

const Orders = ({ token }) => {
  const [orders, setOrders] = useState([])
  const [trackingInputs, setTrackingInputs] = useState({})

  const fetchAllOrders = async () => {
    if (!token) return
    try {
      const response = await axios.post(backendUrl + '/api/order/vendor-list', {}, {
        headers: { token }
      })
      if (response.data.success) {
        const nextOrders = response.data.orders || []
        setOrders(nextOrders)

        const nextTrackingInputs = {}
        nextOrders.forEach((order) => {
          nextTrackingInputs[order._id] = order.trackingNumber || ''
        })
        setTrackingInputs(nextTrackingInputs)
      } else {
        toast.error(response.data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Không thể tải đơn hàng')
    }
  }

  const updateOrderStatus = async (orderId, status) => {
    const trackingNumber = (trackingInputs[orderId] || '').trim()
    if (SHIPPING_STATUSES.has(status) && !trackingNumber) {
      toast.error('Vui lòng nhập mã vận đơn trước khi cập nhật trạng thái giao hàng')
      return
    }

    try {
      const response = await axios.post(
        backendUrl + '/api/order/vendor-status',
        { orderId, status, trackingNumber },
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
    if (!trackingNumber) {
      toast.error('Vui lòng nhập mã vận đơn')
      return
    }

    try {
      const response = await axios.post(
        backendUrl + '/api/order/vendor-status',
        { orderId, status, trackingNumber },
        { headers: { token } }
      )
      if (response.data.success) {
        toast.success('Đã lưu mã vận đơn')
        await fetchAllOrders()
      } else {
        toast.error(response.data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    }
  }

  useEffect(() => {
    fetchAllOrders()
  }, [token])

  const renderItemVariant = (item) => {
    if (item.selectedAttributes && item.selectedAttributes.length > 0) {
      return item.selectedAttributes.map((a) => `${a.name}: ${a.value}`).join(', ')
    }
    if (item.size) return item.size
    return null
  }

  const getDisplayAmount = (order) => {
    if (order.vendorAmount != null) return order.vendorAmount
    return order.items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0)
  }

  return (
    <div className="p-6">
      <h3 className="text-2xl font-bold mb-6 text-gray-800">Đơn hàng của tôi</h3>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <img src={assets.parcel_icon} alt="no orders" className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-base font-medium">Chưa có đơn hàng nào</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order, index) => {
            const addressMeta = getOrderAddressMeta(order.address)
            return (
            <div
              key={order._id || index}
              className="bg-white rounded-lg shadow-sm p-4 flex flex-col md:flex-row justify-between gap-4 border-l-4 border-blue-500"
            >
              <div className="flex items-start gap-4">
                <img src={assets.parcel_icon} alt="parcel" className="w-10 h-10 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <div className="mb-2 space-y-1">
                    {order.items.map((item, i) => {
                      const variant = renderItemVariant(item)
                      return (
                        <p key={i} className="text-gray-700 text-sm">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-gray-500"> × {item.quantity}</span>
                          {variant && (
                            <span className="text-xs ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{variant}</span>
                          )}
                          {i < order.items.length - 1 && ','}
                        </p>
                      )
                    })}
                  </div>
                  <p className="font-medium text-gray-800 text-sm">{addressMeta.receiverName}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{addressMeta.fullAddress}</p>
                  <p className="text-gray-500 text-xs">{addressMeta.phone}</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="bg-gray-50 p-3 rounded text-xs space-y-1 min-w-[160px]">
                  <p className="flex justify-between gap-4">
                    <span className="text-gray-500">Sản phẩm:</span>
                    <span className="font-medium">{order.items.length}</span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span className="text-gray-500">Thanh toán:</span>
                    <span className="font-medium">{order.paymentMethod}</span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span className="text-gray-500">Trạng thái TT:</span>
                    <span className={`font-medium ${order.payment ? 'text-green-600' : 'text-orange-500'}`}>
                      {order.payment ? 'Đã thanh toán' : 'Chờ thanh toán'}
                    </span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span className="text-gray-500">Ngày:</span>
                    <span className="font-medium">{new Date(order.date).toLocaleDateString('vi-VN')}</span>
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2 min-w-[220px]">
                  <p className="text-lg font-bold text-blue-600">{formatPrice(getDisplayAmount(order))}</p>

                  <div className="w-full">
                    <label className="text-[11px] text-gray-500 block mb-1 text-left">Mã vận đơn</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Nhập mã vận đơn"
                        value={trackingInputs[order._id] || ''}
                        onChange={(e) =>
                          setTrackingInputs((prev) => ({
                            ...prev,
                            [order._id]: e.target.value,
                          }))
                        }
                        className="flex-1 p-2 border rounded bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => saveTrackingNumber(order._id, order.status)}
                        className="px-2.5 py-1.5 text-xs rounded border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Lưu
                      </button>
                    </div>
                  </div>

                  {order.status === 'Delivered' || order.status === 'Cancelled' ? (
                    <span className={`px-3 py-1.5 rounded text-xs font-medium ${
                      order.status === 'Delivered'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-50 text-red-500'
                    }`}>
                      {order.status === 'Delivered' ? '✓ Đã giao' : '✕ Đã huỷ'}
                    </span>
                  ) : (
                    <select
                      onChange={(e) => updateOrderStatus(order._id, e.target.value)}
                      value={order.status}
                      className="p-2 border rounded bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Order Placed">Đã đặt hàng</option>
                      <option value="Packing">Đang đóng gói</option>
                      <option value="Shipped">Đã giao vận chuyển</option>
                      <option value="Out for delivery">Đang giao</option>
                      <option value="Delivered">Đã giao</option>
                    </select>
                  )}
                  {order.cancelReason && (
                    <p className="text-xs text-gray-400 max-w-[220px] text-right">Lý do: {order.cancelReason}</p>
                  )}
                </div>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  )
}

export default Orders
