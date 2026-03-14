import React, { useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ShopContext } from '../context/ShopContext';
import Title from '../components/Title';
import { toast } from 'react-toastify';
import ProfileSidebar from '../components/ProfileSidebar';
import { formatPrice } from '../utils/priceFormat';
import { formatImageUrl } from '../utils/imageUtils';

const STATUS_TABS = [
  { id: 'all',        label: 'Tất cả' },
  { id: 'pending',    label: 'Chờ thanh toán' },
  { id: 'shipping',   label: 'Vận chuyển' },
  { id: 'delivering', label: 'Chờ giao hàng' },
  { id: 'delivered',  label: 'Hoàn thành' },
  { id: 'cancelled',  label: 'Đã hủy' },
];

const STATUS_MAP = {
  'Order Placed':      { label: 'Chờ xác nhận',    color: 'text-yellow-600' },
  'Packing':           { label: 'Đang đóng gói',   color: 'text-blue-600' },
  'Shipped':           { label: 'Đang vận chuyển', color: 'text-purple-600' },
  'Out for delivery':  { label: 'Đang giao hàng',  color: 'text-orange-500' },
  'Delivered':         { label: 'HOÀN THÀNH',      color: 'text-orange-500 font-semibold' },
  'Cancelled':         { label: 'Đã hủy',          color: 'text-gray-400' },
};

const matchTab = (order, tab) => {
  if (tab === 'all') return true;
  if (tab === 'pending')    return order.status === 'Order Placed';
  if (tab === 'shipping')   return ['Packing', 'Shipped'].includes(order.status);
  if (tab === 'delivering') return order.status === 'Out for delivery';
  if (tab === 'delivered')  return order.status === 'Delivered';
  if (tab === 'cancelled')  return order.status === 'Cancelled';
  return true;
};

const CANCEL_REASONS = [
  'Tôi muốn thay đổi địa chỉ giao hàng',
  'Tôi muốn thay đổi sản phẩm trong đơn hàng',
  'Tôi tìm được giá rẻ hơn ở chỗ khác',
  'Tôi không còn nhu cầu mua nữa',
  'Đặt hàng nhầm / trùng đơn',
  'Lý do khác',
];

const CANCELLABLE_STATUSES = ['Order Placed', 'Packing'];

