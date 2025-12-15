import React, { useEffect, useState } from 'react';
import { useContext } from 'react';
import { ShopContext } from '../context/ShopContext';
import Title from '../components/Title';
import { assets } from '../assets/assets';
import CartTotal from '../components/CartTotal';
import { formatPrice } from '../utils/priceFormat';

const Cart = () => {
  const { cartItems, products, updateQuantity, navigate, token } = useContext(ShopContext);

  const [cartData, setCartData] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]); // Array of selected item indices
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    // Chỉ xử lý khi cả products và cartItems đều đã có data
    if (products.length > 0) {
      const tempData = [];
      for (const items in cartItems) {
        for (const item in cartItems[items]) {
          if (cartItems[items][item] > 0) {
            tempData.push({
              _id: items,
              size: item,
              quantity: cartItems[items][item],
            });
          }
        }
      }
      setCartData(tempData);
      // Auto-select all items when cart data changes
      setSelectedItems(tempData.map((_, index) => index));
      setSelectAll(tempData.length > 0);
    }
  }, [cartItems, token, products]); // Thêm products vào dependency

  // Toggle individual item selection
  const toggleItemSelection = (index) => {
    setSelectedItems(prev => {
      if (prev.includes(index)) {
        const newSelected = prev.filter(i => i !== index);
        setSelectAll(newSelected.length === cartData.length && cartData.length > 0);
        return newSelected;
      } else {
        const newSelected = [...prev, index];
        setSelectAll(newSelected.length === cartData.length);
        return newSelected;
      }
    });
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([]);
      setSelectAll(false);
    } else {
      setSelectedItems(cartData.map((_, index) => index));
      setSelectAll(true);
    }
  };

  // Calculate total for selected items only
  const getSelectedTotal = () => {
    return cartData.reduce((total, item, index) => {
      if (selectedItems.includes(index)) {
        const productData = products.find(p => p._id === item._id);
        if (productData) {
          return total + (productData.price * item.quantity);
        }
      }
      return total;
    }, 0);
  };

  // Get selected items count
  const getSelectedCount = () => selectedItems.length;

  return (
    <div className='border-t pt-14'>
      <div className='text-center mb-8'>
        <Title text1={'GIỎ HÀNG'} text2={' CỦA BẠN'} />
        {cartData.length > 0 && (
          <div className='mt-4'>
            <p className='text-gray-600'>
              Bạn có {cartData.length} sản phẩm trong giỏ hàng
            </p>
            <p className='text-orange-600 font-medium mt-1'>
              Đã chọn {getSelectedCount()} sản phẩm để thanh toán
            </p>
          </div>
        )}
      </div>

      <div className='max-w-6xl mx-auto'>
        {/* Hiển thị loading khi products chưa load xong */}
        {products.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-16'>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mb-4'></div>
            <p className='text-gray-500'>Đang tải giỏ hàng...</p>
          </div>
        ) : cartData.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-16 bg-gray-50 rounded-lg'>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-20 h-20 text-gray-400 mb-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            <p className='text-xl font-medium text-gray-700 mb-2'>Giỏ hàng của bạn đang trống</p>
            <p className='text-gray-500 mb-6'>Hãy thêm sản phẩm để tiếp tục mua sắm</p>
            <button 
              onClick={() => navigate('/collection')}
              className='bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium transition-colors'
            >
              Tiếp tục mua sắm
            </button>
          </div>
        ) : (
          <div className='space-y-4'>
            {/* Select All Header */}
            <div className='bg-white border border-gray-200 rounded-lg p-4 shadow-sm'>
              <label className='flex items-center gap-3 cursor-pointer'>
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={toggleSelectAll}
                  className='w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-pointer'
                />
                <span className='font-medium text-gray-900'>
                  Chọn tất cả ({cartData.length} sản phẩm)
                </span>
              </label>
            </div>

            {cartData.map((item, index) => {
            const productData = products.find((product) => product._id === item._id);
            
            // Skip rendering this item if product data is not found
            if (!productData) {
              console.warn(`Product with ID ${item._id} not found`);
              return null;
            }
            
            return (
              <div
                key={index}
                className={`bg-white border rounded-lg p-4 hover:shadow-md transition-all ${
                  selectedItems.includes(index) 
                    ? 'border-orange-500 shadow-sm' 
                    : 'border-gray-200'
                }`}
              >
                <div className='flex flex-col sm:flex-row gap-4'>
                  {/* Checkbox */}
                  <div className='flex items-start pt-2'>
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(index)}
                      onChange={() => toggleItemSelection(index)}
                      className='w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-pointer'
                    />
                  </div>

                  {/* Product Image */}
                  <div className='flex-shrink-0'>
                    <img
                      className='w-full sm:w-24 h-24 object-cover rounded-lg'
                      src={productData.image && productData.image.length > 0 ? productData.image[0] : assets.placeholder_image}
                      alt={productData.name}
                    />
                  </div>

                  {/* Product Info */}
                  <div className='flex-1 min-w-0'>
                    <h3 className='font-medium text-gray-900 mb-1 line-clamp-2'>
                      {productData.name}
                    </h3>
                    {productData.brand && (
                      <p className='text-sm text-blue-600 mb-2'>{productData.brand}</p>
                    )}
                    <div className='flex flex-wrap items-center gap-3 mb-2'>
                      <span className='text-sm px-3 py-1 bg-gray-100 rounded-full'>
                        {item.size}
                      </span>
                      {productData.discount > 0 && (
                        <span className='text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium'>
                          -{productData.discount}%
                        </span>
                      )}
                    </div>
                    
                    {/* Price */}
                    <div className='flex items-baseline gap-2'>
                      <p className='text-lg font-bold text-orange-600'>
                        {formatPrice(productData.price)}
                      </p>
                      {productData.discount > 0 && productData.originalPrice && (
                        <p className='text-sm text-gray-400 line-through'>
                          {formatPrice(productData.originalPrice)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quantity and Actions */}
                  <div className='flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-4'>
                    {/* Quantity Input */}
                    <div className='flex items-center border border-gray-300 rounded-lg overflow-hidden'>
                      <button
                        onClick={() => updateQuantity(item._id, item.size, Math.max(1, item.quantity - 1))}
                        className='px-3 py-2 hover:bg-gray-100 transition-colors'
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                        </svg>
                      </button>
                      <input 
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (value > 0) {
                            updateQuantity(item._id, item.size, value);
                          }
                        }} 
                        className='w-12 text-center py-2 border-x border-gray-300 focus:outline-none' 
                        type="number" 
                        min={1} 
                        value={item.quantity}
                      />
                      <button
                        onClick={() => updateQuantity(item._id, item.size, item.quantity + 1)}
                        className='px-3 py-2 hover:bg-gray-100 transition-colors'
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </button>
                    </div>

                    {/* Subtotal */}
                    <div className='text-right sm:mb-4'>
                      <p className='text-xs text-gray-500'>Tạm tính</p>
                      <p className='text-lg font-bold text-gray-900'>
                        {formatPrice(productData.price * item.quantity)}
                      </p>
                    </div>

                    {/* Remove Button */}
                    <button 
                      onClick={() => updateQuantity(item._id, item.size, 0)}
                      className='text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors'
                      title='Xóa sản phẩm'
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>
      {cartData.length > 0 && (
        <div className='mt-8 mb-16 max-w-6xl mx-auto'>
          <div className='flex flex-col lg:flex-row gap-8'>
            {/* Continue Shopping */}
            <div className='flex-1'>
              <button 
                onClick={() => navigate('/collection')}
                className='w-full sm:w-auto border-2 border-gray-300 text-gray-700 hover:border-orange-500 hover:text-orange-600 px-8 py-3 rounded-lg font-medium transition-all'
              >
                ← Tiếp tục mua sắm
              </button>
            </div>

            {/* Cart Total and Checkout */}
            <div className='lg:w-1/2'>
              <div className='bg-gray-50 rounded-lg p-6'>
                {/* Selected Items Summary */}
                {getSelectedCount() < cartData.length && (
                  <div className='mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg'>
                    <p className='text-sm text-blue-800'>
                      ℹ️ Bạn đang thanh toán {getSelectedCount()}/{cartData.length} sản phẩm
                    </p>
                  </div>
                )}
                
                <CartTotal selectedTotal={getSelectedTotal()} />
                
                <button 
                  onClick={() => {
                    if (getSelectedCount() === 0) {
                      alert('Vui lòng chọn ít nhất một sản phẩm để thanh toán');
                      return;
                    }
                    // Store selected items in sessionStorage to use in PlaceOrder
                    const selectedCartData = cartData.filter((_, index) => selectedItems.includes(index));
                    sessionStorage.setItem('selectedCartItems', JSON.stringify(selectedCartData));
                    navigate('/place-order');
                  }} 
                  className={`w-full font-medium py-4 rounded-lg mt-6 transition-all shadow-lg hover:shadow-xl active:scale-95 ${
                    getSelectedCount() === 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-orange-600 hover:bg-orange-700 text-white'
                  }`}
                  disabled={getSelectedCount() === 0}
                >
                  Thanh toán ({getSelectedCount()} sản phẩm) →
                </button>
                
                {/* Payment Methods */}
                <div className='mt-4 flex items-center justify-center gap-3 text-xs text-gray-500'>
                  <svg className='w-8 h-6' viewBox="0 0 38 24" fill="none">
                    <rect width="38" height="24" rx="3" fill="#1434CB"/>
                    <path d="M14.5 12L17.5 15L23.5 9" stroke="white" strokeWidth="2"/>
                  </svg>
                  <svg className='w-8 h-6' viewBox="0 0 38 24" fill="none">
                    <rect width="38" height="24" rx="3" fill="#EB001B"/>
                    <circle cx="19" cy="12" r="7" fill="#F79E1B" fillOpacity="0.7"/>
                  </svg>
                  <span>Thanh toán an toàn</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;