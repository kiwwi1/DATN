import React from 'react'
import { NavLink } from 'react-router-dom'
import { assets } from '../assets/assets'

const NAV_ITEMS = [
  {
    to: '/stats',
    label: 'Thống Kê',
    activeColor: 'border-l-yellow-500 bg-yellow-50/90',
    gradient: 'from-yellow-400 to-orange-500',
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    to: '/add',
    label: 'Thêm Sản Phẩm',
    activeColor: 'border-l-blue-500 bg-blue-50/90',
    gradient: 'from-blue-400 to-blue-600',
    icon: <img className="w-5 h-5 filter drop-shadow" src={assets.add_icon} alt="add" />,
  },
  {
    to: '/list',
    label: 'Sản Phẩm',
    activeColor: 'border-l-purple-500 bg-purple-50/90',
    gradient: 'from-purple-400 to-purple-600',
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M20 7l-8-4-8 4m16 0v10l-8 4m0 0L4 17V7m8 10V11" />
      </svg>
    ),
  },
  {
    to: '/orders',
    label: 'Đơn Hàng',
    activeColor: 'border-l-green-500 bg-green-50/90',
    gradient: 'from-green-400 to-green-600',
    icon: <img className="w-5 h-5 filter drop-shadow" src={assets.order_icon} alt="orders" />,
  },
  {
    to: '/chat',
    label: 'Tin Nhắn',
    activeColor: 'border-l-cyan-500 bg-cyan-50/90',
    gradient: 'from-cyan-400 to-cyan-600',
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.335-3.114A7.948 7.948 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    ),
  },
]

const Sidebar = () => (
  <div className="perspective-1000 p-4">
    <div className="flex flex-col gap-4 transform-style-3d">
      {NAV_ITEMS.map(({ to, label, activeColor, gradient, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `
            flex items-center gap-3 py-4 px-6
            bg-white/90 backdrop-blur-sm
            border-l-4 rounded-xl
            shadow-lg hover:shadow-xl
            transform hover:translate-x-2 hover:scale-105
            transition-all duration-300 ease-out
            ${isActive ? activeColor : 'border-l-transparent'}
          `}
        >
          <div className={`flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} shadow-inner`}>
            {icon}
          </div>
          <p className="hidden md:block font-medium text-gray-700">{label}</p>
        </NavLink>
      ))}
    </div>
  </div>
)

export default Sidebar