const Orders = () => {
  const { backendUrl, token, navigate } = useContext(ShopContext);
  const [orders, setOrders] = useState([]);
  const [reviewedIds, setReviewedIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState('all');
  const [cancelModal, setCancelModal] = useState(null); // { orderId }
  const [cancelReason, setCancelReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.post(backendUrl + '/api/order/user-orders', {}, { headers: { token } });
      if (res.data.success) {
        setOrders([...res.data.orders].reverse());
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.message);
    }
  }, [token, backendUrl]);

  const loadReviewedIds = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.post(backendUrl + '/api/review/my-reviewed-products', {}, { headers: { token } });
      // keys có dạng "productId_orderId"
      if (res.data.success) setReviewedIds(new Set(res.data.keys));
    } catch {
      // non-critical
    }
  }, [token, backendUrl]);

  useEffect(() => {
    loadOrders();
    loadReviewedIds();
  }, [loadOrders, loadReviewedIds]);

  const filtered = orders.filter(o => matchTab(o, activeTab));

  const handleReview = (productId, orderId) => {
    navigate(`/product/${productId}?tab=reviews&orderId=${orderId}`);
  };

  const openCancelModal = (orderId) => {
    setCancelModal({ orderId });
    setCancelReason(CANCEL_REASONS[0]);
    setCustomReason('');
  };

  const closeCancelModal = () => {
    setCancelModal(null);
    setCancelReason('');
    setCustomReason('');
  };

  const handleCancelOrder = async () => {
    if (!cancelModal) return;
    const finalReason = cancelReason === 'Lý do khác' ? customReason.trim() : cancelReason;
    if (!finalReason) { toast.error('Vui lòng nhập lý do hủy đơn'); return; }
    setCancelling(true);
    try {
      const res = await axios.post(
        backendUrl + '/api/order/cancel',
        { orderId: cancelModal.orderId, cancelReason: finalReason },
        { headers: { token } }
      );
      if (res.data.success) {
        toast.success('Đơn hàng đã được hủy thành công');
        closeCancelModal();
        loadOrders();
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <ProfileSidebar />

      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-2xl mb-4">
            <Title text1={'ĐƠN '} text2={'MUA'} />
          </div>

          {/* Status tabs */}
          <div className="bg-white rounded-lg shadow-sm mb-4 overflow-x-auto">
            <div className="flex border-b min-w-max">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3 text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-b-2 border-orange-500 text-orange-500 font-medium'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-16 text-center">
              <p className="text-gray-400 text-sm">Không có đơn hàng nào</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((order) => {
                const statusInfo = STATUS_MAP[order.status] || { label: order.status, color: 'text-gray-500' };
                const isDelivered = order.status === 'Delivered';
                const shopName = order.items[0]?.vendorShopName;

                return (
                  <div key={order._id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                    {/* Order header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">
                          {shopName || 'Shop'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        {isDelivered && (
                          <span className="text-gray-500 text-xs">
                            Giao hàng thành công
                          </span>
                        )}
                        <span className={`text-xs uppercase tracking-wide ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Items */}
                    {order.items.map((item, idx) => {
                      const alreadyReviewed = reviewedIds.has(`${item._id}_${order._id}`);
                      return (
                        <div key={idx} className="flex items-start gap-3 px-4 py-4 border-b last:border-b-0">
                          <img
                            src={formatImageUrl(item.image?.[0])}
                            className="w-16 h-16 object-cover rounded flex-shrink-0"
                            alt={item.name}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 line-clamp-2">{item.name}</p>
                            {item.selectedAttributes?.length > 0 && (
                              <p className="text-xs text-gray-500 mt-1">
                                Phân loại hàng: {item.selectedAttributes.map(a => a.value).join(', ')}
                              </p>
                            )}
                            {item.size && (
                              <p className="text-xs text-gray-500 mt-1">Phân loại hàng: {item.size}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">x{item.quantity}</p>
                          </div>
                          <div className="text-right shrink-0 flex flex-col items-end gap-2">
                            <div>
                              {item.originalPrice && item.originalPrice > item.price && (
                                <p className="text-xs text-gray-400 line-through">{formatPrice(item.originalPrice)}</p>
                              )}
                              <p className="text-sm font-medium text-orange-600">{formatPrice(item.price)}</p>
                            </div>
                            {/* Per-item review button */}
                            {isDelivered && (
                              alreadyReviewed ? (
                                <span className="text-xs text-green-600 font-medium">✓ Đã đánh giá</span>
                              ) : (
                                <button
                                  onClick={() => handleReview(item._id, order._id)}
                                  className="text-xs border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white px-3 py-1 rounded transition-colors"
                                >
                                  Đánh Giá
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Order footer */}
                    <div className="px-4 py-3 bg-gray-50 flex items-center justify-between gap-4">
                      <p className="text-sm text-gray-600">
                        Thành tiền:{' '}
                        <span className="text-orange-600 font-semibold text-base">
                          {formatPrice(order.amount)}
                        </span>
                      </p>
                      <div className="flex items-center gap-2">
                        {CANCELLABLE_STATUSES.includes(order.status) && (
                          <button
                            onClick={() => openCancelModal(order._id)}
                            className="border border-red-400 text-red-500 text-sm px-4 py-2 rounded hover:bg-red-50 transition-colors"
                          >
                            Hủy đơn
                          </button>
                        )}
                        <button
                          onClick={loadOrders}
                          className="border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded hover:bg-gray-100 transition-colors"
                        >
                          Cập nhật trạng thái
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-1">Hủy đơn hàng</h3>
            <p className="text-sm text-gray-500 mb-4">Vui lòng chọn lý do hủy đơn</p>

            <div className="space-y-2 mb-4">
              {CANCEL_REASONS.map((reason) => (
                <label key={reason} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="cancelReason"
                    value={reason}
                    checked={cancelReason === reason}
                    onChange={() => setCancelReason(reason)}
                    className="accent-orange-500"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">{reason}</span>
                </label>
              ))}
            </div>

            {cancelReason === 'Lý do khác' && (
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Nhập lý do của bạn..."
                rows={3}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:border-orange-400 resize-none"
              />
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={closeCancelModal}
                disabled={cancelling}
                className="px-5 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-600 transition-colors"
              >
                Trở lại
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="px-5 py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors disabled:opacity-60"
              >
                {cancelling ? 'Đang xử lý...' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
