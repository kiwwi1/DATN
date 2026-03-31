import React, { useContext, useEffect, useState } from 'react'
import { ShopContext } from '../../context/ShopContext'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'

const Verify = () => {
    const { navigate, token, setCartItems, backendUrl } = useContext(ShopContext)
    const [searchParams] = useSearchParams()
    const success = searchParams.get('success')
    const orderId = searchParams.get('orderId')
    const isVNPay = searchParams.get('vnpay') === '1'
    const [loading, setLoading] = useState(true)

    const refreshCart = async () => {
        try {
            const res = await axios.post(backendUrl + '/api/cart/get', {}, { headers: { token } })
            if (res.data.success) setCartItems(res.data.cartData)
        } catch (_) {}
    }

    // ── VNPay: backend đã xử lý trước khi redirect ──────────────────────────
    const handleVNPayResult = async () => {
        sessionStorage.removeItem('selectedCartItems')
        if (success === 'true') {
            toast.success('Thanh toán VNPay thành công!')
            await refreshCart()
            navigate('/orders')
        } else {
            toast.error('Thanh toán VNPay thất bại hoặc đã bị huỷ.')
            navigate('/cart')
        }
        setLoading(false)
    }

    // ── Stripe: frontend gọi API verify ─────────────────────────────────────
    const verifyStripePayment = async () => {
        try {
            if (!token) {
                toast.error('Bạn chưa đăng nhập')
                navigate('/login')
                return
            }
            if (!orderId) {
                toast.error('Thiếu mã đơn hàng')
                navigate('/cart')
                return
            }

            const response = await axios.post(
                backendUrl + '/api/order/verify-stripe',
                { orderId, success },
                { headers: { token } }
            )

            if (response.data.success) {
                toast.success('Thanh toán thành công!')
                sessionStorage.removeItem('selectedCartItems')
                await refreshCart()
                navigate('/orders')
            } else {
                toast.error(response.data.message || 'Xác minh thanh toán thất bại')
                navigate('/cart')
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Xác minh thanh toán thất bại')
            navigate('/cart')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isVNPay) {
            handleVNPayResult()
            return
        }
        if (token) {
            verifyStripePayment()
        }
    }, [token])

    return (
        <div className="flex justify-center items-center min-h-[60vh] flex-col">
            {loading ? (
                <>
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-xl text-gray-700">Đang xử lý thanh toán...</p>
                    <p className="text-sm text-gray-500 mt-2">Vui lòng không đóng trang này</p>
                </>
            ) : (
                <p className="text-xl">Đang chuyển hướng...</p>
            )}
        </div>
    )
}

export default Verify
