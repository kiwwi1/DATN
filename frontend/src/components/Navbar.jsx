import React, { useState, useEffect } from 'react'
import {assets} from '../assets/assets'
import { Link, NavLink } from 'react-router-dom'
import { useContext } from 'react'
import { ShopContext } from '../context/ShopContext'



const Navbar = () => {
    const [mobileMenuVisible, setMobileMenuVisible] = useState(false)
    const {token, setToken, navigate, setCartItems, userRole} = useContext(ShopContext);

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

            <div className='group relative'>
                <img onClick={()=> token ? null : navigate('/login') } src={assets.profile_icon} className='w-5 cursor-pointer' />
                {/* Dropdown Menu */}
                {token &&
                 <div className='group-hover:block hidden absolute dropdown-menu right-0 pt-2 z-50'>
                    <div className='flex flex-col gap-2 w-36 py-3 px-5 bg-slate-100 text-gray-500 rounded shadow-md'>
                        <p onClick={()=>navigate('/my-profile')} className='cursor-pointer hover:text-black'>My Profile</p>
                        <p onClick={()=>navigate('/orders')} className='cursor-pointer hover:text-black'>Orders</p>
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