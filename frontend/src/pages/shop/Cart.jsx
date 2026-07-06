import React, { useEffect, useState } from 'react';
import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ShopContext } from '../../context/ShopContext';
import CartTotal from '../../components/cart/CartTotal';
import { formatPrice } from '../../utils/priceFormat';
import { formatImageUrl, asImageArray } from '../../utils/imageUtils';
import { localizeProductName } from '../../utils/productNameUtils';
import { isDefaultCartOptionKey } from '../../constants/cartOption';
import { assets } from '../../assets/assets';

const Cart = () => {
  const { cartItems, products, updateQuantity, navigate, token, trackInteraction } = useContext(ShopContext);

  const [cartData, setCartData] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]); // Array of selected item keys: "productId_size"
  const [selectAll, setSelectAll] = useState(false);

  // Helper check stock status for a cart item
  const checkOutOfStock = (item) => {
    const productData = products.find(p => p._id === item._id);
    if (!productData) return true;
    if (productData.isActive === false) return true;
    if (Array.isArray(productData.variants) && productData.variants.length > 0) {
      const variant = productData.variants.find(v => 
        v.variantKey === item.size || 
        v.size === item.size ||
        (v.combination && Object.values(v.combination).includes(item.size))
      );
      if (variant) return variant.stock <= 0;
    }
    return productData.stock <= 0;
  };

  useEffect(() => {
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
      
      // Preserve existing selections, but filter out items that are no longer present or out of stock
      setSelectedItems(prev => {
        const validKeys = new Set(tempData.filter(item => !checkOutOfStock(item)).map(item => `${item._id}_${item.size}`));
        return prev.filter(key => validKeys.has(key));
      });
    }
  }, [cartItems, token, products]);

  // Monitor selected items to update Select All state
  useEffect(() => {
    const inStockItems = cartData.filter(item => !checkOutOfStock(item));
    const totalInStock = inStockItems.length;
    
    if (totalInStock === 0) {
      setSelectAll(false);
      return;
    }
    
    const inStockKeys = new Set(inStockItems.map(item => `${item._id}_${item.size}`));
    const currentSelectedInStock = selectedItems.filter(key => inStockKeys.has(key));
    setSelectAll(currentSelectedInStock.length === totalInStock);
  }, [selectedItems, cartData]);

  // Group cart items by vendor
  const getGroupedCartData = () => {
    const groups = {};
    cartData.forEach((item) => {
      const productData = products.find(p => p._id === item._id);
      if (!productData) return;
      
      const vendorId = productData.vendorId || 'system';
      const vendorName = productData.vendorShopName || 'Shop Hệ Thống';
      
      if (!groups[vendorId]) {
        groups[vendorId] = {
          vendorId,
          vendorName,
          items: [],
        };
      }
      groups[vendorId].items.push({
        ...item,
        productData,
      });
    });
    return Object.values(groups);
  };

  // Check if all in-stock products of a shop group are selected
  const isShopAllSelected = (group) => {
    const inStockShopItems = group.items.filter(item => !checkOutOfStock(item));
    if (inStockShopItems.length === 0) return false;
    return inStockShopItems.every(item => selectedItems.includes(`${item._id}_${item.size}`));
  };

  // Toggle select all items of a shop group
  const toggleShopSelection = (group) => {
    const inStockShopKeys = group.items.filter(item => !checkOutOfStock(item)).map(item => `${item._id}_${item.size}`);
    const allSelected = isShopAllSelected(group);
    
    setSelectedItems(prev => {
      if (allSelected) {
        // Remove all keys of this shop
        return prev.filter(key => !inStockShopKeys.includes(key));
      } else {
        // Add all keys of this shop (avoiding duplicates)
        const otherKeys = prev.filter(key => !inStockShopKeys.includes(key));
        return [...otherKeys, ...inStockShopKeys];
      }
    });
  };

  // Toggle individual item selection
  const toggleItemSelection = (item) => {
    if (checkOutOfStock(item)) return;
    const itemKey = `${item._id}_${item.size}`;
    
    setSelectedItems(prev => {
      if (prev.includes(itemKey)) {
        return prev.filter(key => key !== itemKey);
      } else {
        return [...prev, itemKey];
      }
    });
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([]);
    } else {
      const inStockKeys = cartData.filter(item => !checkOutOfStock(item)).map(item => `${item._id}_${item.size}`);
      setSelectedItems(inStockKeys);
    }
  };

  // Calculate total for selected items only
  const getSelectedTotal = () => {
    return cartData.reduce((total, item) => {
      const itemKey = `${item._id}_${item.size}`;
      if (selectedItems.includes(itemKey)) {
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
    <main className="overflow-x-hidden w-full max-w-full min-h-screen bg-gray-50/20 py-12 md:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Modern Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between border-b border-gray-200 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
              Giỏ hàng của bạn
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Quản lý các sản phẩm đã thêm vào giỏ và tiến hành thanh toán
            </p>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white border border-gray-100 rounded-3xl">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600 mb-4"></div>
            <p className="text-gray-500 text-sm">Đang tải giỏ hàng...</p>
          </div>
        ) : cartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white border border-gray-100 rounded-3xl shadow-sm max-w-2xl mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-16 h-16 text-gray-300 mb-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1,0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0,1-1.12-1.243l1.264-12A1.125 1.125 0 0,1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1,1-.75 0 .375.375 0 0,1 .75 0Zm7.5 0a.375.375 0 1,1-.75 0 .375.375 0 0,1 .75 0Z" />
            </svg>
            <p className="text-lg font-bold text-gray-800 mb-1">Giỏ hàng của bạn đang trống</p>
            <p className="text-sm text-gray-500 mb-6">Hãy thêm những sản phẩm yêu thích vào giỏ hàng.</p>
            <button 
              onClick={() => navigate('/collection')}
              className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-3 rounded-xl text-sm font-semibold transition-all duration-300 hover:shadow-lg active:scale-95"
            >
              Tiếp tục mua sắm
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Cart Items List */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Select All Actions Bar */}
              <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={toggleSelectAll}
                    className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                  />
                  <span className="font-semibold text-sm text-gray-800">
                    Chọn tất cả ({cartData.filter(item => !checkOutOfStock(item)).length} sản phẩm khả dụng)
                  </span>
                </label>
                
                {selectedItems.length > 0 && (
                  <button 
                    onClick={() => {
                      selectedItems.forEach(key => {
                        const [id, size] = key.split('_');
                        updateQuantity(id, size, 0);
                      });
                      setSelectedItems([]);
                    }}
                    className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
                  >
                    Xóa các mục đã chọn
                  </button>
                )}
              </div>

              {/* Grouped by Shop */}
              <div className="space-y-6">
                {getGroupedCartData().map((group) => {
                  const isShopSelected = isShopAllSelected(group);
                  const inStockItemsCount = group.items.filter(item => !checkOutOfStock(item)).length;
                  
                  return (
                    <div key={group.vendorId} className="bg-white border border-gray-200/60 rounded-3xl p-5 shadow-sm space-y-4">
                      
                      {/* Shop Header */}
                      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            disabled={inStockItemsCount === 0}
                            checked={isShopSelected}
                            onChange={() => toggleShopSelection(group)}
                            className={`w-4.5 h-4.5 text-orange-600 border-gray-300 rounded focus:ring-orange-500 ${inStockItemsCount === 0 ? 'cursor-not-allowed opacity-20' : 'cursor-pointer'}`}
                          />
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span className="font-bold text-sm text-gray-950 tracking-wide uppercase">
                              {group.vendorName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Items under this Shop */}
                      <div className="space-y-4">
                        {group.items.map((item, itemIdx) => {
                          const productData = item.productData;
                          const displayName = localizeProductName(productData.name);
                          const isOutOfStock = checkOutOfStock(item);
                          const itemKey = `${item._id}_${item.size}`;
                          
                          return (
                            <div
                              key={itemKey}
                              className={`group relative transition-all duration-300 border rounded-2xl p-5 bg-white ${
                                isOutOfStock
                                  ? 'border-gray-200 bg-gray-50/50 opacity-60'
                                  : selectedItems.includes(itemKey)
                                    ? 'border-orange-500 shadow-sm ring-1 ring-orange-500/10'
                                    : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
                              }`}
                            >
                              {/* Delete icon on top-right */}
                              <button 
                                onClick={() => updateQuantity(item._id, item.size, 0)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-gray-50 transition-all duration-200"
                                title="Xóa sản phẩm"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                              </button>

                              <div className="flex gap-4 items-center">
                                {/* Checkbox */}
                                <div className="flex items-center justify-center flex-shrink-0">
                                  <input
                                    type="checkbox"
                                    disabled={isOutOfStock}
                                    checked={selectedItems.includes(itemKey) && !isOutOfStock}
                                    onChange={() => toggleItemSelection(item)}
                                    className={`w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500 ${isOutOfStock ? 'cursor-not-allowed opacity-20' : 'cursor-pointer'}`}
                                  />
                                </div>

                                {/* Product Image */}
                                <Link
                                  to={`/product/${item._id}`}
                                  onClick={() => token && trackInteraction && trackInteraction(item._id, 'clicked')}
                                  className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 overflow-hidden rounded-xl bg-gray-50 border border-gray-100 block"
                                >
                                  <img
                                    className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${isOutOfStock ? 'filter grayscale brightness-90' : ''}`}
                                    src={
                                      asImageArray(productData.image).length
                                        ? formatImageUrl(productData.image, { variant: "thumb", width: 192, height: 192, fit: "cover", quality: 78, format: "webp" })
                                        : assets.placeholder_image
                                    }
                                    alt={displayName}
                                    referrerPolicy="no-referrer"
                                  />
                                  {isOutOfStock && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                      <span className="bg-red-600 text-white font-bold text-[9px] px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">
                                        Hết hàng
                                      </span>
                                    </div>
                                  )}
                                </Link>

                                {/* Product details */}
                                <div className="flex-1 min-w-0 pr-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  {/* Info details */}
                                  <div className="space-y-1.5">
                                    {productData.brand && (
                                      <p className="text-[10px] tracking-widest text-gray-400 uppercase font-bold">
                                        {productData.brand}
                                      </p>
                                    )}
                                    <h3 className={`font-semibold text-gray-900 text-sm sm:text-base leading-snug line-clamp-1 group-hover:text-orange-600 transition-colors ${isOutOfStock ? 'text-gray-400 line-through' : ''}`}>
                                      <Link 
                                        to={`/product/${item._id}`}
                                        onClick={() => token && trackInteraction && trackInteraction(item._id, 'clicked')}
                                        className="hover:underline"
                                      >
                                        {displayName}
                                      </Link>
                                    </h3>
                                    
                                    <div className="flex items-center gap-3">
                                      {!isDefaultCartOptionKey(item.size) && (
                                        <span className="text-[11px] font-medium px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-md border border-gray-200/50">
                                          Size: {item.size}
                                        </span>
                                      )}
                                      {productData.discount > 0 && !isOutOfStock && (
                                        <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded font-bold border border-red-100">
                                          -{productData.discount}%
                                        </span>
                                      )}
                                    </div>

                                    {/* Price */}
                                    <div className="flex items-baseline gap-2 pt-1">
                                      <span className={`text-base font-bold ${isOutOfStock ? 'text-gray-400' : 'text-orange-600'}`}>
                                        {formatPrice(productData.price)}
                                      </span>
                                      {productData.discount > 0 && productData.originalPrice && !isOutOfStock && (
                                        <span className="text-xs text-gray-400 line-through">
                                          {formatPrice(productData.originalPrice)}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Stepper + Subtotal */}
                                  <div className="flex items-center justify-between md:justify-end gap-6 sm:gap-8 border-t border-gray-100 pt-3 md:border-t-0 md:pt-0">
                                    {/* Stepper */}
                                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50/50 hover:bg-white transition-colors">
                                      <button
                                        onClick={() => !isOutOfStock && updateQuantity(item._id, item.size, Math.max(1, item.quantity - 1))}
                                        disabled={isOutOfStock}
                                        className={`px-2.5 py-1.5 hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800 ${isOutOfStock ? 'opacity-20 cursor-not-allowed' : ''}`}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                                        </svg>
                                      </button>
                                      <input 
                                        onChange={(e) => {
                                          const value = Number(e.target.value);
                                          if (value > 0 && !isOutOfStock) {
                                            updateQuantity(item._id, item.size, value);
                                          }
                                        }} 
                                        disabled={isOutOfStock}
                                        className={`w-10 text-center py-1 bg-transparent border-x border-gray-200 focus:outline-none text-sm font-semibold text-gray-700 ${isOutOfStock ? 'text-gray-400 cursor-not-allowed' : ''}`} 
                                        type="number" 
                                        min={1} 
                                        value={item.quantity}
                                      />
                                      <button
                                        onClick={() => !isOutOfStock && updateQuantity(item._id, item.size, item.quantity + 1)}
                                        disabled={isOutOfStock}
                                        className={`px-2.5 py-1.5 hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800 ${isOutOfStock ? 'opacity-20 cursor-not-allowed' : ''}`}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                      </button>
                                    </div>

                                    {/* Subtotal column */}
                                    <div className="text-right min-w-[90px]">
                                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Tạm tính</p>
                                      <p className={`text-base font-bold ${isOutOfStock ? 'text-gray-300 line-through' : 'text-gray-900'}`}>
                                        {formatPrice(productData.price * item.quantity)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Continue Shopping Link */}
              <div className="pt-4">
                <button 
                  onClick={() => navigate('/collection')}
                  className="group inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-orange-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 transition-transform group-hover:-translate-x-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  Tiếp tục mua sắm
                </button>
              </div>
            </div>

            {/* Right Column: Sticky Summary Card */}
            <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
              <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6">
                
                <CartTotal selectedTotal={getSelectedTotal()} />
                
                <button 
                  onClick={() => {
                    if (getSelectedCount() === 0) {
                      alert('Vui lòng chọn ít nhất một sản phẩm để thanh toán');
                      return;
                    }
                    const selectedCartData = cartData.filter((item) => selectedItems.includes(`${item._id}_${item.size}`));
                    sessionStorage.setItem('selectedCartItems', JSON.stringify(selectedCartData));
                    navigate('/place-order');
                  }} 
                  className={`w-full font-bold py-4 rounded-xl transition-all shadow-md active:scale-[0.98] ${
                    getSelectedCount() === 0
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                      : 'bg-orange-600 hover:bg-orange-700 text-white hover:shadow-lg hover:shadow-orange-600/10'
                  }`}
                  disabled={getSelectedCount() === 0}
                >
                  Tiến hành thanh toán ({getSelectedCount()})
                </button>
                
                <div className="pt-4 border-t border-gray-100 flex items-center justify-center gap-2 text-[10px] text-gray-400 font-bold tracking-wider uppercase">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Thanh toán bảo mật & an toàn</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default Cart;
