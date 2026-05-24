import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { backendUrl } from '../App'
import AttributesManager from '../components/AttributesManager'
import VariantsManager from '../components/VariantsManager'
import { formatPrice } from '../utils/priceFormat'
import { formatImageUrl } from '../utils/imageUtils'
import { assets } from '../assets/assets'

const ITEMS_PER_PAGE = 10

const DEFAULT_FILTERS = {
  category: 'all',
  subCategory: 'all',
  visibility: 'all',
  bestseller: 'all',
  stock: 'all',
  minPrice: '',
  maxPrice: '',
  sort: 'newest',
}

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

const getProductStock = (product) => {
  if (Array.isArray(product?.variants) && product.variants.length > 0) {
    return product.variants.reduce((sum, variant) => sum + (Number(variant?.stock) || 0), 0)
  }
  return Number(product?.stock) || 0
}

const getProductPrice = (product) => Number(product?.price) || 0

const getProductDate = (product) => {
  if (product?.createdAt) return new Date(product.createdAt).getTime()
  return Number(product?.date) || 0
}

const reorderSlots = (slots, fromIndex, toIndex) => {
  if (fromIndex === toIndex) return slots
  if (fromIndex < 0 || toIndex < 0) return slots
  if (fromIndex >= slots.length || toIndex >= slots.length) return slots

  const next = [...slots]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
    <div className="admin-card w-full max-w-sm p-5">
      <p className="text-sm text-slate-700">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="admin-btn-secondary">
          Hủy
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
        >
          Xóa
        </button>
      </div>
    </div>
  </div>
)

const ImageSlot = ({ slot, onChange, onRemove, index, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver }) => {
  const inputRef = useRef(null)
  const inputId = `edit-product-image-slot-${index}`
  const preview =
    slot?.type === 'new'
      ? URL.createObjectURL(slot.file)
      : slot?.type === 'existing'
        ? formatImageUrl(slot.url)
        : null

  return (
    <div
      className={`relative h-20 w-20 ${slot ? 'cursor-grab active:cursor-grabbing' : ''}`}
      draggable={Boolean(slot)}
      onDragStart={(event) => onDragStart(event, index)}
      onDragOver={(event) => onDragOver(event, index)}
      onDrop={(event) => onDrop(event, index)}
      onDragEnd={onDragEnd}
    >
      <label
        htmlFor={inputId}
        className={`flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition hover:border-pink-400 ${
          isDragOver ? 'border-pink-500 bg-pink-50' : 'border-slate-300'
        }`}
      >
        {preview ? (
          <img src={preview} alt={`slot-${index}`} className="h-full w-full object-cover" />
        ) : (
          <img src={assets.upload_area} alt="upload" className="h-8 w-8 opacity-50" />
        )}
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          hidden
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files[0]
            if (file) onChange({ type: 'new', file })
          }}
        />
      </label>
      {slot && (
        <div className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-slate-900/70 px-1 py-0.5 text-[10px] font-semibold text-white">
          {index + 1}
        </div>
      )}
      {slot && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs leading-none text-white transition hover:bg-rose-600"
          aria-label="Xóa ảnh"
        >
          ×
        </button>
      )}
    </div>
  )
}

