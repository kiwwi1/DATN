import React, { useState, useContext, useEffect } from 'react'
import { ShopContext } from '../../context/ShopContext'
import axios from 'axios'
import { toast } from 'react-toastify'

const VendorRegis = () => {
  const { token, navigate, backendUrl, userRole } = useContext(ShopContext)
  const adminUrl = import.meta.env.VITE_ADMIN_URL || 'http://localhost:5174'

  const [formData, setFormData] = useState({
    shopName: '',
    shopAddress: '',
    phone: ''
  })

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      toast.error('Vui lòng đăng nhập trước khi đăng ký người bán')
      navigate('/login')
    } else if (userRole === 'vendor') {
      window.open(`${adminUrl.replace(/\/$/, '')}/add`, '_blank')
      navigate('/')
    }
  }, [token, navigate, userRole, adminUrl])

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!formData.shopName.trim()) {
      toast.error('Vui lòng nhập tên cửa hàng')
      return
    }
    if (!formData.shopAddress.trim()) {
      toast.error('Vui lòng nhập địa chỉ cửa hàng')
      return
    }
    if (!formData.phone.trim()) {
      toast.error('Vui lòng nhập số điện thoại')
      return
    }

    setLoading(true)
    try {
      const response = await axios.post(
        backendUrl + '/api/user/register-vendor',
        formData,
        { headers: { token } }
      )

      if (response.data.success) {
        toast.success('Đăng ký người bán thành công!')
        navigate('/')
      } else {
        toast.error(response.data.message || 'Đăng ký người bán thất bại')
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  if (!token) return null

  return (
    <div className="max-w-lg mx-auto my-14 p-6 md:p-8 bg-white border border-slate-100 shadow-[0_15px_40px_rgba(0,0,0,0.04)] rounded-2xl">
      <div className="text-center mb-8">
        <h1 className="prata-regular text-3xl md:text-4xl text-slate-850 mb-3">Đăng ký Người bán</h1>
        <hr className="border-none h-[2px] w-16 bg-gradient-to-r from-rose-500 to-orange-500 mx-auto" />
        <p className="text-sm text-slate-500 mt-4 leading-relaxed">
          Đăng ký để bắt đầu tiếp cận hàng ngàn khách hàng tiềm năng và bán hàng trên nền tảng của chúng tôi.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-slate-700 font-semibold text-sm mb-2" htmlFor="shopName">
            Tên cửa hàng <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            id="shopName"
            name="shopName"
            value={formData.shopName}
            onChange={handleInputChange}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all duration-200 text-sm text-slate-800"
            placeholder="Nhập tên cửa hàng của bạn"
            required
          />
        </div>

        <div>
          <label className="block text-slate-700 font-semibold text-sm mb-2" htmlFor="shopAddress">
            Địa chỉ cửa hàng <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="shopAddress"
            name="shopAddress"
            value={formData.shopAddress}
            onChange={handleInputChange}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all duration-200 text-sm text-slate-800 h-24 resize-none"
            placeholder="Nhập địa chỉ đầy đủ của cửa hàng"
            required
          />
        </div>

        <div>
          <label className="block text-slate-700 font-semibold text-sm mb-2" htmlFor="phone">
            Số điện thoại <span className="text-rose-500">*</span>
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all duration-200 text-sm text-slate-800"
            placeholder="Nhập số điện thoại liên hệ"
            required
          />
        </div>

        <div className="bg-rose-50/40 border border-rose-100/30 p-4.5 rounded-xl">
          <h3 className="font-bold text-slate-700 text-xs flex items-center gap-1.5 mb-2">
            <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            LƯU Ý QUAN TRỌNG:
          </h3>
          <ul className="text-[11px] text-slate-500 space-y-1.5 leading-relaxed font-medium">
            <li className="flex items-start gap-1">
              <span className="text-rose-400">•</span>
              <span>Sau khi đăng ký thành công, tài khoản của bạn sẽ được nâng cấp thành quyền người bán (vendor).</span>
            </li>
            <li className="flex items-start gap-1">
              <span className="text-rose-400">•</span>
              <span>Bạn có thể truy cập Kênh Người Bán để đăng tải sản phẩm và quản lý đơn hàng ngay lập tức.</span>
            </li>
            <li className="flex items-start gap-1">
              <span className="text-rose-400">•</span>
              <span>Vui lòng kiểm tra kỹ thông tin liên lạc để tránh gián đoạn trong việc giao nhận hàng hóa.</span>
            </li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm shadow-md ${
            loading
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-rose-500/10 hover:brightness-105 hover:scale-[1.01] active:scale-[0.99]'
          }`}
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-slate-400 border-t-slate-600 rounded-full animate-spin"></span>
              <span>Đang xử lý đăng ký...</span>
            </>
          ) : (
            <span>Đăng ký Người bán</span>
          )}
        </button>
      </form>

      <div className="text-center mt-6">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-wider"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Quay lại trang chủ
        </button>
      </div>
    </div>
  )
}

export default VendorRegis
