import { useState } from 'react'
import { assets } from '../assets/assets'
import { useNavigate } from 'react-router-dom'

const TYPE_ICON_CLASS = {
  order_placed: 'bg-emerald-100 text-emerald-700',
  order_status: 'bg-sky-100 text-sky-700',
  order_cancelled: 'bg-rose-100 text-rose-700',
}

const TYPE_SYMBOL = {
  order_placed: '✓',
  order_cancelled: '×',
  order_status: 'i',
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
  const navigate = useNavigate()
  const displayName = vendorInfo?.shopName || vendorInfo?.name || ''

  const handleBellClick = () => {
    const opening = !showDropdown
    setShowDropdown(opening)
    if (opening && unreadCount > 0) {
      markAllRead?.()
    }
  }

  const handleNotificationClick = (notification) => {
    setShowDropdown(false)
    if (notification?.orderId) {
      navigate(`/orders?orderId=${notification.orderId}`)
      return
    }
    if (notification?.productId) {
      navigate('/list')
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <img src={assets.logo} alt="logo" className="h-9 w-auto" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Bảng điều khiển nhà bán</p>
            <p className="text-xs text-slate-500">Quản lý sản phẩm, đơn hàng và vận hành cửa hàng</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {displayName && (
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-pink-500 text-xs font-bold uppercase text-white">
                {displayName.charAt(0)}
              </div>
              <span className="max-w-[150px] truncate text-sm font-medium text-slate-700">{displayName}</span>
            </div>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={handleBellClick}
              aria-label="Mở thông báo"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.4-1.4a2 2 0 01-.6-1.44V11a6 6 0 00-4-5.66V5a2 2 0 10-4 0v.34A6 6 0 006 11v3.16c0 .54-.21 1.05-.6 1.44L4 17h5m6 0a3 3 0 11-6 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showDropdown && (
              <div className="admin-card absolute right-0 top-12 z-50 w-[340px] overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">Thông báo</p>
                  <button
                    type="button"
                    onClick={() => setShowDropdown(false)}
                    aria-label="Đóng thông báo"
                    className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <li className="px-4 py-10 text-center text-sm text-slate-400">Chưa có thông báo nào</li>
                  ) : (
                    notifications.map((notification) => (
                      <li
                        key={notification._id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`flex items-start gap-3 px-4 py-3 ${!notification.read ? 'bg-pink-50/60' : 'bg-white'} ${
                          notification.orderId || notification.productId ? 'cursor-pointer hover:bg-slate-50' : ''
                        }`}
                      >
                        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${TYPE_ICON_CLASS[notification.type] || 'bg-slate-100 text-slate-600'}`}>
                          {TYPE_SYMBOL[notification.type] || 'i'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs ${!notification.read ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>
                            {notification.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{notification.message}</p>
                          <p className="mt-1 text-xs text-slate-400">{formatTime(notification.createdAt)}</p>
                        </div>
                        {!notification.read && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-pink-500" />}
                      </li>
                    ))
                  )}
                </ul>

                {notifications.length > 0 && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-center text-xs text-slate-500">
                    {notifications.length} thông báo
                  </div>
                )}
              </div>
            )}
          </div>

          <button type="button" onClick={onLogout} className="admin-btn-primary">
            Đăng xuất
          </button>
        </div>
      </div>

      {showDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />}
    </header>
  )
}

export default Navbar