const List = ({ token }) => {
  const [list, setList] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [currentProduct, setCurrentProduct] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    subCategory: '',
    attributes: [],
    variants: [],
    bestseller: false,
  })
  const [editImages, setEditImages] = useState([null, null, null, null])
  const [isGeneratingEditDescription, setIsGeneratingEditDescription] = useState(false)

  const [allCategories, setAllCategories] = useState([])
  const [mainCategories, setMainCategories] = useState([])
  const [subCategories, setSubCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [categoryMap, setCategoryMap] = useState({})

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [currentPage, setCurrentPage] = useState(1)
  const [draggedImageIndex, setDraggedImageIndex] = useState(null)
  const [dragOverImageIndex, setDragOverImageIndex] = useState(null)

  const [confirmDelete, setConfirmDelete] = useState(null)

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${backendUrl}/api/category/list`)
      if (response.data.success) {
        const categories = response.data.categories || []
        const map = {}
        categories.forEach((category) => {
          map[category._id] = category
        })
        setCategoryMap(map)
        setAllCategories(categories)
        setMainCategories(categories.filter((category) => category.level === 1))
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể tải danh mục')
    } finally {
      setLoadingCategories(false)
    }
  }

  const fetchList = async () => {
    setLoadingList(true)
    try {
      const response = await axios.get(`${backendUrl}/api/product/vendor-list`, { headers: { token } })
      if (response.data.success) {
        setList(response.data.products || [])
      } else {
        toast.error(response.data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    } finally {
      setLoadingList(false)
    }
  }

  const fetchSubCategories = async (categoryId) => {
    if (!categoryId) {
      setSubCategories([])
      return
    }
    try {
      const response = await axios.get(`${backendUrl}/api/category/${categoryId}/subcategories`)
      if (response.data.success) setSubCategories(response.data.subcategories || [])
    } catch {
      setSubCategories([])
    }
  }

  const confirmRemove = (id) => setConfirmDelete(id)

  const removeProduct = async () => {
    const id = confirmDelete
    setConfirmDelete(null)
    try {
      const response = await axios.post(`${backendUrl}/api/product/remove`, { id }, { headers: { token } })
      if (response.data.success) {
        toast.success(response.data.message || 'Đã xóa sản phẩm')
        await fetchList()
      } else {
        toast.error(response.data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    }
  }

  const toggleProductVisibility = async (productId, isActive) => {
    try {
      const response = await axios.post(
        `${backendUrl}/api/product/toggle-active`,
        { productId, isActive },
        { headers: { token } }
      )
      if (response.data.success) {
        toast.success(isActive ? 'Đã hiển thị sản phẩm' : 'Đã ẩn sản phẩm')
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
      name: product.name || '',
      description: product.description || '',
      price: product.price || '',
      category: product.category || '',
      subCategory: product.subCategory || '',
      attributes: product.attributes || [],
      variants: product.variants || [],
      bestseller: !!product.bestseller,
    })

    const slots = [null, null, null, null]
    ;(product.image || []).slice(0, 4).forEach((url, index) => {
      slots[index] = { type: 'existing', url }
    })
    setEditImages(slots)
    setDraggedImageIndex(null)
    setDragOverImageIndex(null)
    setShowModal(true)
  }

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target
    if (name === 'category') {
      fetchSubCategories(value)
      setFormData((prev) => ({ ...prev, category: value, subCategory: '' }))
      return
    }
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const updateProduct = async (event) => {
    event.preventDefault()
    try {
      const hasValidAttributes = formData.attributes.every((attribute) => attribute.values && attribute.values.length > 0)
      if (!hasValidAttributes) {
        toast.error('Vui lòng thêm ít nhất một giá trị cho mỗi thuộc tính')
        return
      }

      if (formData.variants.length > 0) {
        const missingPrice = formData.variants.some((variant) => !variant.price || variant.price <= 0)
        if (missingPrice) {
          toast.error('Vui lòng nhập giá cho tất cả biến thể')
          return
        }
      }

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

      const imageSlots = editImages.map((slot) => (slot?.type === 'existing' ? slot.url : null))
      data.append('imageSlots', JSON.stringify(imageSlots))

      editImages.forEach((slot, index) => {
        if (slot?.type === 'new') data.append(`image${index}`, slot.file)
      })

      const response = await axios.post(`${backendUrl}/api/product/update`, data, {
        headers: { token, 'Content-Type': 'multipart/form-data' },
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

  const handleGenerateEditDescription = async () => {
    if (!formData.name?.trim()) {
      toast.error('Vui lòng nhập tên sản phẩm trước khi tạo mô tả')
      return
    }

    try {
      setIsGeneratingEditDescription(true)

      const selectedMainCategory = mainCategories.find((category) => category._id === formData.category)
      const selectedSubCategory = subCategories.find((category) => category._id === formData.subCategory)
      const firstImageSlot = editImages.find(Boolean)

      let imageBase64 = ''
      let imageMimeType = ''
      let imageUrl = ''

      if (firstImageSlot?.type === 'new' && firstImageSlot.file) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(new Error('Không đọc được ảnh đã chọn'))
          reader.readAsDataURL(firstImageSlot.file)
        })

        const match = dataUrl.match(/^data:(.+);base64,(.+)$/)
        if (match) {
          imageMimeType = match[1] || 'image/jpeg'
          imageBase64 = match[2] || ''
        }
      } else if (firstImageSlot?.type === 'existing' && firstImageSlot.url) {
        imageUrl = firstImageSlot.url
      }

      const response = await axios.post(
        `${backendUrl}/api/product/generate-description`,
        {
          name: formData.name.trim(),
          category: selectedMainCategory?.name || '',
          subCategory: selectedSubCategory?.name || '',
          attributes: formData.attributes || [],
          imageBase64,
          imageMimeType,
          imageUrl,
        },
        { headers: { token } }
      )

      if (response.data?.success && response.data?.description) {
        setFormData((prev) => ({ ...prev, description: response.data.description }))
        toast.success('Đã tạo mô tả tự động')
      } else {
        toast.error(response.data?.message || 'Không thể tạo mô tả')
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi khi tạo mô tả bằng AI')
    } finally {
      setIsGeneratingEditDescription(false)
    }
  }

  useEffect(() => {
    if (formData.variants.length > 0) {
      const prices = formData.variants
        .map((variant) => Number(variant.price))
        .filter((price) => !Number.isNaN(price) && price > 0)
      if (prices.length > 0) {
        setFormData((prev) => ({ ...prev, price: String(Math.min(...prices)) }))
      }
    }
  }, [formData.variants])

  useEffect(() => {
    fetchCategories()
    fetchList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const availableSubCategoryFilters = useMemo(() => {
    if (filters.category === 'all') return []
    return allCategories.filter(
      (category) =>
        category.level === 2 &&
        String(category.parentCategory || '') === String(filters.category)
    )
  }, [allCategories, filters.category])

  const filtered = useMemo(() => {
    const normalizedSearch = normalizeText(search)
    const minPrice = filters.minPrice === '' ? null : Number(filters.minPrice)
    const maxPrice = filters.maxPrice === '' ? null : Number(filters.maxPrice)

    const products = list.filter((item) => {
      const name = normalizeText(item.name)
      const price = getProductPrice(item)
      const stock = getProductStock(item)
      const isVisible = item.isActive !== false

      if (normalizedSearch && !name.includes(normalizedSearch)) return false
      if (filters.category !== 'all' && String(item.category || '') !== filters.category) return false
      if (filters.subCategory !== 'all' && String(item.subCategory || '') !== filters.subCategory) return false

      if (filters.visibility === 'visible' && !isVisible) return false
      if (filters.visibility === 'hidden' && isVisible) return false

      if (filters.bestseller === 'yes' && !item.bestseller) return false
      if (filters.bestseller === 'no' && item.bestseller) return false

      if (filters.stock === 'in_stock' && stock <= 0) return false
      if (filters.stock === 'out_of_stock' && stock > 0) return false
      if (filters.stock === 'low_stock' && (stock <= 0 || stock > 5)) return false

      if (minPrice != null && !Number.isNaN(minPrice) && price < minPrice) return false
      if (maxPrice != null && !Number.isNaN(maxPrice) && price > maxPrice) return false

      return true
    })

    return [...products].sort((left, right) => {
      switch (filters.sort) {
        case 'oldest':
          return getProductDate(left) - getProductDate(right)
        case 'price_asc':
          return getProductPrice(left) - getProductPrice(right)
        case 'price_desc':
          return getProductPrice(right) - getProductPrice(left)
        case 'sold_desc':
          return (Number(right.sold) || 0) - (Number(left.sold) || 0)
        case 'name_asc':
          return String(left.name || '').localeCompare(String(right.name || ''), 'vi')
        case 'newest':
        default:
          return getProductDate(right) - getProductDate(left)
      }
    })
  }, [filters, list, search])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)

  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [currentPage, filtered]
  )

  useEffect(() => {
    if (filters.category === 'all' && filters.subCategory !== 'all') {
      setFilters((prev) => ({ ...prev, subCategory: 'all' }))
    }
  }, [filters.category, filters.subCategory])

  useEffect(() => {
    if (totalPages === 0 && currentPage !== 1) {
      setCurrentPage(1)
      return
    }
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const updateFilter = (key, value) => {
    setFilters((prev) => {
      if (key === 'category') {
        return { ...prev, category: value, subCategory: 'all' }
      }
      return { ...prev, [key]: value }
    })
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setSearch('')
    setFilters(DEFAULT_FILTERS)
    setCurrentPage(1)
  }

  const handleImageDragStart = (event, index) => {
    if (!editImages[index]) return
    setDraggedImageIndex(index)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }

  const handleImageDragOver = (event, index) => {
    if (draggedImageIndex == null || draggedImageIndex === index) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverImageIndex(index)
  }

  const handleImageDrop = (event, index) => {
    event.preventDefault()
    const sourceFromTransfer = Number(event.dataTransfer.getData('text/plain'))
    const sourceIndex = Number.isNaN(sourceFromTransfer) ? draggedImageIndex : sourceFromTransfer

    if (sourceIndex == null || sourceIndex === index) {
      setDraggedImageIndex(null)
      setDragOverImageIndex(null)
      return
    }

    setEditImages((prev) => reorderSlots(prev, sourceIndex, index))
    setDraggedImageIndex(null)
    setDragOverImageIndex(null)
  }

  const handleImageDragEnd = () => {
    setDraggedImageIndex(null)
    setDragOverImageIndex(null)
  }

  const hasFiltersApplied =
    search.trim() !== '' ||
    Object.entries(filters).some(([key, value]) => String(value) !== String(DEFAULT_FILTERS[key]))

  return (
    <>
      {confirmDelete && (
        <ConfirmModal
          message="Bạn có chắc muốn xóa sản phẩm này không? Hành động này không thể hoàn tác."
          onConfirm={removeProduct}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 px-3 py-3 sm:px-4 sm:py-6">
          <div className="mx-auto flex h-full w-full max-w-4xl items-start justify-center">
            <div className="admin-card flex h-full w-full max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden p-0 sm:max-h-[calc(100vh-3rem)]">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
              <h2 className="text-xl font-bold text-slate-900">Cập nhật sản phẩm</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Đóng chỉnh sửa sản phẩm"
                className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                <form onSubmit={updateProduct} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Hình ảnh sản phẩm</label>
                <div className="flex flex-wrap gap-3">
                  {editImages.map((slot, index) => (
                    <ImageSlot
                      key={index}
                      index={index}
                      slot={slot}
                      isDragOver={dragOverImageIndex === index && draggedImageIndex !== null && draggedImageIndex !== index}
                      onDragStart={handleImageDragStart}
                      onDragOver={handleImageDragOver}
                      onDrop={handleImageDrop}
                      onDragEnd={handleImageDragEnd}
                      onChange={(newSlot) => {
                        const updated = [...editImages]
                        updated[index] = newSlot
                        setEditImages(updated)
                      }}
                      onRemove={() => {
                        const updated = [...editImages]
                        updated[index] = null
                        setEditImages(updated)
                      }}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-400">Kéo-thả để đổi thứ tự ảnh. Bấm vào ô để thay ảnh, bấm × để xóa ảnh.</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tên sản phẩm</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="admin-input"
                  required
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-slate-700">Mô tả</label>
                  <button
                    type="button"
                    onClick={handleGenerateEditDescription}
                    disabled={isGeneratingEditDescription}
                    className="inline-flex items-center justify-center rounded-md border border-sky-200 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isGeneratingEditDescription ? 'Đang tạo...' : 'AI tạo mô tả'}
                  </button>
                </div>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="admin-input min-h-[110px]"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Giá (₫)
                  {formData.variants.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-sky-600">(tự động lấy từ biến thể)</span>
                  )}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                    ₫
                  </span>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    className="admin-input pl-8"
                    step="1"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Danh mục <span className="text-rose-500">*</span>
                </label>
                {loadingCategories ? (
                  <div className="admin-input text-slate-500">Đang tải danh mục...</div>
                ) : (
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="admin-select"
                    required
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {mainCategories.map((category) => (
                      <option key={category._id} value={category._id}>
                        {category.icon ? `${category.icon} ` : ''}
                        {category.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Danh mục con
                  {subCategories.length === 0 && formData.category && (
                    <span className="ml-2 text-xs text-slate-400">(Không có danh mục con)</span>
                  )}
                </label>
                <select
                  name="subCategory"
                  value={formData.subCategory}
                  onChange={handleInputChange}
                  className="admin-select"
                  disabled={!formData.category || subCategories.length === 0}
                >
                  <option value="">-- Chọn danh mục con (tùy chọn) --</option>
                  {subCategories.map((subcategory) => (
                    <option key={subcategory._id} value={subcategory._id}>
                      {subcategory.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="edit-bestseller"
                  name="bestseller"
                  checked={formData.bestseller}
                  onChange={handleInputChange}
                  className="h-4 w-4 cursor-pointer accent-pink-500"
                />
                <label htmlFor="edit-bestseller" className="cursor-pointer select-none text-sm font-medium text-slate-700">
                  Đánh dấu là Bestseller
                </label>
              </div>

              <AttributesManager
                attributes={formData.attributes}
                setAttributes={(attributes) => setFormData((prev) => ({ ...prev, attributes }))}
              />

              <VariantsManager
                attributes={formData.attributes}
                variants={formData.variants}
                onChange={(variants) => setFormData((prev) => ({ ...prev, variants }))}
              />

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="admin-btn-secondary">
                  Hủy
                </button>
                <button type="submit" className="admin-btn-primary">
                  Cập nhật
                </button>
              </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="space-y-4">
        <div className="admin-card p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="admin-page-title">Sản phẩm của tôi</h1>
              <p className="admin-page-subtitle">
                Quản lý danh sách sản phẩm theo danh mục, trạng thái và hiệu suất bán.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="admin-chip">{filtered.length} sản phẩm khớp bộ lọc</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="xl:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tìm kiếm</label>
              <input
                type="text"
                placeholder="Nhập tên sản phẩm..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setCurrentPage(1)
                }}
                className="admin-input"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Danh mục</label>
              <select
                value={filters.category}
                onChange={(event) => updateFilter('category', event.target.value)}
                className="admin-select"
              >
                <option value="all">Tất cả danh mục</option>
                {mainCategories.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Danh mục con</label>
              <select
                value={filters.subCategory}
                onChange={(event) => updateFilter('subCategory', event.target.value)}
                className="admin-select"
                disabled={filters.category === 'all'}
              >
                <option value="all">Tất cả danh mục con</option>
                {availableSubCategoryFilters.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Trạng thái hiển thị</label>
              <select
                value={filters.visibility}
                onChange={(event) => updateFilter('visibility', event.target.value)}
                className="admin-select"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="visible">Đang hiển thị</option>
                <option value="hidden">Đang ẩn</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Bestseller</label>
              <select
                value={filters.bestseller}
                onChange={(event) => updateFilter('bestseller', event.target.value)}
                className="admin-select"
              >
                <option value="all">Tất cả</option>
                <option value="yes">Có</option>
                <option value="no">Không</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tồn kho</label>
              <select
                value={filters.stock}
                onChange={(event) => updateFilter('stock', event.target.value)}
                className="admin-select"
              >
                <option value="all">Tất cả</option>
                <option value="in_stock">Còn hàng</option>
                <option value="low_stock">Sắp hết (1-5)</option>
                <option value="out_of_stock">Hết hàng</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Giá từ (₫)</label>
              <input
                type="number"
                min="0"
                value={filters.minPrice}
                onChange={(event) => updateFilter('minPrice', event.target.value)}
                className="admin-input"
                placeholder="0"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Giá đến (₫)</label>
              <input
                type="number"
                min="0"
                value={filters.maxPrice}
                onChange={(event) => updateFilter('maxPrice', event.target.value)}
                className="admin-input"
                placeholder="Không giới hạn"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Sắp xếp</label>
              <select
                value={filters.sort}
                onChange={(event) => updateFilter('sort', event.target.value)}
                className="admin-select"
              >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
                <option value="price_asc">Giá tăng dần</option>
                <option value="price_desc">Giá giảm dần</option>
                <option value="sold_desc">Bán chạy nhất</option>
                <option value="name_asc">Tên A-Z</option>
              </select>
            </div>
          </div>

          {hasFiltersApplied && (
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={clearFilters} className="admin-btn-secondary">
                Xóa toàn bộ bộ lọc
              </button>
            </div>
          )}
        </div>

        {loadingList ? (
          <div className="admin-card flex flex-col items-center justify-center py-16">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
            <p className="mt-3 text-sm text-slate-500">Đang tải sản phẩm...</p>
          </div>
        ) : list.length === 0 ? (
          <div className="admin-card flex flex-col items-center justify-center py-20 text-slate-400">
            <svg className="mb-4 h-16 w-16 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0v10l-8 4m0 0L4 17V7m8 10V11" />
            </svg>
            <p className="text-base font-medium text-slate-500">Chưa có sản phẩm nào</p>
            <p className="mt-1 text-sm">Hãy thêm sản phẩm đầu tiên của bạn</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-card flex flex-col items-center justify-center py-16 text-slate-400">
            <p className="text-sm">Không tìm thấy sản phẩm phù hợp bộ lọc hiện tại</p>
            <button type="button" onClick={clearFilters} className="mt-2 text-sm font-medium text-pink-600 hover:underline">
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          <div className="admin-card overflow-hidden">
            <div className="hidden grid-cols-[84px_1fr_180px_120px_90px_95px_190px] items-center border-b border-slate-200 bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
              <span>Ảnh</span>
              <span>Tên sản phẩm</span>
              <span>Danh mục</span>
              <span>Giá</span>
              <span>Tồn</span>
              <span>Trạng thái</span>
              <span className="text-center">Thao tác</span>
            </div>

            <div className="divide-y divide-slate-100">
              {paginated.map((item) => {
                const stock = getProductStock(item)
                const categoryName = categoryMap[item.category]?.name || '—'
                const subCategoryName = categoryMap[item.subCategory]?.name || ''
                return (
                  <div
                    key={item._id}
                    className="grid grid-cols-[72px_1fr] gap-3 px-4 py-3 transition hover:bg-slate-50 lg:grid-cols-[84px_1fr_180px_120px_90px_95px_190px] lg:items-center"
                  >
                    <img
                      className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
                      src={formatImageUrl(item.image, { variant: "thumb", width: 96, height: 96, fit: "cover", quality: 76, format: "webp" })}
                      referrerPolicy="no-referrer"
                      alt={item.name}
                    />

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 lg:hidden">
                        <span>{formatPrice(item.price)}</span>
                        <span>•</span>
                        <span>Tồn: {stock}</span>
                        <span>•</span>
                        <span>{item.isActive !== false ? 'Hiển thị' : 'Đang ẩn'}</span>
                      </div>
                      {item.bestseller && (
                        <span className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          Bestseller
                        </span>
                      )}
                    </div>

                    <p className="hidden text-sm text-slate-600 lg:block">
                      {categoryName}
                      {subCategoryName && <span className="block text-xs text-slate-400">{subCategoryName}</span>}
                    </p>

                    <p className="hidden text-sm font-semibold text-slate-800 lg:block">{formatPrice(item.price)}</p>
                    <p className="hidden text-sm font-semibold text-slate-700 lg:block">{stock}</p>

                    <div className="hidden lg:flex">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          item.isActive !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {item.isActive !== false ? 'Hiển thị' : 'Đang ẩn'}
                      </span>
                    </div>

                    <div className="col-span-2 mt-1 flex flex-wrap items-center gap-2 lg:col-span-1 lg:mt-0 lg:justify-center">
                      <button
                        type="button"
                        onClick={() => toggleProductVisibility(item._id, item.isActive === false)}
                        className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                          item.isActive === false
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {item.isActive === false ? 'Hiện' : 'Ẩn'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openUpdateModal(item)}
                        className="inline-flex rounded-md bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmRemove(item._id)}
                        className="inline-flex rounded-md bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-sm text-slate-600 transition hover:border-pink-400 hover:text-pink-600 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Trang trước"
            >
              ‹
            </button>

            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <button
                type="button"
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`h-8 w-8 rounded-md border text-sm font-medium transition ${
                  currentPage === page
                    ? 'border-pink-500 bg-pink-500 text-white'
                    : 'border-slate-300 text-slate-700 hover:border-pink-400 hover:text-pink-600'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-sm text-slate-600 transition hover:border-pink-400 hover:text-pink-600 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Trang sau"
            >
              ›
            </button>
          </div>
        )}
      </section>
    </>
  )
}

export default List



