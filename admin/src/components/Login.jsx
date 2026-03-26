import React, { useState } from 'react'
import { assets } from '../assets/assets'
import axios from 'axios'
import { backendUrl } from '../App'
import { toast } from 'react-toastify'

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173'

const Login = ({ onLogin }) => {
  const [showDirectLogin, setShowDirectLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await axios.post(backendUrl + '/api/user/login', { email, password })
      if (response.data.success) {
        const profileResponse = await axios.post(backendUrl + '/api/user/profile', {}, {
          headers: { token: response.data.token }
        })
        if (profileResponse.data.success && profileResponse.data.user.role === 'vendor') {
          onLogin(response.data.token, true)
          toast.success('Đăng nhập thành công!')
        } else {
          toast.error('Truy cập bị từ chối - Yêu cầu tài khoản vendor')
        }
      } else {
        toast.error(response.data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-blue-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img src={assets.logo} alt="logo" className="w-32 h-auto" />
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800">Vendor Dashboard</h2>
            <p className="text-gray-500 text-sm mt-1">Quản lý cửa hàng của bạn</p>
          </div>

          {/* Primary: login via frontend */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                1
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Đăng nhập từ trang chủ</p>
                <p className="text-xs text-gray-500 mt-0.5">Vào trang frontend và đăng nhập bằng tài khoản vendor của bạn</p>
              </div>
            </div>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                2
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Click "VENDOR'S PAGE"</p>
                <p className="text-xs text-gray-500 mt-0.5">Trên thanh điều hướng, chọn "Vendor's Page" để mở dashboard</p>
              </div>
            </div>
            <a
              href={FRONTEND_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Đi tới trang chủ
            </a>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <hr className="flex-1 border-gray-200" />
            <span className="text-xs text-gray-400">hoặc đăng nhập trực tiếp</span>
            <hr className="flex-1 border-gray-200" />
          </div>

          {/* Secondary: direct login (fallback) */}
          {!showDirectLogin ? (
            <button
              onClick={() => setShowDirectLogin(true)}
              className="w-full py-2.5 border border-gray-200 text-gray-500 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Đăng nhập bằng email / mật khẩu
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all"
                placeholder="Email"
                required
                autoFocus
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all"
                placeholder="Mật khẩu"
                required
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowDirectLogin(false); setEmail(''); setPassword('') }}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
