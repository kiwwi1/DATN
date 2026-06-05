export const STATUS_TABS = [
  { id: 'all',       label: 'Tất cả' },
  { id: 'pending',   label: 'Chờ thanh toán' },
  { id: 'shipping',  label: 'Vận chuyển' },
  { id: 'delivering',label: 'Chờ giao hàng' },
  { id: 'delivered', label: 'Hoàn thành' },
  { id: 'returning', label: 'Trả hàng' },
  { id: 'cancelled', label: 'Đã hủy' },
];

export const STATUS_MAP = {
  'Order Placed':    { label: 'Chờ xác nhận',    color: 'text-yellow-600' },
  Packing:           { label: 'Đang đóng gói',   color: 'text-blue-600' },
  Shipped:           { label: 'Đang vận chuyển', color: 'text-purple-600' },
  'Out for delivery':{ label: 'Đang giao hàng',  color: 'text-orange-500' },
  Delivered:         { label: 'HOÀN THÀNH',       color: 'text-orange-500 font-semibold' },
  Cancelled:         { label: 'Đã hủy',           color: 'text-gray-400' },
  Refunded:          { label: 'Đã hoàn tiền',     color: 'text-emerald-600 font-semibold' },
};

export const RETURN_REASON_LABELS = {
  damaged:          'Hàng bị hỏng / lỗi',
  wrong_item:       'Sai sản phẩm',
  not_as_described: 'Không đúng mô tả',
  changed_mind:     'Đổi ý / không còn nhu cầu',
  other:            'Lý do khác',
};

export const RETURN_STATUS_MAP = {
  pending:  { label: 'Chờ duyệt',       color: 'text-yellow-600',  bg: 'bg-yellow-50' },
  approved: { label: 'Đã duyệt',        color: 'text-blue-600',    bg: 'bg-blue-50' },
  rejected: { label: 'Bị từ chối',      color: 'text-red-600',     bg: 'bg-red-50' },
  received: { label: 'Đã nhận hàng về', color: 'text-purple-600',  bg: 'bg-purple-50' },
  refunded: { label: 'Đã hoàn tiền',    color: 'text-emerald-600', bg: 'bg-emerald-50' },
};

export const CANCEL_REASONS = [
  'Tôi muốn thay đổi địa chỉ giao hàng',
  'Tôi muốn thay đổi sản phẩm trong đơn hàng',
  'Tôi tìm được giá rẻ hơn ở chỗ khác',
  'Tôi không còn nhu cầu mua nữa',
  'Đặt hàng nhầm / trùng đơn',
  'Lý do khác',
];

export const CANCELLABLE_STATUSES = ['Order Placed', 'Packing'];
export const RETURNABLE_STATUSES  = ['Delivered'];
export const RETURN_WINDOW_DAYS   = 7;

export const matchTab = (order, tab) => {
  if (tab === 'all')       return true;
  if (tab === 'pending')   return order.status === 'Order Placed';
  if (tab === 'shipping')  return ['Packing', 'Shipped'].includes(order.status);
  if (tab === 'delivering')return order.status === 'Out for delivery';
  if (tab === 'delivered') return order.status === 'Delivered';
  if (tab === 'returning') return order.status === 'Refunded' || !!order._returnRequest;
  if (tab === 'cancelled') return order.status === 'Cancelled';
  return true;
};
