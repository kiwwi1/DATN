import React, { useContext, useState, useEffect } from 'react'
import Title from '../components/Title'
import CartTotal from '../components/CartTotal'
import { assets } from '../assets/assets'
import { ShopContext } from '../context/ShopContext'
import axios from 'axios'
import { toast } from 'react-toastify'    
const PlaceOrder = () => {
  // State to manage the selected payment method

  const[method,setMethod] =useState('cod');
  const {navigate,cartItems,setCartItems,token,backendUrl,delivery_fee,products} = useContext(ShopContext)

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    street: '',
    city: '',
    state: '',
    phone: ''
  })

  const [selectedTotal, setSelectedTotal] = useState(0);

  // Calculate selected items total
  useEffect(() => {
    const selectedCartItemsStr = sessionStorage.getItem('selectedCartItems');
    if (selectedCartItemsStr) {
      const selectedCartItems = JSON.parse(selectedCartItemsStr);
      const total = selectedCartItems.reduce((sum, item) => {
        const productData = products.find(p => p._id === item._id);
        if (productData) {
          return sum + (productData.price * item.quantity);
        }
        return sum;
      }, 0);
      setSelectedTotal(total);
    }
  }, [products]);


  const onChangeHandler = (e) =>{
    const name = e.target.name;
    const value = e.target.value;

    setFormData({...formData, [name]: value})
  }

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    try {
      // Get selected items from sessionStorage
      const selectedCartItemsStr = sessionStorage.getItem('selectedCartItems');
      const selectedCartItems = selectedCartItemsStr ? JSON.parse(selectedCartItemsStr) : null;
      
      let orderItems = []

      // If we have selected items (from Cart page), only process those
      if (selectedCartItems && selectedCartItems.length > 0) {
        for (const selectedItem of selectedCartItems) {
          const productData = products.find(product => product._id === selectedItem._id);
          if (productData) {
            // Prepare order item with all required fields from orderModel
            const orderItem = {
              _id: productData._id,
              name: productData.name,
              price: productData.price,
              originalPrice: productData.originalPrice || productData.price,
              discount: productData.discount || 0,
              quantity: selectedItem.quantity,
              image: productData.image || [],
              brand: productData.brand || '',
              vendorId: productData.vendorId,
              vendorShopName: productData.vendorShopName || ''
            };

            // Parse attributes string to selectedAttributes array
            if (selectedItem.size.includes(':')) {
              const attributes = selectedItem.size.split(',').map(attr => {
                const [name, value] = attr.split(':').map(s => s.trim());
                return { name, value };
              });
              orderItem.selectedAttributes = attributes;
              orderItem.size = selectedItem.size;
            } else {
              orderItem.size = selectedItem.size;
              orderItem.selectedAttributes = [{ name: 'Size', value: selectedItem.size }];
            }

            orderItems.push(orderItem);
          }
        }
      } else {
        // Fallback: process all items in cart (backward compatibility)
        for (const items in cartItems) {
          for (const item in cartItems[items]) {
            if (cartItems[items][item] > 0) {
            const productData = products.find(product => product._id === items);
            if(productData) {
              // Prepare order item with all required fields from orderModel
              const orderItem = {
                _id: productData._id,
                name: productData.name,
                price: productData.price, // Current price (after discount)
                originalPrice: productData.originalPrice || productData.price,
                discount: productData.discount || 0,
                quantity: cartItems[items][item],
                image: productData.image || [],
                brand: productData.brand || '',
                vendorId: productData.vendorId,
                vendorShopName: productData.vendorShopName || ''
              };

              // Parse attributes string to selectedAttributes array
              // Format: "Size: M, Color: Red" -> [{name: "Size", value: "M"}, {name: "Color", value: "Red"}]
              if (item.includes(':')) {
                // New format with multiple attributes
                const attributes = item.split(',').map(attr => {
                  const [name, value] = attr.split(':').map(s => s.trim());
                  return { name, value };
                });
                orderItem.selectedAttributes = attributes;
                orderItem.size = item; // Keep for backward compatibility
              } else {
                // Old format with single size
                orderItem.size = item;
                orderItem.selectedAttributes = [{ name: 'Size', value: item }];
              }

              orderItems.push(orderItem);
            }
          }
        }
        }
      }
      
      // Calculate total amount for selected items
      const itemsTotal = orderItems.reduce((total, item) => total + (item.price * item.quantity), 0);
      const shippingFee = itemsTotal >= 500000 ? 0 : delivery_fee;
      const totalAmount = itemsTotal + shippingFee;

      // Validate Stripe amount limit for VND
      const STRIPE_VND_LIMIT = 99999999; // ₫99,999,999
      if (method === 'stripe' && totalAmount > STRIPE_VND_LIMIT) {
        toast.error('Tổng đơn hàng vượt quá giới hạn thanh toán Stripe (₫99,999,999). Vui lòng chọn phương thức thanh toán COD.');
        return;
      }
      
      let orderData = {
        address: formData,
        items: orderItems,
        amount: totalAmount
      }

      console.log('📦 Order Data:', orderData);
      console.log('🛍️ Order Items:', orderItems);

      // Declare response outside switch to avoid lexical declaration error
      
      switch(method) {
        // api for cod order
        case 'cod': {
          const response = await axios.post(backendUrl + '/api/order/place-order', orderData, {headers:{token}})
          if(response.data.success) {
            // Clear selected items from sessionStorage
            sessionStorage.removeItem('selectedCartItems');
            
            // Fetch fresh cart data from backend to sync
            try {
              const cartResponse = await axios.post(
                backendUrl + '/api/cart/get',
                {},
                {headers:{token}}
              );
              if (cartResponse.data.success) {
                setCartItems(cartResponse.data.cartData);
              }
            } catch (err) {
              console.error('Error fetching cart:', err);
            }
            
            toast.success('Đặt hàng thành công!');
            navigate('/orders')
          } else {
            toast.error(response.data.message)
          }
          break;
        }
        case 'stripe': {
          const response = await axios.post(backendUrl + '/api/order/place-order-stripe', orderData, {headers:{token}})
          if(response.data.success) {
            // Clear selected items from sessionStorage before redirect
            // Backend will handle removing items from cart
            sessionStorage.removeItem('selectedCartItems');
            
            window.location.href = response.data.sessionUrl
          } else {
            toast.error(response.data.message)
          }
          break;
        }
        default:
          break;
      }
      
    } catch (error) {
      console.error(error);
      toast.error(error.message)
    }
  }

  return (
    <form onSubmit={onSubmitHandler} className='flex flex-col sm:flex-row gap-4 justify-between sm:pt-14 pt-5 min-h-[80vh] border-t'>
    {/* -----------------LEFT SIDE------------------------ */}
      <div className='flex flex-col gap-4 w-full sm:max-w-[480px]'>
          <div className='text-xl sm:text-2xl my-3'>
            <Title text1={'DELIVERY '} text2={'INFORMATION'} />
          </div>
          <div className='flex gap-3'>
              <input required onChange={onChangeHandler} name='firstName' value={formData.firstName} className='border border-gray-300 rounded py-1.5 px-3.5 w-full' type="text" placeholder='First Name'></input>
              <input required onChange={onChangeHandler} name='lastName' value={formData.lastName} className='border border-gray-300 rounded py-1.5 px-3.5 w-full' type="text" placeholder='Last Name'></input>
          </div>
          <input required onChange={onChangeHandler} name='email' value={formData.email} className='border border-gray-300 rounded py-1.5 px-3.5 w-full' type="email" placeholder='Email Address'></input>
          <input required onChange={onChangeHandler} name='street' value={formData.street} className='border border-gray-300 rounded py-1.5 px-3.5 w-full' type="text" placeholder='Street'></input>
          <div className='flex gap-3'>
              <input required onChange={onChangeHandler} name='city' value={formData.city} className='border border-gray-300 rounded py-1.5 px-3.5 w-full' type="text" placeholder='City'></input>
              <input required onChange={onChangeHandler} name='state' value={formData.state} className='border border-gray-300 rounded py-1.5 px-3.5 w-full' type="text" placeholder='State'></input>
          </div>
          <input onChange={onChangeHandler} name='phone' value={formData.phone} className='border border-gray-300 rounded py-1.5 px-3.5 w-full' type="number" placeholder='Phone'></input>
      </div>

      {/* -----------------RIGHT SIDE------------------------ */}
      <div className='mt-8'>
          <div className='mt-8 min-w-80'>
            <CartTotal selectedTotal={selectedTotal > 0 ? selectedTotal : undefined} />
          </div>

          <div className='mt-12'>
            <Title text1={'PAYMENT '} text2={'METHOD'} />
            {/*  ---------------------- Payment ----------------------- */}
              <div className='flex gap-3 flex-col lg-flex-row'>
                <div onClick={()=>setMethod('stripe')} className='flex items-center gap-3 border p-2 px-3 cursor-pointer'>
                  <p className={` min-w-3.5 h-3.5 border rounded-full ${method === 'stripe' ?'bg-green-400':''}`}></p>
                  <img className='h-5 mx-4' src={assets.stripe_logo}></img>
                </div>
                <div onClick={()=>setMethod('zalopay')} className='flex items-center gap-3 border p-2 px-3 cursor-pointer'>
                  <p className={` min-w-3.5 h-3.5 border rounded-full ${method === 'zalopay' ?'bg-green-400':''}`}></p>
                  <img className='h-5 mx-4' src={assets.zalopay_logo}></img>
                </div>
                <div onClick={()=>setMethod('cod')} className='flex items-center gap-3 border p-2 px-3 cursor-pointer'>
                  <p className={` min-w-3.5 h-3.5 border rounded-full ${method === 'cod' ?'bg-green-400':''}`}></p>
                  <p className='text-gray-500 text-sm font-medium mx-4'>CASH ON DELIVERY</p>
                </div>
              </div>
              <div className='w-full text-end mt-8'>
                <button type='submit' className='bg-black text-sm text-white py-2 px-16 '>PLACE ORDER</button>
              </div>
          </div>
      </div>
    </form>
  )
}

export default PlaceOrder