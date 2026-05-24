import { NavLink } from 'react-router-dom'
import { assets } from '../assets/assets'

const NAV_ITEMS = [
  {
    to: '/stats',
    label: 'Thống kê',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 20V10m5 10V4m5 16v-7" />
      </svg>
    ),
  },
  {
    to: '/add',
    label: 'Thêm sản phẩm',
    icon: <img className="h-5 w-5 object-contain" src={assets.add_icon} alt="Thêm sản phẩm" />,
  },
  {
    to: '/list',
    label: 'Sản phẩm',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4" />
      </svg>
    ),
  },
  {
    to: '/orders',
    label: 'Đơn hàng',
    icon: <img className="h-5 w-5 object-contain" src={assets.order_icon} alt="Đơn hàng" />,
  },
  {
    to: '/chat',
    label: 'Tin nhắn',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M21 12a9 9 0 11-3-6.7L21 3v9z" />
      </svg>
    ),
  },
]

const Sidebar = () => (
  <nav className="admin-card overflow-hidden p-3">
    <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Điều hướng</p>
    <div className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition duration-200 ${
              isActive
                ? 'bg-pink-50 text-pink-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`
          }
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white">
            {icon}
          </span>
          <span>{label}</span>
        </NavLink>
      ))}
    </div>
  </nav>
)

export default Sidebar
