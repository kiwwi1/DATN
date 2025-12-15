import React, { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShopContext } from '../context/ShopContext';

const ProfileSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile } = useContext(ShopContext);

  const menuItems = [
    {
      id: 'notifications',
      label: 'Thông Báo',
      icon: '🔔',
      path: '/profile/notifications'
    },
    {
      id: 'account',
      label: 'Tài Khoản Của Tôi',
      icon: '👤',
      path: null,
    },
    {
      id: 'profile',
      label: 'Hồ Sơ',
      icon: null,
      path: '/my-profile'
    },
    {
      id: 'bank',
      label: 'Ngân Hàng',
      icon: null,
      path: '/profile/bank'
    },
    {
      id: 'address',
      label: 'Địa Chỉ',
      icon: null,
      path: '/profile/address'
    },
    {
      id: 'change-password',
      label: 'Đổi Mật Khẩu',
      icon: null,
      path: '/profile/change-password'
    },
    {
      id: 'notification-settings',
      label: 'Cài Đặt Thông Báo',
      icon: null,
      path: '/profile/notification-settings'
    },
    {
      id: 'privacy-settings',
      label: 'Những Thiết Lập Riêng Tư',
      icon: null,
      path: '/profile/privacy-settings'
    },
    {
      id: 'personal-info',
      label: 'Thông Tin Cá Nhân',
      icon: null,
      path: '/profile/personal-info'
    },
    {
      id: 'orders',
      label: 'Đơn Mua',
      icon: '📋',
      path: '/orders'
    },
    {
      id: 'vouchers',
      label: 'Kho Voucher',
      icon: '🎫',
      path: '/profile/vouchers'
    },
    {
      id: 'coins',
      label: 'Shopee Xu',
      icon: '🪙',
      path: '/profile/coins'
    }
  ];

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="w-64 bg-gray-50 min-h-screen p-4 shadow-lg border-r border-gray-200">
      {/* User Profile Section */}
      <div className="flex items-center mb-6 pb-4 border-b border-gray-200">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center mr-3 shadow-md">
          <span className="text-white text-lg font-bold">
            {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
          </span>
        </div>
        <div>
          <div className="font-semibold text-gray-800 text-sm">
            {userProfile?.name || 'User'}
          </div>
          <button 
            onClick={() => navigate('/my-profile')}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center transition-colors"
          >
            <span className="mr-1">✏️</span>
            Sửa Hồ Sơ
          </button>
        </div>
      </div>

      {/* Navigation Menu */}
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
              {item.icon && (
                <span className="mr-3 text-lg">{item.icon}</span>
              )}
              <span>{item.label}</span>
            </button>
            
            {/* Add spacing between groups */}
            {index === 8 && <div className="my-4 border-t border-gray-200"></div>}
          </div>
        ))}
      </nav>
    </div>
  );
};

export default ProfileSidebar;
