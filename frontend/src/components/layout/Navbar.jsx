import React, { useState, useEffect } from 'react'
import {assets} from '../../assets/assets'
import { Link, NavLink } from 'react-router-dom'
import { useContext } from 'react'
import { ShopContext } from '../../context/ShopContext'



const Navbar = () => {
    const [mobileMenuVisible, setMobileMenuVisible] = useState(false)
    const {token, setToken, navigate, setCartItems, userRole, unreadCount, markAllNotificationsRead} = useContext(ShopContext);

    const {setShowSearch, getCartCount} = useContext(ShopContext);
    
    // Thêm useEffect để tự động cập nhật giỏ hàng khi token thay đổi
    useEffect(() => {
        const fetchCartData = async () => {
            if (token) {
                try {
                    const response = await fetch('http://localhost:4000/api/cart/get', {
                        headers: {
                            token: token
                        }
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                        setCartItems(data.cartData || {});
                    }
                } catch (error) {
                    console.error("Lỗi khi tải giỏ hàng:", error);
                }
            }
        };
        
        fetchCartData();
    }, [token, setCartItems]);
    
    const LogoutHandler = () => {
        navigate('/login')
        localStorage.removeItem('token')
        setToken('')
        setCartItems({})
    }

    const handleBellClick = () => {
        if (token) markAllNotificationsRead(token);
        navigate('/profile/notifications');
    };
  return (
    <div className='flex justify-between items-center py-5 font-medium relative z-50'>
        <Link to={'/'} >
        <img src={assets.logo} className='w-36' />
        </Link>

        <ul className='hidden sm:flex gap-5 text-sm text-gray-700'>
            <NavLink to='/' className='flex flex-col items-center gap-1'>
                <p>HOME</p>
                <hr className='w-2/4 border-2 border-none h-[1.5px] bg-gray-700 hidden' />
            </NavLink>
            <NavLink to='/collection' className='flex flex-col items-center gap-1'>
                <p>COLLECTION</p>
                <hr className='w-2/4 border-2 border-none h-[1.5px] bg-gray-700 hidden' />
            </NavLink>
            <NavLink to='/about' className='flex flex-col items-center gap-1'>
                <p>ABOUT</p>
                <hr className='w-2/4 border-2 border-none h-[1.5px] bg-gray-700 hidden' />
            </NavLink>
            <NavLink to='/contact' className='flex flex-col items-center gap-1'>
                <p>CONTACT</p>
                <hr className='w-2/4 border-2 border-none h-[1.5px] bg-gray-700 hidden' />
            </NavLink>
            {userRole === 'vendor' ? (
                <button 
                    onClick={() => {
                        // Pass token via URL parameter
                        window.open(`http://localhost:5174/add?vendorToken=${token}`, '_blank');
                    }}
                    className='flex flex-col items-center gap-1 cursor-pointer'
                >
                    <p>VENDOR'S PAGE</p>
                    <hr className='w-2/4 border-2 border-none h-[1.5px] bg-gray-700 hidden' />
                </button>
            ) : (
                <NavLink to='/vendor-register' className='flex flex-col items-center gap-1'>
                    <p>BECOME A VENDOR</p>
                    <hr className='w-2/4 border-2 border-none h-[1.5px] bg-gray-700 hidden' />
                </NavLink>
            )}
            
        </ul>
        <div className='flex gap-5 items-center'>

            <img onClick={()=>setShowSearch(true)} src={assets.search_icon} className='w-5 cursor-pointer' />

            {token && (
                <div className='relative cursor-pointer' onClick={handleBellClick}>
                    <svg className='w-7 h-7 text-gray-700' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' />
                    </svg>
                    {unreadCount > 0 && (
                        <span className='absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full leading-none'>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </div>
            )}

            <div className='group relative'>
                <img onClick={()=> token ? null : navigate('/login') } src={assets.profile_icon} className='w-5 cursor-pointer' />
                {/* Dropdown Menu */}
                {token &&
                 <div className='group-hover:block hidden absolute dropdown-menu right-0 pt-2 z-50'>
                    <div className='flex flex-col gap-2 w-36 py-3 px-5 bg-slate-100 text-gray-500 rounded shadow-md'>
                        <p onClick={()=>navigate('/my-profile')} className='cursor-pointer hover:text-black'>My Profile</p>
                        <p onClick={()=>navigate('/orders')} className='cursor-pointer hover:text-black'>Orders</p>
                        <p onClick={handleBellClick} className='cursor-pointer hover:text-black flex items-center gap-1'>
                            Thông báo
                            {unreadCount > 0 && <span className='bg-red-500 text-white text-[9px] rounded-full px-1'>{unreadCount}</span>}
                        </p>
                        <p onClick={LogoutHandler} className='cursor-pointer hover:text-black'>Logout</p>
                    </div>
                </div>}
                

            </div>
            <Link to='/cart' className='relative'>
                    <img src={assets.cart_icon} className='w-5 min-w-5' />
                    <p className='absolute right-[-5px] w-4 text-center leading-4 bg-black text-white aspect-square rounded-full text-[8px]'>{getCartCount()}</p>
            </Link>
            <img onClick={()=>setMobileMenuVisible(true)} src={assets.menu_icon} className='w-5 cursor-pointer sm:hidden' /> 
        </div> 
        {/* Mobile Menu */}
        {mobileMenuVisible && (
          <div className="fixed inset-0 bg-white z-50 p-5">
            <div className="flex justify-end">
              <img onClick={()=>setMobileMenuVisible(false)} src={assets.close_icon || "×"} className="w-5 cursor-pointer" />
            </div>
            <ul className="flex flex-col gap-5 text-sm text-gray-700 items-center mt-10">
              <NavLink to='/' onClick={()=>setMobileMenuVisible(false)} className='flex flex-col items-center gap-1'>
                <p>HOME</p>
              </NavLink>
              <NavLink to='/collection' onClick={()=>setMobileMenuVisible(false)} className='flex flex-col items-center gap-1'>
                <p>COLLECTION</p>
              </NavLink>
              <NavLink to='/about' onClick={()=>setMobileMenuVisible(false)} className='flex flex-col items-center gap-1'>
                <p>ABOUT</p>
              </NavLink>
              <NavLink to='/contact' onClick={()=>setMobileMenuVisible(false)} className='flex flex-col items-center gap-1'>
                <p>CONTACT</p>
              </NavLink>
              {userRole === 'vendor' ? (
                <button 
                    onClick={() => {
                        setMobileMenuVisible(false);
                        // Pass token via URL parameter
                        window.open(`http://localhost:5174/add?vendorToken=${token}`, '_blank');
                    }}
                    className='flex flex-col items-center gap-1 cursor-pointer'
                >
                    <p>VENDOR'S PAGE</p>
                </button>
              ) : (
                <NavLink to='/vendor-register' onClick={()=>setMobileMenuVisible(false)} className='flex flex-col items-center gap-1'>
                    <p>BECOME A VENDOR</p>
                </NavLink>
              )}
            </ul>
          </div>
        )}


    </div>
  )
}

export default Navbar