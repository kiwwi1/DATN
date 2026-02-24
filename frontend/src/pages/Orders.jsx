import React, { useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ShopContext } from '../context/ShopContext';
import Title from '../components/Title';
import { toast } from 'react-toastify';
import ProfileSidebar from '../components/ProfileSidebar';
import { formatPrice } from '../utils/priceFormat';
import { formatImageUrl } from '../utils/imageUtils';
const Orders = () => {
  const { backendUrl, token } = useContext(ShopContext);
  const [orderData, setOrderData] = useState([])


  const loadOrdersData = useCallback(async () => {
    try {
      if(!token) {
        return null
      }
      const response = await axios.post(backendUrl + '/api/order/user-orders', {}, {headers: {token}})
      console.log(response.data);
      if(response.data.success) {
        let allOrdersItems = []
        response.data.orders.map((order) => {
          order.items.map((item) => {
           item['status'] = order.status
           item['payment'] = order.payment
           item['paymentMethod'] = order.paymentMethod
           item['date'] = order.date
           allOrdersItems.push(item)
          })
        })
        setOrderData(allOrdersItems.reverse())
        
      } else {
        toast.error(response.data.message)
      }
      
    } catch (error) {
      console.log(error);
      toast.error(error.message)
    }
  }, [token, backendUrl])

  useEffect(() => {
    loadOrdersData()
  }, [token, loadOrdersData])

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <ProfileSidebar />
      
      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <div className='text-2xl mb-6'>
            <Title text1={'MY '} text2={'ORDERS'} />
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            {orderData.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-lg">Bạn chưa có đơn hàng nào</p>
              </div>
            ) : (
              <div>
                {orderData.map((item, index) => (
                  <div
                    key={index}
                    className='flex text-gray-700 flex-col gap-4 border-b py-4 md:flex-row md:justify-between md:items-center'
                  >
                    <div className='flex items-start gap-6 text-sm'>
                      <div className="relative">
                        <img className='w-16 sm:w-20 rounded-md' src={formatImageUrl(item.image?.[0])} alt={item.name} />
                        {item.discount > 0 && (
                          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-bl-md font-semibold">
                            -{item.discount}%
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className='sm:text-base font-medium text-gray-800'>{item.name}</p>
                        {item.brand && (
                          <p className="text-xs text-gray-500 mt-1">Thương hiệu: {item.brand}</p>
                        )}
                        {item.vendorShopName && (
                          <p className="text-xs text-gray-500">Shop: {item.vendorShopName}</p>
                        )}
                        <div className='flex items-center gap-3 mt-2 text-base text-gray-700'>
                          <div className="flex items-center gap-2">
                            <p className='text-lg font-semibold text-red-600'>
                              {formatPrice(item.price)}
                            </p>
                            {item.originalPrice && item.originalPrice > item.price && (
                              <p className='text-sm text-gray-400 line-through'>
                                {formatPrice(item.originalPrice)}
                              </p>
                            )}
                          </div>
                          <span className="text-gray-300">|</span>
                          <p className="text-gray-600">x{item.quantity}</p>
                          {(item.size || (item.selectedAttributes && item.selectedAttributes.length > 0)) && (
                            <>
                              <span className="text-gray-300">|</span>
                              <p className="text-gray-600">
                                {item.size || item.selectedAttributes?.map(attr => `${attr.name}: ${attr.value}`).join(', ')}
                              </p>
                            </>
                          )}
                        </div>
                        <p className='mt-2 text-xs text-gray-500'>
                          Ngày đặt: <span className='text-gray-600'>{new Date(item.date).toLocaleDateString('vi-VN')}</span>
                          <span className="mx-2">•</span>
                          Thanh toán: <span className='text-gray-600'>{item.paymentMethod}</span>
                        </p>
                      </div>
                    </div>
                    <div className='md:w-1/2 flex justify-between'>
                      <div className='flex items-center gap-2'>
                        <p className='min-w-2 h-2 rounded-full bg-green-500'></p>
                        <p className='text-sm md:text-base'>{item.status}</p>
                      </div>
                      <button onClick={loadOrdersData} className='border px-4 py-2 text-sm font-medium rounded-sm hover:bg-gray-50 transition-colors'>Track Order</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Orders;