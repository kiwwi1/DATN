import React, { useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import { ShopContext } from '../../context/ShopContext';
import Title from '../../components/ui/Title';
import { toast } from 'react-toastify';
import ProfileSidebar from '../../components/profile/ProfileSidebar';
import { formatPrice } from '../../utils/priceFormat';
import { formatImageUrl } from '../../utils/imageUtils';
import { localizeProductName } from '../../utils/productNameUtils';
import { isDefaultCartOptionKey } from '../../constants/cartOption';
import {
  STATUS_TABS,
  STATUS_MAP,
  matchTab,
  CANCEL_REASONS,
  CANCELLABLE_STATUSES,
  RETURNABLE_STATUSES,
  RETURN_WINDOW_DAYS,
  RETURN_REASON_LABELS,
  RETURN_STATUS_MAP,
} from '../../constants/orderConstants';

const VENDOR_STATUS_MAP = {
  pending: { label: 'Chờ xác nhận', color: 'text-gray-500' },
  confirmed: { label: 'Đã xác nhận', color: 'text-sky-600' },
  preparing: { label: 'Đang chuẩn bị', color: 'text-amber-600' },
  shipped: { label: 'Đang giao', color: 'text-blue-600' },
  delivered: { label: 'Đã giao', color: 'text-emerald-600' },
  cancelled: { label: 'Đã hủy', color: 'text-rose-600' },
};

const ORDERS_PER_PAGE = 6;

const inferVendorStatusFromOrder = (orderStatus) => {
  if (orderStatus === 'Cancelled') return 'cancelled';
  if (orderStatus === 'Delivered') return 'delivered';
  if (orderStatus === 'Shipped' || orderStatus === 'Out for delivery') return 'shipped';
  if (orderStatus === 'Packing') return 'preparing';
  return 'pending';
};

const normalizeVendorGroups = (order) => {
  const vendorRows = Array.isArray(order?.vendors) ? order.vendors : [];
  if (vendorRows.length > 0) {
    return vendorRows.map((vendor, idx) => {
      const rawItems = Array.isArray(vendor?.items) ? vendor.items : [];
      const items = rawItems.map((item) => ({
        ...item,
        _id: item?._id || item?.productId || '',
      }));
      const subtotal = Number(vendor?.subtotal) || 0;
      const voucherDiscount = Number(vendor?.voucherDiscount) || 0;
      return {
        key: String(vendor?.vendorId || `vendor-${idx}`),
        vendorShopName: vendor?.vendorShopName || 'Shop',
        vendorStatus: String(vendor?.vendorStatus || inferVendorStatusFromOrder(order?.status)),
        trackingNumber: String(vendor?.trackingNumber || '').trim(),
        subtotal,
        voucherDiscount,
        amount: Math.max(0, subtotal - voucherDiscount),
        items,
      };
    });
  }

  const map = new Map();
  const fallbackStatus = inferVendorStatusFromOrder(order?.status);
  const rawItems = Array.isArray(order?.items) ? order.items : [];
  for (const item of rawItems) {
    const vendorId = String(item?.vendorId || item?.vendorShopName || 'unknown');
    if (!map.has(vendorId)) {
      map.set(vendorId, {
        key: vendorId,
        vendorShopName: item?.vendorShopName || 'Shop',
        vendorStatus: fallbackStatus,
        trackingNumber: '',
        subtotal: 0,
        voucherDiscount: 0,
        amount: 0,
        items: [],
      });
    }
    const group = map.get(vendorId);
    group.items.push(item);
    group.subtotal += (Number(item?.price) || 0) * (Number(item?.quantity) || 0);
    group.amount = group.subtotal;
  }

  return Array.from(map.values());
};

const isWithinReturnWindow = (order) => {
  const placed = Number(order.date) || 0;
  if (!placed) return false;
  return Date.now() - placed < RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
};

const Orders = () => {
  const { backendUrl, token, navigate } = useContext(ShopContext);
  const [searchParams] = useSearchParams();
  const focusOrderId = searchParams.get('orderId') || '';
  const [orders, setOrders] = useState([]);
  const [reviewedIds, setReviewedIds] = useState(new Set());
  const [returnRequests, setReturnRequests] = useState({});
  const [activeTab, setActiveTab] = useState('all');
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [confirmingReceipt, setConfirmingReceipt] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [returnModal, setReturnModal] = useState(null);
  const [returnReason, setReturnReason] = useState('damaged');
  const [returnDesc, setReturnDesc] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.post(backendUrl + '/api/order/user-orders', {}, { headers: { token } });
      if (res.data.success) {
        setOrders(Array.isArray(res.data.orders) ? res.data.orders : []);
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.message);
    }
  }, [token, backendUrl]);

  const loadReturnRequests = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(backendUrl + '/api/return/my', { headers: { token } });
      if (res.data.success) {
        const map = {};
        (res.data.returnRequests || []).forEach((r) => {
          const oid = r.orderId?._id || r.orderId;
          if (oid) map[String(oid)] = r;
        });
        setReturnRequests(map);
      }
    } catch {
      // non-critical
    }
  }, [token, backendUrl]);

  const loadReviewedIds = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.post(backendUrl + '/api/review/my-reviewed-products', {}, { headers: { token } });
      if (res.data.success) setReviewedIds(new Set(res.data.keys));
    } catch {
      // non-critical
    }
  }, [token, backendUrl]);

  useEffect(() => {
    loadOrders();
    loadReviewedIds();
    loadReturnRequests();
  }, [loadOrders, loadReviewedIds, loadReturnRequests]);

  const ordersWithReturn = useMemo(
    () => orders.map((o) => ({ ...o, _returnRequest: returnRequests[String(o._id)] || null })),
    [orders, returnRequests]
  );
  const filtered = useMemo(
    () => ordersWithReturn.filter((o) => matchTab(o, activeTab)),
    [ordersWithReturn, activeTab]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / ORDERS_PER_PAGE));
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ORDERS_PER_PAGE;
    return filtered.slice(startIndex, startIndex + ORDERS_PER_PAGE);
  }, [filtered, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, orders.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!focusOrderId || filtered.length === 0) {
      return;
    }

    const focusIndex = filtered.findIndex((order) => String(order._id) === String(focusOrderId));
    if (focusIndex === -1) {
      return;
    }

    setCurrentPage(Math.floor(focusIndex / ORDERS_PER_PAGE) + 1);
  }, [focusOrderId, filtered]);

  useEffect(() => {
    if (!focusOrderId || paginatedOrders.length === 0) return;
    const id = `order-${focusOrderId}`;
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focusOrderId, paginatedOrders]);

  const handleReview = (productId, orderId) => {
    navigate(`/product/${productId}?tab=reviews&orderId=${orderId}`);
  };

  const handleConfirmReceived = async (orderId, vendorId) => {
    const key = `${orderId}_${vendorId}`;
    setConfirmingReceipt(key);
    try {
      const res = await axios.post(
        backendUrl + '/api/order/confirm-received',
        { orderId, vendorId },
        { headers: { token } }
      );
      if (res.data.success) {
        toast.success('Đã xác nhận nhận hàng thành công.');
        loadOrders();
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setConfirmingReceipt('');
    }
  };

  const handlePageChange = (nextPage) => {
    if (nextPage === currentPage) return;
    setCurrentPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openReturnModal = (orderId) => {
    setReturnModal({ orderId });
    setReturnReason('damaged');
    setReturnDesc('');
  };
  const closeReturnModal = () => {
    setReturnModal(null);
    setReturnDesc('');
  };
  const handleSubmitReturn = async () => {
    if (!returnModal) return;
    setSubmittingReturn(true);
    try {
      const res = await axios.post(
        backendUrl + '/api/return/request',
        { orderId: returnModal.orderId, reason: returnReason, description: returnDesc },
        { headers: { token } }
      );
      if (res.data.success) {
        toast.success('Đã gửi yêu cầu trả hàng. Người bán sẽ xem xét trong 1–2 ngày.');
        closeReturnModal();
        loadReturnRequests();
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSubmittingReturn(false);
    }
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
    const isOtherReason = cancelReason === 'Lý do khác' || cancelReason === 'Ly do khac';
    const finalReason = isOtherReason ? customReason.trim() : cancelReason;
    if (!finalReason) {
      toast.error('Vui lòng nhập lý do hủy đơn');
      return;
    }

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

          <div className="bg-white rounded-lg shadow-sm mb-4 overflow-x-auto">
            <div className="flex border-b min-w-max">
              {STATUS_TABS.map((tab) => (
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

          {filtered.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-16 text-center">
              <p className="text-gray-400 text-sm">Không có đơn hàng nào</p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedOrders.map((order) => {
                const statusInfo = STATUS_MAP[order.status] || { label: order.status, color: 'text-gray-500' };
                const vendorGroups = normalizeVendorGroups(order);

                return (
                  <div
                    id={`order-${order._id}`}
                    key={order._id}
                    className={`bg-white rounded-lg shadow-sm overflow-hidden ${
                      String(order._id) === String(focusOrderId) ? 'ring-2 ring-orange-400' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">
                          Đơn #{String(order._id).slice(-6).toUpperCase()} · {vendorGroups.length} shop
                        </span>
                      </div>
                      <span className={`text-xs uppercase tracking-wide ${statusInfo.color}`}>{statusInfo.label}</span>
                    </div>

                    {vendorGroups.map((vendor) => {
                      const vendorStatusInfo =
                        VENDOR_STATUS_MAP[vendor.vendorStatus] || { label: vendor.vendorStatus, color: 'text-gray-500' };
                      const canReviewVendor = vendor.vendorStatus === 'delivered' || order.status === 'Delivered';
                      const isConfirmingVendor = confirmingReceipt === `${order._id}_${vendor.key}`;

                      return (
                        <div key={`${order._id}-${vendor.key}`} className="border-b last:border-b-0">
                          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-gray-50/70">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-800">{vendor.vendorShopName || 'Shop'}</span>
                              <span className={`text-xs ${vendorStatusInfo.color}`}>{vendorStatusInfo.label}</span>
                              {vendor.vendorStatus === 'shipped' && (
                                <button
                                  onClick={() => handleConfirmReceived(order._id, vendor.key)}
                                  disabled={isConfirmingVendor}
                                  className="rounded border border-emerald-500 px-3 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isConfirmingVendor ? 'Đang xác nhận...' : 'Đã nhận hàng'}
                                </button>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Tạm tính shop</p>
                              <p className="text-sm font-semibold text-gray-800">{formatPrice(vendor.amount)}</p>
                              {vendor.voucherDiscount > 0 && (
                                <p className="text-xs text-emerald-600">Đã giảm voucher shop: -{formatPrice(vendor.voucherDiscount)}</p>
                              )}
                              {vendor.trackingNumber && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Mã vận đơn: <span className="font-medium text-gray-700">{vendor.trackingNumber}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          {vendor.items.map((item, idx) => {
                            const productId = item._id || item.productId;
                            const alreadyReviewed = reviewedIds.has(`${productId}_${order._id}`);
                            const displayName = localizeProductName(item.name);

                            return (
                              <div key={`${vendor.key}-${idx}`} className="flex items-start gap-3 px-4 py-4 border-t">
                                {productId ? (
                                  <Link to={`/product/${productId}`}>
                                    <img
                                      src={formatImageUrl(item.image, {
                                        variant: 'thumb',
                                        width: 128,
                                        height: 128,
                                        fit: 'cover',
                                        quality: 78,
                                        format: 'webp',
                                      })}
                                      className="w-16 h-16 object-cover rounded flex-shrink-0"
                                      alt={displayName}
                                      referrerPolicy="no-referrer"
                                    />
                                  </Link>
                                ) : (
                                  <img
                                    src={formatImageUrl(item.image, {
                                      variant: 'thumb',
                                      width: 128,
                                      height: 128,
                                      fit: 'cover',
                                      quality: 78,
                                      format: 'webp',
                                    })}
                                    className="w-16 h-16 object-cover rounded flex-shrink-0"
                                    alt={displayName}
                                    referrerPolicy="no-referrer"
                                  />
                                )}

                                <div className="flex-1 min-w-0">
                                  {productId ? (
                                    <Link to={`/product/${productId}`} className="text-sm font-medium text-gray-800 line-clamp-2 hover:text-orange-600">
                                      {displayName}
                                    </Link>
                                  ) : (
                                    <p className="text-sm font-medium text-gray-800 line-clamp-2">{displayName}</p>
                                  )}
                                  {item.selectedAttributes?.length > 0 && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Phân loại hàng: {item.selectedAttributes.map((a) => a.value).join(', ')}
                                    </p>
                                  )}
                                  {item.size && !isDefaultCartOptionKey(item.size) && (
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
                                  {canReviewVendor && (
                                    alreadyReviewed ? (
                                      <span className="text-xs text-green-600 font-medium">✓ Đã đánh giá</span>
                                    ) : (
                                      <button
                                        onClick={() => handleReview(productId, order._id)}
                                        className="text-xs border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white px-3 py-1 rounded transition-colors"
                                      >
                                        Đánh giá
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}

                    <div className="px-4 py-3 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-gray-600">
                        <p>
                          Thành tiền:{' '}
                          <span className="text-orange-600 font-semibold text-base">{formatPrice(order.amount)}</span>
                        </p>
                        {order._returnRequest && (() => {
                          const rs = RETURN_STATUS_MAP[order._returnRequest.status] || {};
                          return (
                            <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded ${rs.bg} ${rs.color}`}>
                              Trả hàng: {rs.label}
                              {order._returnRequest.vendorNote && order._returnRequest.status === 'rejected'
                                ? ` — ${order._returnRequest.vendorNote}`
                                : ''}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {CANCELLABLE_STATUSES.includes(order.status) && (
                          <button
                            onClick={() => openCancelModal(order._id)}
                            className="border border-red-400 text-red-500 text-sm px-4 py-2 rounded hover:bg-red-50 transition-colors"
                          >
                            Hủy đơn
                          </button>
                        )}
                        {RETURNABLE_STATUSES.includes(order.status)
                          && !order._returnRequest
                          && isWithinReturnWindow(order) && (
                          <button
                            onClick={() => openReturnModal(order._id)}
                            className="border border-blue-400 text-blue-600 text-sm px-4 py-2 rounded hover:bg-blue-50 transition-colors"
                          >
                            Trả hàng
                          </button>
                        )}
                        <button
                          onClick={loadOrders}
                          className="border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded hover:bg-gray-100 transition-colors"
                        >
                          Cập nhật
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filtered.length > ORDERS_PER_PAGE && (
                <div className="bg-white rounded-lg shadow-sm px-4 py-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Trang trước
                  </button>
                  <span className="text-sm text-gray-500">
                    Trang {currentPage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Trang sau
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {returnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-1">Yêu cầu trả hàng / hoàn tiền</h3>
            <p className="text-sm text-gray-500 mb-4">
              Bạn có thể yêu cầu trả hàng trong vòng {RETURN_WINDOW_DAYS} ngày kể từ khi đặt hàng.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Lý do trả hàng</label>
              <div className="space-y-2">
                {Object.entries(RETURN_REASON_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name="returnReason"
                      value={key}
                      checked={returnReason === key}
                      onChange={() => setReturnReason(key)}
                      className="accent-blue-500"
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả thêm (tuỳ chọn)</label>
              <textarea
                value={returnDesc}
                onChange={(e) => setReturnDesc(e.target.value)}
                placeholder="Mô tả chi tiết vấn đề..."
                rows={3}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
              />
            </div>

            <div className="bg-blue-50 rounded-lg p-3 mb-5 text-xs text-blue-700">
              <p className="font-medium mb-1">Quy trình trả hàng:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Gửi yêu cầu → Người bán xem xét (1–2 ngày)</li>
                <li>Người bán duyệt → Bạn gửi hàng về</li>
                <li>Người bán xác nhận nhận hàng → Hoàn tiền</li>
              </ol>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={closeReturnModal}
                disabled={submittingReturn}
                className="px-5 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-600 transition-colors"
              >
                Huỷ
              </button>
              <button
                onClick={handleSubmitReturn}
                disabled={submittingReturn}
                className="px-5 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {submittingReturn ? 'Đang gửi...' : 'Gửi yêu cầu'}
              </button>
            </div>
          </div>
        </div>
      )}

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

            {(cancelReason === 'Lý do khác' || cancelReason === 'Ly do khac') && (
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




