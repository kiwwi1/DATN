import React from 'react'
import { useContext } from 'react';
import { ShopContext } from '../context/ShopContext';
import { formatPrice } from '../utils/priceFormat';

const CartTotal = ({ selectedTotal }) => {
    const { delivery_fee, getCartAmount } = useContext(ShopContext);
    
    // If selectedTotal is provided (from Cart page), use it; otherwise use full cart amount
    const subtotal = selectedTotal !== undefined ? selectedTotal : getCartAmount();
    const shipping = subtotal === 0 ? 0 : (subtotal >= 500000 ? 0 : delivery_fee);
    const total = subtotal + shipping;
    
    return (
        <div className='w-full'>
            <h2 className='text-xl font-bold text-gray-800 mb-4 pb-3 border-b-2 border-gray-200'>
                TỔNG ĐƠN HÀNG
            </h2>

            <div className='space-y-4'>
                {/* Subtotal */}
                <div className='flex justify-between items-center text-gray-700'>
                    <span className='text-sm'>Tạm tính:</span>
                    <span className='font-medium'>{formatPrice(subtotal)}</span>
                </div>

                {/* Shipping */}
                <div className='flex justify-between items-center text-gray-700'>
                    <span className='text-sm'>
                        Phí vận chuyển:
                        {subtotal > 0 && subtotal < 500000 && (
                            <span className='block text-xs text-gray-500 mt-1'>
                                (Miễn phí cho đơn ≥ 500.000₫)
                            </span>
                        )}
                    </span>
                    <span className='font-medium'>
                        {shipping === 0 ? (
                            <span className='text-green-600'>Miễn phí</span>
                        ) : (
                            formatPrice(shipping)
                        )}
                    </span>
                </div>

                <hr className='border-gray-300'/>

                {/* Total */}
                <div className='flex justify-between items-center py-3 bg-orange-50 rounded-lg px-4 -mx-4'>
                    <span className='font-bold text-gray-800'>Tổng cộng:</span>
                    <span className='font-bold text-2xl text-orange-600'>
                        {formatPrice(total)}
                    </span>
                </div>

                {/* Savings Info */}
                {subtotal >= 500000 && (
                    <div className='flex items-center gap-2 text-xs text-green-600 bg-green-50 p-3 rounded-lg'>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>

                    </div>
                )}

                {/* Almost free shipping */}
                {subtotal > 0 && subtotal < 500000 && (
                    <div className='flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-3 rounded-lg'>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                        </svg>
                        <span>Mua thêm {formatPrice(500000 - subtotal)} để được miễn phí vận chuyển</span>
                    </div>
                )}
            </div>
        </div>
    )
}

export default CartTotal