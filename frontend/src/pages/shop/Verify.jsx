import React, { useContext, useEffect, useState } from 'react'
import { ShopContext } from '../../context/ShopContext'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'

const Verify = () => {
    const {navigate, token, setCartItems, backendUrl} = useContext(ShopContext)
    const [searchParams] = useSearchParams()
    const success = searchParams.get('success')
    const orderId = searchParams.get('orderId')
    const [loading, setLoading] = useState(true)
    
    const verifyPayment = async () =>{
        try {
            if(!token){
                toast.error("Authentication required")
                navigate('/login')
                return
            }
            
            if(!orderId) {
                toast.error("Order ID is missing")
                navigate('/cart')
                return
            }
            
            setLoading(true)
            
            console.log("Verifying payment:", {orderId, success})
            const response = await axios.post(
                backendUrl + '/api/order/verify-stripe',
                {orderId, success},
                {headers:{token}}
            )
            
            console.log("Verification response:", response.data)
            
            if(response.data.success){
                toast.success("Payment verified successfully!")
                
                // Remove ordered items from cart (frontend state)
                // Backend already removed items during order creation
                // Just need to update frontend state to match
                
                // Clear any session storage
                sessionStorage.removeItem('selectedCartItems');
                
                // Fetch fresh cart data from backend
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
                
                navigate('/orders')
            }
            else{
                toast.error(response.data.message || "Payment verification failed")
                navigate('/cart')
            }
                
        } catch (error) {
            console.log("Verification error:", error)
            toast.error(error.response?.data?.message || 'Payment verification failed')
            navigate('/cart')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() =>{
        if (token) {
            verifyPayment()
        }
    },[token])

    return (
        <div className="flex justify-center items-center min-h-[60vh] flex-col">
            {loading ? (
                <>
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-xl text-gray-700">Verifying your payment...</p>
                    <p className="text-sm text-gray-500 mt-2">Please do not close this page</p>
                </>
            ) : (
                <p className="text-xl">Redirecting...</p>
            )}
        </div>
    )
}

export default Verify