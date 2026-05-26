import React from 'react'
import { useContext } from 'react';
import { ShopContext } from '../../context/ShopContext';
import { formatPrice } from '../../utils/priceFormat';

const CartTotal = ({ selectedTotal, pricing }) => {
    const { delivery_fee, getCartAmount } = useContext(ShopContext);

    const hasPricing = pricing && typeof pricing.finalTotal === 'number';

    const subtotal = hasPricing
        ? Number(pricing.subtotal || 0)
        : (selectedTotal !== undefined ? selectedTotal : getCartAmount());

    const shopDiscount = hasPricing ? Number(pricing.shopDiscount || 0) : 0;
    const platformDiscount = hasPricing ? Number(pricing.platformDiscount || 0) : 0;
    const shippingFee = hasPricing
        ? Number(pricing.shippingFee || 0)
        : (subtotal === 0 ? 0 : (subtotal >= 500000 ? 0 : delivery_fee));
    const shippingDiscount = hasPricing ? Number(pricing.shippingDiscount || 0) : 0;

    const total = hasPricing
        ? Number(pricing.finalTotal || 0)
        : subtotal + shippingFee;

    return (
        <div className='w-full'>
            <h2 className='text-xl font-bold text-gray-800 mb-4 pb-3 border-b-2 border-gray-200'>
                TONG DON HANG
            </h2>

            <div className='space-y-3'>
                <div className='flex justify-between items-center text-gray-700'>
                    <span className='text-sm'>Tam tinh:</span>
                    <span className='font-medium'>{formatPrice(subtotal)}</span>
                </div>

                {shopDiscount > 0 && (
                    <div className='flex justify-between items-center text-gray-700'>
                        <span className='text-sm'>Giam gia shop:</span>
                        <span className='font-medium text-green-600'>- {formatPrice(shopDiscount)}</span>
                    </div>
                )}

                {platformDiscount > 0 && (
                    <div className='flex justify-between items-center text-gray-700'>
                        <span className='text-sm'>Giam gia san:</span>
                        <span className='font-medium text-green-600'>- {formatPrice(platformDiscount)}</span>
                    </div>
                )}

                <div className='flex justify-between items-center text-gray-700'>
                    <span className='text-sm'>Phi van chuyen:</span>
                    <span className='font-medium'>
                        {shippingFee === 0 ? (
                            <span className='text-green-600'>Mien phi</span>
                        ) : (
                            formatPrice(shippingFee)
                        )}
                    </span>
                </div>

                {shippingDiscount > 0 && (
                    <div className='flex justify-between items-center text-gray-700'>
                        <span className='text-sm'>Giam phi ship:</span>
                        <span className='font-medium text-green-600'>- {formatPrice(shippingDiscount)}</span>
                    </div>
                )}

                <hr className='border-gray-300'/>

                <div className='flex justify-between items-center py-3 bg-orange-50 rounded-lg px-4 -mx-4'>
                    <span className='font-bold text-gray-800'>Tong cong:</span>
                    <span className='font-bold text-2xl text-orange-600'>
                        {formatPrice(total)}
                    </span>
                </div>
            </div>
        </div>
    )
}

export default CartTotal
