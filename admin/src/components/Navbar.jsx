import React, { useState } from 'react'
import { assets } from '../assets/assets'

const TYPE_ICON_CLASS = {
  order_placed: 'bg-green-100 text-green-600',
  order_status: 'bg-blue-100 text-blue-600',
  order_cancelled: 'bg-red-100 text-red-500',
}

const formatTime = (date) => {
  const d = new Date(date)
  const now = new Date()
  const diffMins = Math.floor((now - d) / 60000)
  if (diffMins < 1) return 'Vừa xong'
  if (diffMins < 60) return `${diffMins} phút trước`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} giờ trước`
  return `${Math.floor(diffHours / 24)} ngày trước`
}

const Navbar = ({ onLogout, vendorInfo, unreadCount = 0, notifications = [], markAllRead }) => {
  const [showDropdown, setShowDropdown] = useState(false)

  const handleBellClick = () => {
    setShowDropdown((v) => !v)
    if (!showDropdown && unreadCount > 0) markAllRead?.()
  }

  const displayName = vendorInfo?.shopName || vendorInfo?.name || ''

  return (
    <div className='flex justify-between items-center py-2 px-[4%] relative'>
      <img src={assets.logo} alt="logo" className='w-[max(10%,80px)]' />

      <div className='flex items-center gap-3'>
        {/* Vendor name */}
        {displayName && (
          <div className='hidden sm:flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5'>
            <div className='w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold uppercase flex-shrink-0'>
              {displayName.charAt(0)}
            </div>
            <span className='text-sm font-medium text-gray-700 max-w-[140px] truncate'>{displayName}</span>
          </div>
        )}

        {/* Bell icon */}
        <div className='relative'>
          <button onClick={handleBellClick} className='relative p-1.5 text-gray-600 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' />
            </svg>
            {unreadCount > 0 && (
              <span className='absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full leading-none'>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {showDropdown && (
            <div className='absolute right-0 top-10 w-80 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden'>
              <div className='px-4 py-3 border-b flex items-center justify-between'>
                <span className='text-sm font-semibold text-gray-800'>Thông báo</span>
                <button onClick={() => setShowDropdown(false)} className='text-gray-400 hover:text-gray-600 p-0.5'>
                  <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                  </svg>
                </button>
              </div>

              <ul className='max-h-96 overflow-y-auto divide-y divide-gray-50'>
                {notifications.length === 0 ? (
                  <li className='py-10 text-center text-sm text-gray-400'>Chưa có thông báo nào</li>
                ) : (
                  notifications.map((n) => (
                    <li key={n._id} className={`flex items-start gap-3 px-4 py-3 ${!n.read ? 'bg-orange-50' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${TYPE_ICON_CLASS[n.type] || 'bg-gray-100 text-gray-500'}`}>
                        {n.type === 'order_placed' ? '✓' : n.type === 'order_cancelled' ? '✕' : 'i'}
                      </div>
                      <div className='flex-1 min-w-0'>
                        <p className={`text-xs ${!n.read ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>{n.title}</p>
                        <p className='text-xs text-gray-500 mt-0.5 line-clamp-2'>{n.message}</p>
                        <p className='text-xs text-gray-400 mt-1'>{formatTime(n.createdAt)}</p>
                      </div>
                      {!n.read && <span className='w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-1.5' />}
                    </li>
                  ))
                )}
              </ul>

              {notifications.length > 0 && (
                <div className='px-4 py-2.5 border-t bg-gray-50'>
                  <p className='text-xs text-center text-gray-400'>{notifications.length} thông báo</p>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onLogout}
          className='bg-gray-600 text-white px-4 py-1.5 sm:px-6 sm:py-2 rounded-full text-sm hover:bg-gray-700 transition-colors'
        >
          Đăng xuất
        </button>
      </div>

      {/* Overlay to close dropdown on outside click */}
      {showDropdown && (
        <div className='fixed inset-0 z-40' onClick={() => setShowDropdown(false)} />
      )}
    </div>
  )
}

export default Navbar
