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
    <div className="max-w-md mx-auto mt-14 p-6 bg-white shadow-lg rounded-lg">
      <div className="text-center mb-8">
        <h1 className="prata-regular text-3xl text-gray-800 mb-2">Đăng ký Người bán</h1>
        <hr className="border-none h-[1.5px] w-16 bg-gray-800 mx-auto" />
        <p className="text-gray-600 mt-4">Trở thành người bán hàng trên nền tảng của chúng tôi</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-gray-700 font-medium mb-2" htmlFor="shopName">
            Tên cửa hàng *
          </label>
          <input
            type="text"
            id="shopName"
            name="shopName"
            value={formData.shopName}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-gray-800"
            placeholder="Nhập tên cửa hàng của bạn"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2" htmlFor="shopAddress">
            Địa chỉ cửa hàng *
          </label>
          <textarea
            id="shopAddress"
            name="shopAddress"
            value={formData.shopAddress}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-gray-800 h-20 resize-none"
            placeholder="Nhập địa chỉ đầy đủ của cửa hàng"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2" htmlFor="phone">
            Số điện thoại *
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-gray-800"
            placeholder="Nhập số điện thoại liên hệ"
            required
          />
        </div>

        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="font-medium text-gray-800 mb-2">Lưu ý:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Sau khi đăng ký, tài khoản sẽ chuyển sang quyền người bán</li>
            <li>• Bạn có thể đăng sản phẩm ngay trên kênh người bán</li>
            <li>• Vui lòng cung cấp thông tin chính xác</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
            loading
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
              : 'bg-black text-white hover:bg-gray-800'
          }`}
        >
          {loading ? 'Đang xử lý...' : 'Đăng ký Người bán'}
        </button>
      </form>

      <div className="text-center mt-6">
        <button
          onClick={() => navigate('/')}
          className="text-gray-600 hover:text-gray-800 underline"
        >
          Quay lại trang chủ
        </button>
      </div>
    </div>
  )
}

export default VendorRegis
