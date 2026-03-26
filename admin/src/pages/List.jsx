import React, { useEffect, useState, useRef } from 'react'
import { backendUrl } from '../App'
import axios from 'axios'
import { toast } from 'react-toastify'
import AttributesManager from '../components/AttributesManager'
import VariantsManager from '../components/VariantsManager'
import { formatPrice } from '../utils/priceFormat'
import { formatImageUrl } from '../utils/imageUtils'
import { assets } from '../assets/assets'

const ITEMS_PER_PAGE = 10

// ── Delete Confirmation Modal ─────────────────────────────────────────────────
const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
      <p className="text-gray-800 font-medium mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Huỷ
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
        >
          Xoá
        </button>
      </div>
    </div>
  </div>
)

// ── Image Slot ────────────────────────────────────────────────────────────────
const ImageSlot = ({ slot, onChange, onRemove, index }) => {
  const inputRef = useRef(null)
  const preview = slot?.type === 'new'
    ? URL.createObjectURL(slot.file)
    : slot?.type === 'existing'
      ? formatImageUrl(slot.url)
      : null

  return (
    <div className="relative w-20 h-20">
      <label
        className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors flex items-center justify-center overflow-hidden"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt={`slot-${index}`} className="w-full h-full object-cover" />
        ) : (
          <img src={assets.upload_area} alt="upload" className="w-8 h-8 opacity-50" />
        )}
        <input
          ref={inputRef}
          type="file"
          hidden
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files[0]
            if (file) onChange({ type: 'new', file })
          }}
        />
      </label>
      {slot && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center leading-none hover:bg-red-600"
        >
          ×
        </button>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
const List = ({ token }) => {
  const [list, setList] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [currentProduct, setCurrentProduct] = useState(null)
  const [formData, setFormData] = useState({
    name: '', description: '', price: '', category: '', subCategory: '',
    attributes: [], variants: [], bestseller: false
  })
  const [editImages, setEditImages] = useState([null, null, null, null])

  // Categories
  const [mainCategories, setMainCategories] = useState([])
  const [subCategories, setSubCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [categoryMap, setCategoryMap] = useState({})

  // Search & pagination
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(null)

  const fetchCategories = async () => {
    try {
      const response = await axios.get(backendUrl + '/api/category/list')
      if (response.data.success) {
        const allCategories = response.data.categories
        const map = {}
        allCategories.forEach(cat => { map[cat._id] = cat })
        setCategoryMap(map)
        setMainCategories(allCategories.filter(cat => cat.level === 1))
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    } finally {
      setLoadingCategories(false)
    }
  }

  const fetchList = async () => {
    try {
      const response = await axios.get(backendUrl + '/api/product/vendor-list', { headers: { token } })
      if (response.data.success) {
        setList(response.data.products)
      } else {
        toast.error(response.data.message)
      }
    } catch (e) {
      toast.error(e.response?.data?.message || e.message)
    }
  }

  const fetchSubCategories = async (categoryId) => {
    if (!categoryId) { setSubCategories([]); return }
    try {
      const response = await axios.get(backendUrl + `/api/category/${categoryId}/subcategories`)
      if (response.data.success) setSubCategories(response.data.subcategories)
    } catch { setSubCategories([]) }
  }

  const confirmRemove = (id) => setConfirmDelete(id)

  const removeProduct = async () => {
    const id = confirmDelete
    setConfirmDelete(null)
    try {
      const response = await axios.post(backendUrl + '/api/product/remove', { id }, { headers: { token } })
      if (response.data.success) {
        toast.success('Đã xoá sản phẩm')
        await fetchList()
      } else {
        toast.error(response.data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    }
  }

  const openUpdateModal = async (product) => {
    setCurrentProduct(product)
    if (product.category) await fetchSubCategories(product.category)

    setFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      subCategory: product.subCategory || '',
      attributes: product.attributes || [],
      variants: product.variants || [],
      bestseller: !!product.bestseller
    })

    // Populate image slots from existing images
    const slots = [null, null, null, null]
    ;(product.image || []).slice(0, 4).forEach((url, i) => {
      slots[i] = { type: 'existing', url }
    })
    setEditImages(slots)

    setShowModal(true)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    if (name === 'category') {
      fetchSubCategories(value)
      setFormData(prev => ({ ...prev, category: value, subCategory: '' }))
    } else {
      setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    }
  }

  const updateProduct = async (e) => {
    e.preventDefault()
    try {
      const hasValidAttributes = formData.attributes.every(attr => attr.values && attr.values.length > 0)
      if (!hasValidAttributes) {
        toast.error('Vui lòng thêm ít nhất một giá trị cho mỗi thuộc tính')
        return
      }
      if (formData.variants.length > 0) {
        const missingPrice = formData.variants.some(v => !v.price || v.price <= 0)
        if (missingPrice) {
          toast.error('Vui lòng nhập giá cho tất cả biến thể')
          return
        }
      }

      // Build FormData for multipart (supports image uploads)
      const data = new FormData()
      data.append('productId', currentProduct._id)
      data.append('name', formData.name)
      data.append('description', formData.description)
      data.append('price', formData.price)
      data.append('category', formData.category)
      data.append('subCategory', formData.subCategory)
      data.append('attributes', JSON.stringify(formData.attributes))
      data.append('variants', JSON.stringify(formData.variants))
      data.append('bestseller', formData.bestseller)

      // imageSlots: array of 4 — existing URL or null (new files sent separately)
      const imageSlots = editImages.map(slot =>
        slot?.type === 'existing' ? slot.url : null
      )
      data.append('imageSlots', JSON.stringify(imageSlots))

      editImages.forEach((slot, idx) => {
        if (slot?.type === 'new') data.append(`image${idx}`, slot.file)
      })

      const response = await axios.post(backendUrl + '/api/product/update', data, {
        headers: { token, 'Content-Type': 'multipart/form-data' }
      })
      if (response.data.success) {
        toast.success('Cập nhật sản phẩm thành công')
        setShowModal(false)
        await fetchList()
      } else {
        toast.error(response.data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    }
  }

  // Auto-fill price from min variant price in modal
  useEffect(() => {
    if (formData.variants.length > 0) {
      const prices = formData.variants.map(v => Number(v.price)).filter(p => !isNaN(p) && p > 0)
      if (prices.length > 0) {
        setFormData(prev => ({ ...prev, price: String(Math.min(...prices)) }))
      }
    }
  }, [formData.variants])

  useEffect(() => {
    fetchCategories()
    fetchList()
  }, [])

  // Filtered + paginated list
  const filtered = list.filter(item =>
    !search || item.name?.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const handleSearchChange = (e) => {
    setSearch(e.target.value)
    setCurrentPage(1)
  }

  return (
    <>
      {/* Delete Confirmation */}
      {confirmDelete && (
        <ConfirmModal
          message="Bạn có chắc muốn xoá sản phẩm này không? Hành động này không thể hoàn tác."
          onConfirm={removeProduct}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white p-6 rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-800">Cập nhật sản phẩm</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={updateProduct} className="space-y-4">
              {/* Image editing */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hình ảnh sản phẩm</label>
                <div className="flex gap-3 flex-wrap">
                  {editImages.map((slot, idx) => (
                    <ImageSlot
                      key={idx}
                      index={idx}
                      slot={slot}
                      onChange={(newSlot) => {
                        const updated = [...editImages]
                        updated[idx] = newSlot
                        setEditImages(updated)
                      }}
                      onRemove={() => {
                        const updated = [...editImages]
                        updated[idx] = null
                        setEditImages(updated)
                      }}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">Click vào ảnh để thay thế, nhấn × để xoá</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tên sản phẩm</label>
                <input
                  type="text" name="name" value={formData.name} onChange={handleInputChange}
                  className="w-full border-2 border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Mô tả</label>
                <textarea
                  name="description" value={formData.description} onChange={handleInputChange}
                  className="w-full border-2 border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  rows="3" required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Giá (₫)
                  {formData.variants.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-blue-600">(tự động từ biến thể)</span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₫</span>
                  <input
                    type="number" name="price" value={formData.price} onChange={handleInputChange}
                    className="w-full border-2 border-gray-300 rounded-lg p-2 pl-8 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    step="1" min="0" required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Danh mục <span className="text-red-500">*</span></label>
                {loadingCategories ? (
                  <div className="w-full border-2 border-gray-300 rounded-lg p-2 text-gray-500 text-sm">Đang tải...</div>
                ) : (
                  <select
                    name="category" value={formData.category} onChange={handleInputChange}
                    className="w-full border-2 border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    required
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {mainCategories.map((cat) => (
                      <option key={cat._id} value={cat._id}>{cat.icon && `${cat.icon} `}{cat.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Danh mục con
                  {subCategories.length === 0 && formData.category && (
                    <span className="text-xs text-gray-400 ml-2">(Không có danh mục con)</span>
                  )}
                </label>
                <select
                  name="subCategory" value={formData.subCategory} onChange={handleInputChange}
                  className="w-full border-2 border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  disabled={!formData.category || subCategories.length === 0}
                >
                  <option value="">-- Chọn danh mục con (tuỳ chọn) --</option>
                  {subCategories.map((s) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Bestseller */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox" id="edit-bestseller" name="bestseller"
                  checked={formData.bestseller} onChange={handleInputChange}
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                />
                <label htmlFor="edit-bestseller" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  Đánh dấu là Bestseller
                </label>
              </div>

              <AttributesManager
                attributes={formData.attributes}
                setAttributes={(attrs) => setFormData(prev => ({ ...prev, attributes: attrs }))}
              />

              <VariantsManager
                attributes={formData.attributes}
                variants={formData.variants}
                onChange={(newVariants) => setFormData(prev => ({ ...prev, variants: newVariants }))}
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  Cập nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <p className="text-lg font-bold text-gray-800">Sản phẩm của tôi
          <span className="ml-2 text-sm font-normal text-gray-400">({filtered.length} sản phẩm)</span>
        </p>
        <input
          type="text"
          placeholder="Tìm theo tên sản phẩm..."
          value={search}
          onChange={handleSearchChange}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 border rounded-lg bg-white">
          <svg className="w-16 h-16 mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0v10l-8 4m0 0L4 17V7m8 10V11" />
          </svg>
          <p className="text-base font-medium text-gray-500">Chưa có sản phẩm nào</p>
          <p className="text-sm mt-1">Hãy thêm sản phẩm đầu tiên của bạn</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 border rounded-lg bg-white">
          <p className="text-sm">Không tìm thấy sản phẩm nào cho "{search}"</p>
          <button onClick={() => setSearch('')} className="mt-2 text-blue-500 text-sm hover:underline">Xoá tìm kiếm</button>
        </div>
      ) : (
        <>
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[80px_1fr_160px_120px_100px] items-center text-xs font-semibold text-gray-500 uppercase px-3 py-2 bg-gray-100 rounded-t border">
            <span>Ảnh</span>
            <span>Tên sản phẩm</span>
            <span>Danh mục</span>
            <span>Giá</span>
            <span className="text-center">Thao tác</span>
          </div>

          <div className="flex flex-col divide-y border border-t-0 rounded-b overflow-hidden">
            {paginated.map((item) => (
              <div
                key={item._id}
                className="grid grid-cols-[80px_1fr_100px] md:grid-cols-[80px_1fr_160px_120px_100px] gap-2 items-center px-3 py-2.5 bg-white hover:bg-gray-50 transition-colors"
              >
                <img className="w-12 h-12 object-cover rounded border" src={formatImageUrl(item.image?.[0])} alt={item.name} />
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 text-sm truncate">{item.name}</p>
                  {item.bestseller && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">⭐ Bestseller</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 hidden md:block">
                  {categoryMap[item.category]?.name || '—'}
                  {item.subCategory && categoryMap[item.subCategory] && (
                    <span className="text-xs text-gray-400 block">{categoryMap[item.subCategory].name}</span>
                  )}
                </p>
                <p className="font-semibold text-gray-800 text-sm hidden md:block">{formatPrice(item.price)}</p>
                <div className="flex gap-2 justify-end md:justify-center">
                  <button
                    onClick={() => openUpdateModal(item)}
                    className="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded font-medium transition-colors"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => confirmRemove(item._id)}
                    className="text-xs px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded font-medium transition-colors"
                  >
                    Xoá
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-4">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center border rounded hover:border-blue-500 hover:text-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-colors"
              >‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 text-sm rounded border transition-colors ${currentPage === page
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 hover:border-blue-500 hover:text-blue-500'
                  }`}
                >{page}</button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center border rounded hover:border-blue-500 hover:text-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-colors"
              >›</button>
            </div>
          )}
        </>
      )}
    </>
  )
}

export default List
