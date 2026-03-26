import React from 'react'
import { backendUrl } from '../App.jsx'
import axios from 'axios'
import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { assets } from '../assets/assets.js'
import { formatPrice } from '../utils/priceFormat'

const Orders = ({token}) => {
  const [orders, setOrders] = useState([])

  const fetchAllOrders = async () => {
    if (!token) return
    try {
      const response = await axios.post(backendUrl + '/api/order/vendor-list', {}, {
        headers: { token }
      })
      if (response.data.success) {
        setOrders(response.data.orders)
      } else {
        toast.error(response.data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Không thể tải đơn hàng')
    }
  }

  const updateOrderStatus = async (event, orderId) => {
    event.preventDefault()
    try {
      const response = await axios.post(backendUrl + '/api/order/vendor-status',
        { orderId, status: event.target.value },
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

  useEffect(() => {
    fetchAllOrders()
  }, [token])

  // Format selected attributes (new system) with fallback to legacy size field
  const renderItemVariant = (item) => {
    if (item.selectedAttributes && item.selectedAttributes.length > 0) {
      return item.selectedAttributes.map(a => `${a.name}: ${a.value}`).join(', ')
    }
    if (item.size) return item.size
    return null
  }

  // Calculate vendor's actual amount from items if vendorAmount is not provided
  const getDisplayAmount = (order) => {
    if (order.vendorAmount != null) return order.vendorAmount
    return order.items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0)
  }

  return (
    <div className="p-6">
      <h3 className='text-2xl font-bold mb-6 text-gray-800'>Đơn hàng của tôi</h3>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <img src={assets.parcel_icon} alt="no orders" className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-base font-medium">Chưa có đơn hàng nào</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order, index) => (
            <div key={order._id || index} className="bg-white rounded-lg shadow-sm p-4 flex flex-col md:flex-row justify-between gap-4 border-l-4 border-blue-500">
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
                  <p className="font-medium text-gray-800 text-sm">{order.address.firstName} {order.address.lastName}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{order.address.street}, {order.address.city}</p>
                  <p className="text-gray-500 text-xs">{order.address.phone}</p>
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

                <div className="flex flex-col items-end gap-2 min-w-[140px]">
                  <p className="text-lg font-bold text-blue-600">{formatPrice(getDisplayAmount(order))}</p>
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
                      onChange={(e) => updateOrderStatus(e, order._id)}
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
                    <p className="text-xs text-gray-400 max-w-[140px] text-right">Lý do: {order.cancelReason}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Orders
