import React, { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShopContext } from '../../context/ShopContext';
import { formatImageUrl } from '../../utils/imageUtils';

const ProfileSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile } = useContext(ShopContext);

  const menuItems = [
    { id: 'notifications', label: 'Thông báo', icon: '🔔', path: '/profile/notifications' },
    { id: 'account', label: 'Tài khoản của tôi', icon: '👤', path: '/my-profile' },
    { id: 'bank', label: 'Ngân hàng', icon: null, path: '/profile/bank' },
    { id: 'address', label: 'Địa chỉ', icon: null, path: '/profile/address' },
    { id: 'change-password', label: 'Đổi mật khẩu', icon: null, path: '/profile/change-password' },
    { id: 'notification-settings', label: 'Cài đặt thông báo', icon: null, path: '/profile/notification-settings' },
    { id: 'privacy-settings', label: 'Thiết lập riêng tư', icon: null, path: '/profile/privacy-settings' },
    { id: 'personal-info', label: 'Thông tin cá nhân', icon: null, path: '/profile/personal-info' },
    { id: 'orders', label: 'Đơn mua', icon: '📋', path: '/orders' },
    { id: 'vouchers', label: 'Kho mã giảm giá', icon: '🎫', path: '/profile/vouchers' },
    { id: 'coins', label: 'Xu tích lũy', icon: '🪙', path: '/profile/coins' },
  ];

  const isActive = (path) => location.pathname === path;

  const avatarSrc =
    formatImageUrl(userProfile?.avatar, {
      variant: 'thumb',
      width: 96,
      height: 96,
      fit: 'cover',
      quality: 80,
      format: 'webp',
    }) || '';

  return (
    <div className="w-full md:w-64 min-h-0 md:min-h-screen bg-gray-50 p-4 shadow-lg border-b md:border-b-0 md:border-r border-gray-200">
      <div className="flex items-center mb-6 pb-4 border-b border-gray-200">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt="avatar"
            className="w-12 h-12 rounded-full object-cover mr-3 shadow-md border border-gray-200"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center mr-3 shadow-md">
            <span className="text-white text-lg font-bold">
              {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
            </span>
          </div>
        )}

        <div>
          <div className="font-semibold text-gray-800 text-sm">{userProfile?.name || 'Người dùng'}</div>
          <button
            onClick={() => navigate('/my-profile')}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center transition-colors"
          >
            <span className="mr-1">✏️</span>
            Sửa hồ sơ
          </button>
        </div>
      </div>

      <nav className="space-y-1">
        {menuItems.map((item, index) => (
          <div key={item.id}>
            <button
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center px-3 py-2 text-sm rounded-md transition-all duration-200 ${
                isActive(item.path)
                  ? 'bg-red-50 text-red-600 font-medium shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800 hover:shadow-sm'
              }`}
            >
              {item.icon && <span className="mr-3 text-lg">{item.icon}</span>}
              <span>{item.label}</span>
            </button>

            {index === 7 && <div className="my-4 border-t border-gray-200"></div>}
          </div>
        ))}
      </nav>
    </div>
  );
};

export default ProfileSidebar;
