import React, { useContext, useEffect, useMemo, useState } from 'react'
import { assets } from '../../assets/assets'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ShopContext } from '../../context/ShopContext'
import axios from 'axios'
import NavbarSearch from './NavbarSearch'

const Navbar = () => {
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false)
  const [isShrunk, setIsShrunk] = useState(false)
  const [showSearchPanel, setShowSearchPanel] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
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

  const navLinks = useMemo(
    () => [
      { to: '/', label: 'Trang chủ' },
      { to: '/collection', label: 'Sản phẩm' },
      { to: '/recommendations', label: 'Gợi ý cho bạn' },
      { to: '/about', label: 'Về chúng tôi' },
      { to: '/contact', label: 'Liên hệ' },
    ],
    []
  )

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
        console.error('Lỗi khi tải giỏ hàng:', error)
      }
    }

    fetchCartData()
  }, [token, setCartItems, backendUrl])

  useEffect(() => {
    const handleScroll = () => {
      setIsShrunk(window.scrollY > 50)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    setShowSearchPanel(false)
    setMobileMenuVisible(false)
    setShowProfileMenu(false)
  }, [location.pathname, location.search])

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

  const openVendorPortal = () => {
    window.open('http://localhost:5174/add', '_blank')
  }

  const primaryLinks = navLinks.slice(0, 2)
  const secondaryLinks = navLinks.slice(2)

  return (
    <header
      className={`${isHomePage ? 'sticky top-0' : 'relative'} z-50 -mx-4 md:-mx-[7vw] lg:-mx-[9vw] pointer-events-none transition-all duration-300 ease-in-out ${
        isShrunk ? 'pt-3 pb-2' : 'pt-5 pb-4'
      }`}
    >
      <nav className='px-4 md:px-[7vw] lg:px-[9vw] pointer-events-auto'>
        <div className='max-w-[1280px] mx-auto'>
          <div
            id='main-nav-container'
            className={`glass-shimmer border border-white/70 rounded-full flex items-center gap-3 transition-all duration-300 ease-in-out bg-gradient-to-r from-rose-50/80 via-orange-50/75 to-cyan-50/80 ${
              isShrunk
                ? 'py-2.5 px-4 md:px-6 shadow-[0_14px_36px_rgba(236,72,153,0.2)] backdrop-blur-xl'
                : 'py-3.5 px-4 md:px-8 shadow-[0_10px_30px_rgba(236,72,153,0.12)] backdrop-blur'
            }`}
          >
            <div className='hidden md:flex items-center gap-5 flex-1 min-w-0'>
              {primaryLinks.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `nav-link text-[11px] uppercase font-semibold transition-all ${
                      isShrunk ? 'tracking-[0.12em]' : 'tracking-[0.18em]'
                    } ${isActive ? 'text-rose-600' : 'text-slate-600 hover:text-rose-500'}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>

            <div className='flex-1 md:flex-none text-center'>
              <Link
                to='/'
                id='main-nav-logo'
                className={`prata-regular inline-block text-slate-800 tracking-tight transition-all duration-300 ${
                  isShrunk ? 'text-2xl' : 'text-3xl'
                }`}
              >
                Lumière
              </Link>
            </div>

            <div className='flex items-center justify-end gap-3 flex-1 min-w-0'>
              <div className='hidden lg:flex items-center gap-4'>
                {secondaryLinks.map((item, index) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `nav-link text-[11px] uppercase font-semibold transition-all ${
                        index === 2 ? 'hidden xl:block' : ''
                      } ${isShrunk ? 'tracking-[0.12em]' : 'tracking-[0.18em]'} ${
                        isActive ? 'text-rose-600' : 'text-slate-600 hover:text-rose-500'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>

              <div className='flex items-center gap-2 border-l border-slate-300/50 pl-3'>
                <button
                  type='button'
                  onClick={() => setShowSearchPanel((prev) => !prev)}
                  className='nav-icon-btn rounded-full p-2 text-slate-600 hover:bg-white/80 hover:text-rose-600 transition-colors'
                  aria-label='Mở tìm kiếm'
                >
                  <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.8} stroke='currentColor' className='w-5 h-5'>
                    <path strokeLinecap='round' strokeLinejoin='round' d='m21 21-4.35-4.35m0 0a7.5 7.5 0 1 0-10.607 0 7.5 7.5 0 0 0 10.607 0Z' />
                  </svg>
                </button>

                {token && (
                  <button
                    type='button'
                    onClick={handleBellClick}
                    className='nav-icon-btn relative rounded-full p-2 text-slate-600 hover:bg-white/80 hover:text-rose-600 transition-colors'
                    aria-label='Thông báo'
                  >
                    <img src={assets.bell_icon} alt='Thông báo' className='w-4.5 h-4.5' />
                    {unreadCount > 0 && (
                      <span className='absolute top-0.5 right-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full px-1 min-w-[16px] text-center'>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                )}

                <Link
                  to='/cart'
                  className='nav-icon-btn relative rounded-full p-2 text-slate-600 hover:bg-white/80 hover:text-rose-600 transition-colors'
                  aria-label='Giỏ hàng'
                >
                  <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.8} stroke='currentColor' className='w-5 h-5'>
                    <path strokeLinecap='round' strokeLinejoin='round' d='M2.25 3h1.386a1.5 1.5 0 011.415 1.005L5.63 6m0 0L7.5 13.125A1.5 1.5 0 008.95 14.25h7.8a1.5 1.5 0 001.45-1.125L19.5 7.5H6.75m0 0L5.63 6m3.12 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm8.25 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z' />
                  </svg>
                  <span className='absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-rose-500 text-white rounded-full text-[10px] font-bold'>
                    {getCartCount()}
                  </span>
                </Link>

                {token ? (
                  <div className='relative hidden md:block'>
                    <button
                      type='button'
                      onClick={() => setShowProfileMenu((prev) => !prev)}
                      className='rounded-full p-1.5 hover:bg-white/80 transition-colors'
                      aria-label='Mở menu hồ sơ'
                    >
                      <img src={assets.profile_icon} alt='Hồ sơ' className='w-6 h-6 rounded-full bg-rose-100 p-0.5' />
                    </button>
                    {showProfileMenu && (
                      <div className='absolute right-0 pt-2 z-[70]'>
                      <div className='flex flex-col gap-2 w-48 py-3 px-4 bg-white text-slate-600 rounded-2xl shadow-lg border border-rose-100'>
                        <p className='text-xs text-slate-400 truncate'>{userProfile?.name || 'Tài khoản'}</p>
                        <button onClick={() => { setShowProfileMenu(false); navigate('/my-profile') }} className='text-left hover:text-black'>Trang cá nhân</button>
                        <button onClick={() => { setShowProfileMenu(false); navigate('/orders') }} className='text-left hover:text-black'>Đơn mua</button>
                        <button onClick={() => { setShowProfileMenu(false); handleBellClick() }} className='text-left hover:text-black'>Thông báo</button>
                        {userRole === 'vendor' ? (
                          <button onClick={() => { setShowProfileMenu(false); openVendorPortal() }} className='text-left hover:text-black'>Kênh người bán</button>
                        ) : (
                          <button onClick={() => { setShowProfileMenu(false); navigate('/vendor-register') }} className='text-left hover:text-black'>Trở thành người bán</button>
                        )}
                        <button onClick={() => { setShowProfileMenu(false); logoutHandler() }} className='text-left text-rose-600 hover:text-rose-700'>Đăng xuất</button>
                      </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className='hidden md:flex items-center gap-2'>
                    <button
                      type='button'
                      onClick={() => navigate('/vendor-register')}
                      className='rounded-full px-3 py-1.5 bg-white/80 border border-rose-100 text-rose-600 text-[11px] font-semibold tracking-[0.08em] uppercase hover:bg-rose-50 transition'
                    >
                      Trở thành người bán
                    </button>
                    <button
                      type='button'
                      onClick={() => navigate('/login')}
                      className='rounded-full px-3 py-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-xs font-semibold tracking-[0.08em] uppercase hover:brightness-110 transition'
                    >
                      Đăng nhập
                    </button>
                  </div>
                )}

                <button type='button' onClick={() => setMobileMenuVisible(true)} className='md:hidden rounded-full p-2 hover:bg-white/80'>
                  <img src={assets.menu_icon} alt='Menu' className='w-5' />
                </button>
              </div>
            </div>
          </div>

          {showSearchPanel && (
            <div className='mt-3 rounded-3xl border border-white/80 bg-white/85 backdrop-blur-xl shadow-[0_14px_32px_rgba(236,72,153,0.14)] p-3 md:p-4'>
              <NavbarSearch />
            </div>
          )}
        </div>
      </nav>

      {mobileMenuVisible && (
        <div className='fixed inset-0 bg-gradient-to-b from-rose-50 via-orange-50 to-cyan-50 z-50 p-5 text-slate-700 pointer-events-auto'>
          <div className='flex justify-between items-center mb-6'>
            <span className='prata-regular text-3xl text-slate-800'>Lumière</span>
            <button type='button' onClick={() => setMobileMenuVisible(false)} className='text-2xl px-2'>×</button>
          </div>

          <div className='space-y-2 border-b border-white/80 pb-4'>
            {navLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuVisible(false)}
                className='block rounded-xl px-4 py-2.5 text-sm font-medium bg-white/70 hover:bg-white'
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className='space-y-2 pt-4'>
            <NavLink
              to='/cart'
              onClick={() => setMobileMenuVisible(false)}
              className='block rounded-xl px-4 py-2.5 text-sm font-medium bg-white/70 hover:bg-white'
            >
              Giỏ hàng ({getCartCount()})
            </NavLink>
            {token && (
              <NavLink
                to='/orders'
                onClick={() => setMobileMenuVisible(false)}
                className='block rounded-xl px-4 py-2.5 text-sm font-medium bg-white/70 hover:bg-white'
              >
                Đơn mua
              </NavLink>
            )}
            {token && (
              <button
                type='button'
                onClick={() => {
                  setMobileMenuVisible(false)
                  handleBellClick()
                }}
                className='w-full text-left rounded-xl px-4 py-2.5 text-sm font-medium bg-white/70 hover:bg-white'
              >
                Thông báo
              </button>
            )}
            {userRole === 'vendor' ? (
              <button
                type='button'
                onClick={() => {
                  setMobileMenuVisible(false)
                  openVendorPortal()
                }}
                className='w-full text-left rounded-xl px-4 py-2.5 text-sm font-medium bg-white/70 hover:bg-white'
              >
                Kênh người bán
              </button>
            ) : (
              <NavLink
                to='/vendor-register'
                onClick={() => setMobileMenuVisible(false)}
                className='block rounded-xl px-4 py-2.5 text-sm font-medium bg-white/70 hover:bg-white'
              >
                Trở thành người bán
              </NavLink>
            )}
            {token ? (
              <>
                <NavLink
                  to='/my-profile'
                  onClick={() => setMobileMenuVisible(false)}
                  className='block rounded-xl px-4 py-2.5 text-sm font-medium bg-white/70 hover:bg-white'
                >
                  Trang cá nhân
                </NavLink>
                <button
                  type='button'
                  onClick={() => {
                    setMobileMenuVisible(false)
                    logoutHandler()
                  }}
                  className='w-full text-left rounded-xl px-4 py-2.5 text-sm font-medium text-rose-600 bg-white/70 hover:bg-rose-50'
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <button
                type='button'
                onClick={() => {
                  setMobileMenuVisible(false)
                  navigate('/login')
                }}
                className='w-full text-left rounded-xl px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white'
              >
                Đăng nhập
              </button>
            )}
          </div>
        </div>
      )}

      {showProfileMenu && (
        <button
          type='button'
          onClick={() => setShowProfileMenu(false)}
          aria-label='Đóng menu hồ sơ'
          className='fixed inset-0 z-[60] cursor-default'
        />
      )}
    </header>
  )
}

export default Navbar
