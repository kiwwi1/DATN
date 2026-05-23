import React, { useContext, useEffect, useState } from 'react'
import { assets } from '../../assets/assets'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ShopContext } from '../../context/ShopContext'
import axios from 'axios'
import NavbarSearch from './NavbarSearch'

const Navbar = () => {
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false)
  const {
    token,
    setToken,
    navigate,
    setCartItems,
    userRole,
    userProfile,
    unreadCount,
    markAllNotificationsRead,
    backendUrl,
    getCartCount,
  } = useContext(ShopContext)
  const location = useLocation()
  const isHomePage = location.pathname === '/'

  useEffect(() => {
    const fetchCartData = async () => {
      if (!token) return
      try {
        const response = await axios.post(backendUrl + '/api/cart/get', {}, { withCredentials: true })
        const data = response.data
        if (data.success) {
          setCartItems(data.cartData || {})
        }
      } catch (error) {
        console.error('Loi khi tai gio hang:', error)
      }
    }

    fetchCartData()
  }, [token, setCartItems, backendUrl])

  const logoutHandler = async () => {
    try {
      await axios.post(backendUrl + '/api/user/logout', {}, { withCredentials: true })
    } catch {
      // noop: clear client state regardless.
    }
    navigate('/login')
    setToken('')
    setCartItems({})
  }

  const handleBellClick = () => {
    if (token) markAllNotificationsRead()
    navigate('/profile/notifications')
  }

  return (
    <header
      className={`${isHomePage ? 'sticky top-0' : 'relative'} z-50 -mx-4 md:-mx-[7vw] lg:-mx-[9vw] bg-white text-gray-700 border-b border-gray-200 shadow-sm`}
    >
      <div className='px-4 md:px-[7vw] lg:px-[9vw]'>
        <div className='hidden md:flex items-center justify-between text-xs py-2 text-gray-500 border-b border-gray-100'>
          <div className='flex items-center gap-3'>
            {userRole === 'vendor' ? (
              <button onClick={() => window.open('http://localhost:5174/add', '_blank')} className='hover:underline'>
                Kenh Nguoi Ban
              </button>
            ) : (
              <NavLink to='/vendor-register' className='hover:underline'>
                Tro Thanh Nguoi Ban
              </NavLink>
            )}
            <span>|</span>
            <button type='button' className='hover:underline'>Tai ung dung</button>
            <span>|</span>
            <button type='button' className='hover:underline'>Ket noi</button>
          </div>

          <div className='flex items-center gap-4'>
            <button type='button' onClick={handleBellClick} className='relative hover:underline flex items-center gap-1'>
              <span>Thong Bao</span>
              {unreadCount > 0 && (
                <span className='bg-orange-500 text-white text-[10px] font-bold rounded-full px-1.5 min-w-[18px] text-center'>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button type='button' className='hover:underline'>Ho Tro</button>
            <button type='button' className='hover:underline'>Tieng Viet</button>

            {token ? (
              <div className='group relative'>
                <button type='button' className='flex items-center gap-2'>
                  <img src={assets.profile_icon} alt='Profile' className='w-6 h-6 rounded-full bg-gray-100 p-0.5' />
                  <span className='max-w-[120px] truncate'>{userProfile?.name || 'Tai khoan'}</span>
                </button>
                <div className='group-hover:block hidden absolute right-0 pt-2 z-50'>
                  <div className='flex flex-col gap-2 w-40 py-3 px-4 bg-white text-gray-600 rounded shadow-lg'>
                    <button onClick={() => navigate('/my-profile')} className='text-left hover:text-black'>My Profile</button>
                    <button onClick={() => navigate('/orders')} className='text-left hover:text-black'>Orders</button>
                    <button onClick={handleBellClick} className='text-left hover:text-black'>Thong bao</button>
                    <button onClick={logoutHandler} className='text-left hover:text-black'>Logout</button>
                  </div>
                </div>
              </div>
            ) : (
              <button type='button' onClick={() => navigate('/login')} className='hover:underline'>Dang nhap</button>
            )}
          </div>
        </div>

        <div className='flex items-center gap-4 py-4'>
          <Link to='/' className='shrink-0'>
            <img src={assets.logo} alt='Logo' className='w-32 md:w-40' />
          </Link>

          <div className='flex-1 max-w-4xl'>
            <NavbarSearch />
          </div>

          <Link to='/cart' className='relative shrink-0 ml-1'>
            <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.8} stroke='currentColor' className='w-9 h-9'>
              <path strokeLinecap='round' strokeLinejoin='round' d='M2.25 3h1.386a1.5 1.5 0 011.415 1.005L5.63 6m0 0L7.5 13.125A1.5 1.5 0 008.95 14.25h7.8a1.5 1.5 0 001.45-1.125L19.5 7.5H6.75m0 0L5.63 6m3.12 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm8.25 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z' />
            </svg>
            <p className='absolute -top-1 -right-2 min-w-[20px] h-5 px-1 flex items-center justify-center bg-orange-500 text-white rounded-full text-[11px] font-bold'>
              {getCartCount()}
            </p>
          </Link>

          <button type='button' onClick={() => setMobileMenuVisible(true)} className='md:hidden'>
            <img src={assets.menu_icon} alt='Menu' className='w-6 cursor-pointer' />
          </button>
        </div>
      </div>

      {mobileMenuVisible && (
        <div className='fixed inset-0 bg-white z-50 p-5 text-gray-700'>
          <div className='flex justify-between items-center mb-8'>
            <img src={assets.logo} alt='Logo' className='w-28' />
            <button type='button' onClick={() => setMobileMenuVisible(false)} className='text-xl'>×</button>
          </div>
          <div className='flex flex-col gap-4 text-sm'>
            <NavLink to='/' onClick={() => setMobileMenuVisible(false)}>HOME</NavLink>
            <NavLink to='/collection' onClick={() => setMobileMenuVisible(false)}>COLLECTION</NavLink>
            <NavLink to='/about' onClick={() => setMobileMenuVisible(false)}>ABOUT</NavLink>
            <NavLink to='/contact' onClick={() => setMobileMenuVisible(false)}>CONTACT</NavLink>
            {userRole === 'vendor' ? (
              <button
                type='button'
                onClick={() => {
                  setMobileMenuVisible(false)
                  window.open('http://localhost:5174/add', '_blank')
                }}
                className='text-left'
              >
                VENDOR'S PAGE
              </button>
            ) : (
              <NavLink to='/vendor-register' onClick={() => setMobileMenuVisible(false)}>BECOME A VENDOR</NavLink>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

export default Navbar
