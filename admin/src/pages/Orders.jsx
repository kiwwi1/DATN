import React from 'react'
import { backendUrl } from '../App.jsx'
import axios from 'axios'
import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { assets } from '../assets/assets.js'
import { formatPrice } from '../utils/priceFormat'

const Orders = ({token}) => {
  const [orders,setOrders]=useState([])
  
  const fetchAllOrders = async()=>{
    if(!token) return ;
    try {
      // Use vendor-specific endpoint to only show orders containing vendor's products
      const response = await axios.post(backendUrl + '/api/order/vendor-list',{},{
        headers:{
          token:token
        }
      })
      console.log(response.data)
      
      if(response.data.success){
        setOrders(response.data.orders)
      }
      else{
        toast.error(response.data.message)
      }
    } catch (error) {
      toast.error(error.response.data.message)
    }
  }

  const updateOrderStatus = async (event,orderId) => {
    event.preventDefault()
    try {
      // Use vendor-specific endpoint for updating order status
      const response = await axios.post(backendUrl+'/api/order/vendor-status', 
        {
          orderId,
          status:event.target.value
        }, 
        {headers:{token}}
      )
      if(response.data.success){
        toast.success("Order status updated successfully")
        await fetchAllOrders()
      }
      else{
        toast.error(response.data.message)
      }
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }

  useEffect(()=>{
    fetchAllOrders()
  },[token])

  return (
    <div className="p-6">
      <h3 className='text-2xl font-bold mb-6 text-gray-800'>My Orders</h3>
      <div className="space-y-6">
        {orders.map((order,index)=>(
          <div key={index} className="bg-white rounded-lg shadow-md p-4 flex flex-col md:flex-row justify-between gap-4 border-l-4 border-blue-500">
            <div className="flex items-start gap-4">
              <img src={assets.parcel_icon} alt="parcel" className="w-10 h-10 mt-1" />
              <div className="flex-1">
                <div className="mb-2">
                  {
                    order.items.map((item,index)=>{
                      if(index === order.items.length - 1){
                        return(
                          <p key={index} className="text-gray-700">
                            <span className="font-medium">{item.name}</span> x {item.quantity} 
                            <span className="text-xs ml-1 bg-gray-100 px-2 py-0.5 rounded">{item.size}</span>
                          </p>
                        )
                      }
                      else{
                        return(
                          <p key={index} className="text-gray-700">
                            <span className="font-medium">{item.name}</span> x {item.quantity} 
                            <span className="text-xs ml-1 bg-gray-100 px-2 py-0.5 rounded">{item.size}</span>,
                          </p>
                        )
                      }
                  })
                  }
                </div>
                <p className="font-medium text-gray-800">{order.address.firstName} {order.address.lastName}</p>
                <div className="text-gray-600 text-sm">
                  <p>{order.address.street + ", " + order.address.city}</p>
                </div>
                <p className="text-gray-600 text-sm mt-1">{order.address.phone}</p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-4 items-start">
              <div className="bg-gray-50 p-3 rounded text-sm">
                <p className="flex justify-between gap-2"><span className="text-gray-500">Items:</span> <span className="font-medium">{order.items.length}</span></p>
                <p className="flex justify-between gap-2"><span className="text-gray-500">Method:</span> <span className="font-medium">{order.paymentMethod}</span></p>
                <p className="flex justify-between gap-2">
                  <span className="text-gray-500">Payment:</span> 
                  <span className={`font-medium ${order.payment ? 'text-green-600' : 'text-orange-500'}`}>
                    {order.payment ? 'Done' : 'Pending'}
                  </span>
                </p>
                <p className="flex justify-between gap-2"><span className="text-gray-500">Date:</span> <span className="font-medium">{new Date(order.date).toLocaleDateString()}</span></p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="text-xl font-bold text-blue-600">{formatPrice(order.vendorAmount || order.amount)}</p>
                <select onChange={(event)=>{updateOrderStatus(event,order._id)}} value={order.status} className="p-2 border rounded bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="Order Placed">Order Placed</option>
                  <option value="Packing">Packing</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Out for delivery">Out for delivery</option>
                  <option value="Delivered">Delivered</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Orders