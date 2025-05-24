import React from 'react'
import { NavLink } from 'react-router-dom'
import { assets } from '../assets/assets'

const Sidebar = () => {
  return (
    <div className="perspective-1000 p-4">
      <div className='flex flex-col gap-4 transform-style-3d'>
        <NavLink 
          className={({ isActive }) => `
            flex items-center gap-3 py-4 px-6
            bg-white/90 backdrop-blur-sm
            border-l-4 rounded-xl
            shadow-lg hover:shadow-xl
            transform hover:translate-x-2 hover:scale-105
            transition-all duration-300 ease-out
            ${isActive ? 'border-l-blue-500 bg-blue-50/90' : 'border-l-transparent'}
          `}
          to='/add'
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 shadow-inner">
            <img className='w-5 h-5 filter drop-shadow transform hover:rotate-12 transition-transform' src={assets.add_icon} alt="add" />
          </div>
          <p className='hidden md:block font-medium text-gray-700'>Add</p>
        </NavLink>

        <NavLink 
          className={({ isActive }) => `
            flex items-center gap-3 py-4 px-6
            bg-white/90 backdrop-blur-sm
            border-l-4 rounded-xl
            shadow-lg hover:shadow-xl
            transform hover:translate-x-2 hover:scale-105
            transition-all duration-300 ease-out
            ${isActive ? 'border-l-purple-500 bg-purple-50/90' : 'border-l-transparent'}
          `}
          to='/list'
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 shadow-inner">
            <img className='w-5 h-5 filter drop-shadow transform hover:rotate-12 transition-transform' src={assets.order_icon} alt="list" />
          </div>
          <p className='hidden md:block font-medium text-gray-700'>List Items</p>
        </NavLink>

        <NavLink 
          className={({ isActive }) => `
            flex items-center gap-3 py-4 px-6
            bg-white/90 backdrop-blur-sm
            border-l-4 rounded-xl
            shadow-lg hover:shadow-xl
            transform hover:translate-x-2 hover:scale-105
            transition-all duration-300 ease-out
            ${isActive ? 'border-l-green-500 bg-green-50/90' : 'border-l-transparent'}
          `}
          to='/orders'
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 to-green-600 shadow-inner">
            <img className='w-5 h-5 filter drop-shadow transform hover:rotate-12 transition-transform' src={assets.order_icon} alt="orders" />
          </div>
          <p className='hidden md:block font-medium text-gray-700'>Orders</p>
        </NavLink>
      </div>
    </div>
  )
}

export default Sidebar