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
        } catch {
            // non-critical
        }
    }

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    // VNPay: backend verifies signature before redirecting to this page.
    const handleVNPayResult = async () => {
        sessionStorage.removeItem('selectedCartItems')
        if (success === 'true') {
            toast.success('Thanh toán VNPay thành công!')
            await refreshCart()
            navigate('/orders')
        } else {
            toast.error('Thanh toán VNPay thất bại hoặc đã bị hủy.')
            navigate('/cart')
        }
        setLoading(false)
    }

    // Stripe: do not trust query success. Poll backend payment status.
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

            if (success !== 'true') {
                toast.error('Thanh toán thất bại hoặc đã bị hủy')
                navigate('/cart')
                return
            }

            const maxAttempts = 6
            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                const response = await axios.post(
                    backendUrl + '/api/order/verify-stripe',
                    { orderId },
                    { headers: { token } }
                )

                if (response.data.success && response.data.paid) {
                    toast.success('Thanh toán thành công!')
                    sessionStorage.removeItem('selectedCartItems')
                    await refreshCart()
                    navigate('/orders')
                    return
                }

                if (attempt < maxAttempts) {
                    await wait(1500)
                }
            }

            toast.info('Thanh toán đang được xử lý, vui lòng kiểm tra lại trong đơn hàng')
            navigate('/orders')
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
