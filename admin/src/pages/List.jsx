import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
    <div className="admin-card w-full max-w-sm p-6 shadow-xl rounded-2xl border border-slate-100 bg-white">
      <div className="flex items-center gap-2.5 text-rose-600 mb-3">
        <svg className="w-5.5 h-5.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="font-bold text-base text-slate-800">Xác nhận xóa</h3>
      </div>
      <p className="text-xs font-semibold text-slate-500 leading-relaxed">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-650 hover:bg-slate-50 transition duration-200"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex items-center justify-center rounded-xl bg-rose-600 hover:bg-rose-700 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-rose-600/10 transition duration-200"
        >
          Đồng ý xóa
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
        className={`flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-all hover:border-pink-400 ${
          isDragOver ? 'border-pink-500 bg-pink-50' : 'border-slate-200 bg-slate-50/50'
        }`}
      >
        {preview ? (
          <img src={preview} alt={`slot-${index}`} className="h-full w-full object-cover" />
        ) : (
          <img src={assets.upload_area} alt="upload" className="h-8 w-8 opacity-45" />
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
        <div className="pointer-events-none absolute left-1.5 top-1.5 rounded-lg bg-black/60 px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
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
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs leading-none text-white transition hover:bg-rose-600 shadow-sm"
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

  const [searchParams, setSearchParams] = useSearchParams()
  const initialSearch = searchParams.get('q') || ''
  const [search, setSearch] = useState(initialSearch)
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

  useEffect(() => {
    const q = searchParams.get('q') || ''
    setSearch(q)

    setFilters((prev) => {
      const next = { ...DEFAULT_FILTERS }
      for (const key of Object.keys(DEFAULT_FILTERS)) {
        const val = searchParams.get(key)
        if (val !== null) {
          next[key] = val
        }
      }
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev
      return next
    })
  }, [searchParams])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const q = searchParams.get('q') || ''
      if (search !== q) {
        const nextParams = new URLSearchParams(searchParams)
        if (search.trim()) {
          nextParams.set('q', search)
        } else {
          nextParams.delete('q')
        }
        setSearchParams(nextParams, { replace: true })
      }
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [search, searchParams, setSearchParams])

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
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set(key, value)
    if (key === 'category') {
      nextParams.set('subCategory', 'all')
    }
    setSearchParams(nextParams, { replace: true })
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setSearch('')
    setSearchParams({}, { replace: true })
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

      {/* Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 p-3 sm:p-4 md:p-6 flex items-center justify-center backdrop-blur-xs">
          <div className="admin-card w-full max-w-4xl flex flex-col overflow-hidden p-0 max-h-[92vh] rounded-2xl shadow-xl bg-white border border-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-800 tracking-tight">Cập nhật sản phẩm</h2>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Sửa đổi thông số kỹ thuật, hình ảnh minh họa và biến thể của sản phẩm.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Đóng chỉnh sửa sản phẩm"
                className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <form onSubmit={updateProduct} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* Left column in Modal: Images & Price */}
                <div className="lg:col-span-1 space-y-5">
                  <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-xl space-y-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Hình ảnh</label>
                      <p className="text-[10px] text-slate-400 leading-normal mt-0.5">Kéo-thả đổi vị trí. Bấm vào để đổi ảnh, × để xóa.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
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
                  </div>

                  <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-xl space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Giá bán (₫)</label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-450">₫</span>
                        <input
                          type="number"
                          name="price"
                          value={formData.price}
                          onChange={handleInputChange}
                          className="admin-input pl-8 py-2 font-semibold text-slate-700 focus:border-pink-500"
                          step="1"
                          min="0"
                          required
                        />
                      </div>
                      {formData.variants.length > 0 && (
                        <p className="text-[10px] text-slate-450 mt-1 font-medium">Tự động chọn theo biến thể.</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 p-2.5 bg-white border border-slate-150 rounded-lg">
                      <input
                        type="checkbox"
                        id="edit-bestseller"
                        name="bestseller"
                        checked={formData.bestseller}
                        onChange={handleInputChange}
                        className="h-4 w-4 cursor-pointer accent-pink-500"
                      />
                      <label htmlFor="edit-bestseller" className="cursor-pointer select-none text-xs font-bold text-slate-700">
                        Bestseller
                      </label>
                    </div>
                  </div>
                </div>

                {/* Right column in Modal: Inputs, Attributes, Variants */}
                <div className="lg:col-span-2 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tên sản phẩm</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="admin-input py-2 font-semibold"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Danh mục</label>
                      {loadingCategories ? (
                        <div className="admin-input py-2 text-slate-400">Đang tải...</div>
                      ) : (
                        <select
                          name="category"
                          value={formData.category}
                          onChange={handleInputChange}
                          className="admin-select py-2"
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
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Danh mục con</label>
                      <select
                        name="subCategory"
                        value={formData.subCategory}
                        onChange={handleInputChange}
                        className="admin-select py-2"
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
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Mô tả sản phẩm</label>
                      <button
                        type="button"
                        onClick={handleGenerateEditDescription}
                        disabled={isGeneratingEditDescription}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-[10px] font-bold transition-all disabled:opacity-60"
                      >
                        {isGeneratingEditDescription ? 'AI đang tạo...' : 'AI viết mô tả'}
                      </button>
                    </div>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="admin-input min-h-[90px] py-2 text-xs leading-relaxed"
                      required
                    />
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <AttributesManager
                      attributes={formData.attributes}
                      setAttributes={(attributes) => setFormData((prev) => ({ ...prev, attributes }))}
                    />
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <VariantsManager
                      attributes={formData.attributes}
                      variants={formData.variants}
                      onChange={(variants) => setFormData((prev) => ({ ...prev, variants }))}
                    />
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="lg:col-span-3 flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition duration-200"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="admin-btn-primary px-4.5 py-2 text-xs font-bold rounded-xl shadow-md shadow-pink-500/10 hover:shadow-lg transition duration-200"
                  >
                    Lưu cập nhật
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Main List Section */}
      <section className="space-y-5">
        
        {/* Filter & Search Header Card */}
        <div className="admin-card p-5 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="admin-page-title text-2xl font-bold tracking-tight text-slate-800">Sản phẩm của tôi</h1>
              <p className="admin-page-subtitle text-xs text-slate-400 mt-1 font-medium">
                Tìm kiếm, lọc danh mục sản phẩm, biến động tồn kho và trạng thái hiển thị của các sản phẩm đăng bán.
              </p>
            </div>
            <div className="shrink-0 self-start sm:self-auto">
              <span className="inline-flex rounded-full bg-pink-50 px-3 py-1 text-xs font-bold text-pink-650 border border-pink-100">
                Tìm thấy {filtered.length} sản phẩm
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pt-1">
            <div className="lg:col-span-2">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Từ khóa tìm kiếm</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nhập tên sản phẩm cần tìm..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setCurrentPage(1)
                  }}
                  className="admin-input pl-9 py-2 rounded-xl focus:border-pink-500"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Danh mục chính</label>
              <select
                value={filters.category}
                onChange={(event) => updateFilter('category', event.target.value)}
                className="admin-select py-2 rounded-xl focus:border-pink-500"
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
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Danh mục con</label>
              <select
                value={filters.subCategory}
                onChange={(event) => updateFilter('subCategory', event.target.value)}
                className="admin-select py-2 rounded-xl focus:border-pink-500"
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
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Trạng thái hiển thị</label>
              <select
                value={filters.visibility}
                onChange={(event) => updateFilter('visibility', event.target.value)}
                className="admin-select py-2 rounded-xl focus:border-pink-500"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="visible">Đang hiển thị</option>
                <option value="hidden">Đang ẩn</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Bestseller</label>
              <select
                value={filters.bestseller}
                onChange={(event) => updateFilter('bestseller', event.target.value)}
                className="admin-select py-2 rounded-xl focus:border-pink-500"
              >
                <option value="all">Tất cả</option>
                <option value="yes">Bestseller</option>
                <option value="no">Không phải Bestseller</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Số lượng tồn kho</label>
              <select
                value={filters.stock}
                onChange={(event) => updateFilter('stock', event.target.value)}
                className="admin-select py-2 rounded-xl focus:border-pink-500"
              >
                <option value="all">Tất cả số lượng</option>
                <option value="in_stock">Còn hàng trong kho</option>
                <option value="low_stock">Sắp hết (1 đến 5 sp)</option>
                <option value="out_of_stock">Đã hết hàng</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Sắp xếp theo</label>
              <select
                value={filters.sort}
                onChange={(event) => updateFilter('sort', event.target.value)}
                className="admin-select py-2 rounded-xl focus:border-pink-500"
              >
                <option value="newest">Ngày tạo: Mới nhất</option>
                <option value="oldest">Ngày tạo: Cũ nhất</option>
                <option value="price_asc">Giá: Thấp đến cao</option>
                <option value="price_desc">Giá: Cao đến thấp</option>
                <option value="sold_desc">Lượng bán: Cao đến thấp</option>
                <option value="name_asc">Tên sản phẩm: A-Z</option>
              </select>
            </div>
          </div>

          {hasFiltersApplied && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Xóa toàn bộ bộ lọc
              </button>
            </div>
          )}
        </div>

        {/* Product List Content */}
        {loadingList ? (
          <div className="admin-card flex flex-col items-center justify-center py-20 bg-white">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600" />
            <p className="mt-4 text-xs font-semibold text-slate-505 animate-pulse">Đang tải danh sách sản phẩm...</p>
          </div>
        ) : list.length === 0 ? (
          <div className="admin-card flex flex-col items-center justify-center py-20 text-slate-400 bg-white text-center">
            <svg className="mb-4 h-14 w-14 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0v10l-8 4m0 0L4 17V7m8 10V11" />
            </svg>
            <p className="text-sm font-semibold text-slate-500">Cửa hàng chưa có sản phẩm nào được đăng bán</p>
            <p className="mt-1 text-xs text-slate-400 font-medium">Hãy tiến hành thêm sản phẩm đầu tiên để bắt đầu bán hàng.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-card flex flex-col items-center justify-center py-16 text-slate-400 bg-white">
            <svg className="w-10 h-10 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs font-bold text-slate-500">Không tìm thấy sản phẩm phù hợp bộ lọc hiện tại</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3.5 inline-flex items-center gap-1 px-3 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-lg text-xs font-bold transition-all"
            >
              Reset bộ lọc
            </button>
          </div>
        ) : (
          <div className="admin-card overflow-hidden bg-white shadow-sm border border-slate-200">
            {/* Table Header for Desktop */}
            <div className="hidden grid-cols-[88px_1fr_180px_130px_90px_100px_190px] items-center border-b border-slate-100 bg-slate-50 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 lg:grid">
              <span>Ảnh</span>
              <span>Tên sản phẩm</span>
              <span>Danh mục</span>
              <span>Giá bán</span>
              <span>Tồn kho</span>
              <span>Hiển thị</span>
              <span className="text-center">Thao tác</span>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-slate-100">
              {paginated.map((item) => {
                const stock = getProductStock(item)
                const categoryName = categoryMap[item.category]?.name || '—'
                const subCategoryName = categoryMap[item.subCategory]?.name || ''
                return (
                  <div
                    key={item._id}
                    className="grid grid-cols-[64px_1fr] gap-3.5 px-4 py-3.5 transition hover:bg-slate-50/50 lg:grid-cols-[88px_1fr_180px_130px_90px_100px_190px] lg:items-center lg:px-5"
                  >
                    <img
                      className="h-14 w-14 rounded-lg border border-slate-200 object-cover shadow-xs"
                      src={formatImageUrl(item.image, { variant: "thumb", width: 96, height: 96, fit: "cover", quality: 76, format: "webp" })}
                      referrerPolicy="no-referrer"
                      alt={item.name}
                    />

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-700">{item.name}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-450 lg:hidden font-medium">
                        <span className="font-bold text-slate-700">{formatPrice(item.price)}</span>
                        <span>•</span>
                        <span>Tồn: <span className="font-bold">{stock}</span></span>
                        <span>•</span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.isActive !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {item.isActive !== false ? 'Hiển thị' : 'Ẩn'}
                        </span>
                      </div>
                      {item.bestseller && (
                        <span className="mt-1.5 inline-flex items-center rounded-md bg-amber-50 border border-amber-200/50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          Bestseller
                        </span>
                      )}
                    </div>

                    <p className="hidden text-xs font-semibold text-slate-650 lg:block leading-normal">
                      {categoryName}
                      {subCategoryName && <span className="block text-[10px] font-medium text-slate-400 mt-0.5">{subCategoryName}</span>}
                    </p>

                    <p className="hidden text-sm font-bold text-slate-800 lg:block">{formatPrice(item.price)}</p>
                    
                    <p className="hidden lg:block">
                      <span className={`text-sm font-bold ${stock === 0 ? 'text-rose-600' : stock <= 5 ? 'text-amber-600' : 'text-slate-700'}`}>
                        {stock}
                      </span>
                    </p>

                    <div className="hidden lg:flex">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase ${
                          item.isActive !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-150'
                        }`}
                      >
                        {item.isActive !== false ? 'Hiển thị' : 'Đang ẩn'}
                      </span>
                    </div>

                    <div className="col-span-2 mt-1.5 flex flex-wrap items-center gap-1.5 lg:col-span-1 lg:mt-0 lg:justify-center">
                      <button
                        type="button"
                        onClick={() => toggleProductVisibility(item._id, item.isActive === false)}
                        className={`inline-flex rounded-lg px-2.5 py-1.5 text-xs font-bold transition border ${
                          item.isActive === false
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50 hover:bg-emerald-100/60'
                            : 'bg-slate-50 text-slate-650 border-slate-200/50 hover:bg-slate-100/60'
                        }`}
                      >
                        {item.isActive === false ? 'Hiện' : 'Ẩn'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openUpdateModal(item)}
                        className="inline-flex rounded-lg bg-sky-50 text-sky-700 border border-sky-200/50 px-2.5 py-1.5 text-xs font-bold transition hover:bg-sky-100/60"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmRemove(item._id)}
                        className="inline-flex rounded-lg bg-rose-50 text-rose-700 border border-rose-200/50 px-2.5 py-1.5 text-xs font-bold transition hover:bg-rose-100/60"
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

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-2">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500 transition hover:border-pink-400 hover:text-pink-600 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Trang trước"
            >
              ‹
            </button>

            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <button
                type="button"
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`h-8 w-8 rounded-lg border text-xs font-bold transition ${
                  currentPage === page
                    ? 'border-pink-500 bg-pink-500 text-white shadow-sm shadow-pink-500/10'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-pink-400 hover:text-pink-600'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500 transition hover:border-pink-400 hover:text-pink-600 disabled:cursor-not-allowed disabled:opacity-40"
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
