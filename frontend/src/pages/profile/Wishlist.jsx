import React, { useContext, useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { ShopContext } from '../../context/ShopContext'
import ProductItem from '../../components/product/ProductItem'
import Title from '../../components/ui/Title'

const Wishlist = () => {
  const { backendUrl, token, navigate } = useContext(ShopContext)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchWishlist = useCallback(async () => {
    if (!token) { navigate('/login'); return; }
    setLoading(true)
    try {
      const res = await axios.get(`${backendUrl}/api/interaction/wishlist`, { headers: { token } })
      if (res.data.success) setProducts(res.data.products)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [backendUrl, token, navigate])

  useEffect(() => { fetchWishlist() }, [fetchWishlist])

  const handleRemove = async (productId) => {
    try {
      await axios.post(
        `${backendUrl}/api/interaction/wishlist/toggle`,
        { productId },
        { headers: { token } }
      )
      setProducts((prev) => prev.filter((p) => p._id?.toString() !== productId?.toString()))
    } catch {
      // silent
    }
  }

  return (
    <div className="border-t pt-10 pb-16">
      <div className="text-center mb-8">
        <Title text1="DANH SÁCH" text2=" YÊU THÍCH" />
        <p className="text-xs text-gray-500 mt-2">
          {products.length > 0 ? `${products.length} sản phẩm` : 'Chưa có sản phẩm nào'}
        </p>
      </div>

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 rounded-xl aspect-square w-full mb-3" />
              <div className="h-3 bg-gray-200 rounded w-4/5 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-2/5" />
            </div>
          ))}
        </div>
      )}

      {!loading && products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <p className="text-sm font-semibold text-gray-500">Chưa có sản phẩm yêu thích nào</p>
          <p className="text-xs text-gray-400 max-w-xs">Nhấn nút trái tim trên trang sản phẩm để lưu vào danh sách yêu thích của bạn.</p>
          <Link to="/collection" className="mt-2 px-6 py-2.5 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors">
            Khám phá sản phẩm
          </Link>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {products.map((item) => (
            <div key={item._id} className="relative group">
              <ProductItem
                id={item._id}
                image={item.image}
                name={item.name}
                price={item.price}
                originalPrice={item.originalPrice}
                discount={item.discount}
                rating={item.rating}
                sold={item.sold}
              />
              <button
                onClick={() => handleRemove(item._id)}
                title="Bỏ yêu thích"
                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-white/90 shadow text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Wishlist
