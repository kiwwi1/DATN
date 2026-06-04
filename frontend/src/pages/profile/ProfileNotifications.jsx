import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShopContext } from '../../context/ShopContext';
import ProfileSidebar from '../../components/profile/ProfileSidebar';

const TYPE_ICON = {
  order_placed: (
    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  ),
  order_status: (
    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  ),
  order_cancelled: (
    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  ),
  price_drop: (
    <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0l-3-3m3 3l-3 3M11 4H3m0 0l3 3M3 4l3-3" />
      </svg>
    </div>
  ),
};

const formatTime = (date) => {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return d.toLocaleDateString('vi-VN');
};

const ProfileNotifications = () => {
  const { notifications, markAllNotificationsRead, token } = useContext(ShopContext);
  const navigate = useNavigate();

  const handleMarkAllRead = () => {
    if (token) markAllNotificationsRead(token);
  };

  const handleClick = (n) => {
    if (n.orderId) navigate(`/orders?orderId=${n.orderId}`);
    if (n.productId) navigate(`/product/${n.productId}`);
  };

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex min-h-screen bg-gray-100">
      <ProfileSidebar />

      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-800">Thông báo</h1>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-sm text-orange-500 hover:text-orange-600 transition-colors"
              >
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {notifications.length === 0 ? (
              <div className="py-16 text-center">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-gray-400 text-sm">Chưa có thông báo nào</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map((n) => (
                  <li
                    key={n._id}
                    onClick={() => handleClick(n)}
                    className={`flex items-start gap-3 px-4 py-4 transition-colors ${
                      n.orderId || n.productId ? 'cursor-pointer hover:bg-gray-50' : ''
                    } ${!n.read ? 'bg-orange-50' : ''}`}
                  >
                    {TYPE_ICON[n.type] || TYPE_ICON.order_status}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.read ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatTime(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-2" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileNotifications;
