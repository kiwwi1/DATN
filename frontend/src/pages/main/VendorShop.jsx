import React, { useContext, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { ShopContext } from '../../context/ShopContext'
import ProductItem from '../../components/product/ProductItem'

const TAB_ITEMS = [
  { id: 'all', label: 'TẤT CẢ SẢN PHẨM' },
  { id: 'sale', label: 'Giảm giá' },
  { id: 'bestsell', label: 'Sản phẩm bán chạy' },
  { id: 'new', label: 'Hàng mới về' },
]

const VendorShop = () => {
  const { vendorId } = useParams()
  const navigate = useNavigate()
  const { backendUrl, token } = useContext(ShopContext)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [vendor, setVendor] = useState(null)
  const [stats, setStats] = useState(null)
  const [products, setProducts] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)

  useEffect(() => {
    const loadVendorShop = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${backendUrl}/api/product/vendor-shop/${vendorId}`)
        if (res.data.success) {
          setVendor(res.data.vendor)
          setStats(res.data.stats)
          setProducts(res.data.products || [])
          const initialFollowers =
            res.data?.stats?.followers ??
            res.data?.vendor?.followers ??
            0
          setFollowerCount(initialFollowers)
        } else {
          toast.error(res.data.message || 'Không tải được thông tin shop')
        }
      } catch (error) {
        toast.error(error.response?.data?.message || error.message)
      } finally {
        setLoading(false)
      }
    }

    if (vendorId) loadVendorShop()
  }, [backendUrl, vendorId])

  useEffect(() => {
    const loadCount = async () => {
      try {
        const res = await axios.get(`${backendUrl}/api/shop-follow/count/${vendorId}`)
        if (res.data.success) setFollowerCount(res.data.followerCount || 0)
      } catch (_) {
        // non-critical
      }
    }

    if (vendorId) loadCount()
  }, [backendUrl, vendorId])

  useEffect(() => {
    const loadStatus = async () => {
      if (!token || !vendorId) {
        setIsFollowing(false)
        return
      }
      try {
        const res = await axios.get(`${backendUrl}/api/shop-follow/status/${vendorId}`, {
          headers: { token },
        })
        if (res.data.success) setIsFollowing(!!res.data.followed)
      } catch (_) {
        setIsFollowing(false)
      }
    }

    loadStatus()
  }, [backendUrl, token, vendorId])

  const handleFollowToggle = async () => {
    if (!token) {
      toast.info('Vui lòng đăng nhập để theo dõi shop')
      navigate('/login')
      return
    }
    setFollowLoading(true)
    try {
      const endpoint = isFollowing ? 'unfollow' : 'follow'
      const res = await axios.post(
        `${backendUrl}/api/shop-follow/${endpoint}`,
        { vendorId },
        { headers: { token } }
      )
      if (res.data.success) {
        const next = !isFollowing
        setIsFollowing(next)
        const countFromApi = res.data?.result?.followerCount
        if (typeof countFromApi === 'number') setFollowerCount(countFromApi)
        toast.success(next ? 'Đã theo dõi shop' : 'Đã bỏ theo dõi shop')
      } else {
        toast.error(res.data.message || 'Thao tác thất bại')
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    } finally {
      setFollowLoading(false)
    }
  }

  const handleStartChat = async () => {
    if (!token) {
      toast.info('Vui lòng đăng nhập để nhắn tin với shop')
      navigate('/login')
      return
    }
    try {
      const res = await axios.post(
        `${backendUrl}/api/chat/init`,
        { vendorId },
        { headers: { token } }
      )
      if (res.data.success) {
        const conversationId = res.data.conversation?._id
        if (!conversationId) throw new Error('Không lấy được cuộc hội thoại')
        window.dispatchEvent(
          new CustomEvent('open-chat-conversation', { detail: { conversationId } })
        )
      } else {
        toast.error(res.data.message || 'Không thể tạo cuộc hội thoại')
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    }
  }

  const filteredProducts = useMemo(() => {
    switch (activeTab) {
      case 'sale':
        return products.filter((product) => (product.discount || 0) > 0)
      case 'bestsell':
        return [...products].sort((left, right) => (right.sold || 0) - (left.sold || 0))
      case 'new':
        return [...products].sort((left, right) => (right.date || 0) - (left.date || 0))
      default:
        return products
    }
  }, [products, activeTab])

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 font-medium animate-pulse">Đang tải thông tin shop...</p>
      </div>
    )
  }

  if (!vendor) {
    return (
      <div className="py-24 text-center">
        <div className="inline-flex p-4 bg-rose-50 rounded-full text-rose-500 mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-800">Không tìm thấy shop</h3>
        <p className="text-slate-500 mt-1">Cửa hàng không tồn tại hoặc đã ngừng hoạt động.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all font-medium text-sm shadow-sm"
        >
          Quay lại trang chủ
        </button>
      </div>
    )
  }

  return (
    <div className="mt-8">
      {/* Shop Profile Header */}
      <div className="bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-2xl p-5 md:p-6 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-center">
          
          {/* Shop Card */}
          <div className="relative overflow-hidden rounded-xl bg-slate-900 text-white p-6 shadow-md border border-slate-850">
            {/* Background Glow */}
            <div className="absolute -right-8 -top-8 w-28 h-28 bg-rose-500/20 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -left-8 -bottom-8 w-28 h-28 bg-orange-500/20 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="relative flex items-center gap-4">
              {/* Shop Avatar */}
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-rose-500 to-orange-500 p-[2px] shadow-lg flex items-center justify-center shrink-0">
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-white font-serif text-2xl font-bold tracking-wider">
                  {String(vendor.shopName || vendor.name).slice(0, 1).toUpperCase()}
                </div>
              </div>
              
              {/* Shop Info */}
              <div className="min-w-0">
                <h2 className="font-semibold text-lg leading-snug truncate text-white hover:text-rose-100 transition-colors">
                  {vendor.shopName || vendor.name}
                </h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-xs text-slate-300 font-medium">Đang hoạt động</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 mt-6 relative z-10">
              <button
                type="button"
                onClick={handleFollowToggle}
                disabled={followLoading}
                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm ${
                  isFollowing
                    ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20'
                    : 'bg-gradient-to-r from-rose-500 to-orange-500 text-white hover:brightness-110'
                } ${followLoading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-95'}`}
              >
                {followLoading ? (
                  <span className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : isFollowing ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Đang theo dõi</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Theo dõi</span>
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={handleStartChat}
                className="py-2 px-3 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm bg-white/10 text-white border border-white/10 hover:bg-white/20 hover:scale-[1.02] active:scale-95"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>Nhắn tin</span>
              </button>
            </div>
          </div>

          {/* Shop Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            
            {/* Stat Item: Products */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors border border-slate-100">
              <div className="p-2 rounded-lg bg-white shadow-sm border border-slate-100 text-rose-500 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sản phẩm</span>
                <span className="block text-sm font-semibold text-slate-700 mt-0.5">{stats?.productCount ?? 0}</span>
              </div>
            </div>

            {/* Stat Item: Followers */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors border border-slate-100">
              <div className="p-2 rounded-lg bg-white shadow-sm border border-slate-100 text-orange-500 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Người theo dõi</span>
                <span className="block text-sm font-semibold text-slate-700 mt-0.5">{followerCount}</span>
              </div>
            </div>

            {/* Stat Item: Sold */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors border border-slate-100">
              <div className="p-2 rounded-lg bg-white shadow-sm border border-slate-100 text-emerald-500 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đã bán</span>
                <span className="block text-sm font-semibold text-slate-700 mt-0.5 truncate" title={`${stats?.soldCount ?? 0} sản phẩm`}>
                  {stats?.soldCount ?? 0} sản phẩm
                </span>
              </div>
            </div>

            {/* Stat Item: Rating */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors border border-slate-100">
              <div className="p-2 rounded-lg bg-white shadow-sm border border-slate-100 text-amber-500 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đánh giá</span>
                <span className="block text-sm font-semibold text-slate-700 mt-0.5 truncate">
                  {stats?.avgRating ?? 0}/5 <span className="text-[11px] font-normal text-slate-400">({stats?.reviewCount ?? 0})</span>
                </span>
              </div>
            </div>

            {/* Stat Item: Joined Date */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors border border-slate-100">
              <div className="p-2 rounded-lg bg-white shadow-sm border border-slate-100 text-indigo-500 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tham gia</span>
                <span className="block text-sm font-semibold text-slate-700 mt-0.5">
                  {vendor.createdAt ? new Date(vendor.createdAt).toLocaleDateString('vi-VN') : '—'}
                </span>
              </div>
            </div>

            {/* Stat Item: Address */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors border border-slate-100">
              <div className="p-2 rounded-lg bg-white shadow-sm border border-slate-100 text-cyan-500 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Địa chỉ</span>
                <span className="block text-sm font-semibold text-slate-700 mt-0.5 truncate max-w-[150px] md:max-w-[180px]" title={vendor.shopAddress || 'Đang cập nhật'}>
                  {vendor.shopAddress || 'Đang cập nhật'}
                </span>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Tabs Menu */}
      <div className="mt-8 border-b border-slate-200 flex flex-wrap gap-6 text-sm">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 px-1 relative text-sm font-semibold tracking-wide transition-all duration-200 ${
              activeTab === tab.id 
                ? 'text-rose-600 font-bold' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rose-500 to-orange-500 rounded-full"></span>
            )}
          </button>
        ))}
      </div>

      {/* Filtered Products Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-800 tracking-tight uppercase">GỢI Ý CHO BẠN</h3>
          <Link to="/collection" className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors uppercase tracking-wider">Xem tất cả</Link>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-50/50 border border-slate-100 rounded-2xl p-6">
            <div className="p-4 bg-white shadow-sm border border-slate-100 rounded-full text-slate-400 mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h4 className="text-base font-semibold text-slate-700">Chưa có sản phẩm nào</h4>
            <p className="text-sm text-slate-400 mt-1 max-w-xs">Không tìm thấy sản phẩm nào trong danh mục này của cửa hàng.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {filteredProducts.map((item) => (
              <ProductItem
                key={item._id}
                id={item._id}
                image={item.image}
                name={item.name}
                price={item.price}
                originalPrice={item.originalPrice}
                discount={item.discount}
                rating={item.rating}
                sold={item.sold}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default VendorShop
