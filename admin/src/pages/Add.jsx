import { useEffect, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { assets } from '../assets/assets.js'
import { backendUrl } from '../App.jsx'
import { getDefaultAttributesForCategory } from '../utils/categoryHelper.js'
import AttributesManager from '../components/AttributesManager.jsx'
import VariantsManager from '../components/VariantsManager.jsx'

const getRawPriceValue = (value) => String(value || '').replace(/\D/g, '')
const formatPriceInput = (value) => {
  const rawValue = getRawPriceValue(value)
  if (!rawValue) return ''
  return Number(rawValue).toLocaleString('vi-VN')
}

const Add = ({ token }) => {
  const [image1, setImage1] = useState(false)
  const [image2, setImage2] = useState(false)
  const [image3, setImage3] = useState(false)
  const [image4, setImage4] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [bestseller, setBestseller] = useState(false)
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
  const [attributes, setAttributes] = useState([])
  const [variants, setVariants] = useState([])
  const [mainCategories, setMainCategories] = useState([])
  const [subCategories, setSubCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState(null)

  useEffect(() => {
    if (variants.length > 0) {
      const prices = variants.map((variant) => Number(variant.price)).filter((value) => !Number.isNaN(value) && value > 0)
      if (prices.length > 0) setPrice(formatPriceInput(String(Math.min(...prices))))
      setStock(String(variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0)))
    }
  }, [variants])

  useEffect(() => {
    const fetchMainCategories = async () => {
      try {
        const response = await axios.get(`${backendUrl}/api/category/list`)
        if (response.data.success) {
          const categories = response.data.categories.filter((categoryItem) => categoryItem.level === 1)
          setMainCategories(categories)
          if (categories.length > 0) {
            setCategory(categories[0]._id)
            setSelectedCategory(categories[0])
          }
        }
      } catch (error) {
        toast.error(error.response?.data?.message || 'Không thể tải danh mục')
      } finally {
        setLoadingCategories(false)
      }
    }

    fetchMainCategories()
  }, [])

  useEffect(() => {
    if (!selectedCategory) return
    const defaultAttributes = getDefaultAttributesForCategory(selectedCategory)
    setAttributes(defaultAttributes)
  }, [selectedCategory])

  useEffect(() => {
    const fetchSubCategories = async () => {
      if (!category) {
        setSubCategories([])
        setSubCategory('')
        return
      }
      try {
        const response = await axios.get(`${backendUrl}/api/category/${category}/subcategories`)
        if (response.data.success) {
          const nextSubCategories = response.data.subcategories || []
          setSubCategories(nextSubCategories)
          setSubCategory(nextSubCategories.length > 0 ? nextSubCategories[0]._id : '')
        }
      } catch {
        setSubCategories([])
        setSubCategory('')
      }
    }

    fetchSubCategories()
  }, [category])

  const onSubmitHandler = async (event) => {
    event.preventDefault()
    try {
      const rawPrice = getRawPriceValue(price)
      if (!name || !description || !rawPrice) {
        toast.error('Vui lòng điền đầy đủ các trường bắt buộc')
        return
      }

      const hasValidAttributes = attributes.every((attribute) => attribute.values && attribute.values.length > 0)
      if (!hasValidAttributes) {
        toast.error('Vui lòng thêm ít nhất một giá trị cho mỗi thuộc tính')
        return
      }

      if (variants.length > 0) {
        const missingPrice = variants.some((variant) => !variant.price || variant.price <= 0)
        if (missingPrice) {
          toast.error('Vui lòng nhập giá cho tất cả biến thể')
          return
        }
      } else if (stock === '') {
        toast.error('Vui lòng nhập tồn kho cho sản phẩm không có biến thể')
        return
      }

      if (!image1 && !image2 && !image3 && !image4) {
        toast.error('Vui lòng tải lên ít nhất một ảnh sản phẩm')
        return
      }

      const formData = new FormData()
      formData.append('name', name)
      formData.append('description', description)
      formData.append('price', rawPrice)
      formData.append('stock', String(Number(stock) || 0))
      formData.append('category', category)
      formData.append('subCategory', subCategory)
      formData.append('attributes', JSON.stringify(attributes))
      formData.append('variants', JSON.stringify(variants))
      formData.append('bestseller', bestseller)
      
      const tagsArray = tagsInput
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
      formData.append('tags', JSON.stringify(tagsArray))

      if (image1) formData.append('image1', image1)
      if (image2) formData.append('image2', image2)
      if (image3) formData.append('image3', image3)
      if (image4) formData.append('image4', image4)

      const response = await axios.post(`${backendUrl}/api/product/add`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', token },
      })

      if (!response?.data) {
        toast.error('Không nhận được phản hồi từ máy chủ')
        return
      }

      if (response.data.success) {
        toast.success(response.data.message || 'Đã thêm sản phẩm thành công')
        setName('')
        setDescription('')
        if (mainCategories.length > 0) {
          setCategory(mainCategories[0]._id)
          setSelectedCategory(mainCategories[0])
        }
        setSubCategory('')
        setPrice('')
        setStock('')
        setTagsInput('')
        setAttributes([])
        setVariants([])
        setBestseller(false)
        setImage1(false)
        setImage2(false)
        setImage3(false)
        setImage4(false)
      } else {
        toast.error(response.data.message || 'Không thể thêm sản phẩm')
      }
    } catch (error) {
      if (error.response) {
        toast.error(error.response.data?.message || 'Lỗi máy chủ')
      } else if (error.request) {
        toast.error('Không nhận được phản hồi từ máy chủ')
      } else {
        toast.error(`Lỗi gửi yêu cầu: ${error.message}`)
      }
    }
  }

  const handleGenerateDescription = async () => {
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên sản phẩm trước khi tạo mô tả')
      return
    }
    try {
      setIsGeneratingDescription(true)
      const selectedMainCategory = mainCategories.find((categoryItem) => categoryItem._id === category)
      const selectedSubCategory = subCategories.find((categoryItem) => categoryItem._id === subCategory)
      const primaryImage = image1 || image2 || image3 || image4

      let imageBase64 = ''
      let imageMimeType = ''
      if (primaryImage) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(new Error('Không đọc được ảnh đã chọn'))
          reader.readAsDataURL(primaryImage)
        })
        const match = dataUrl.match(/^data:(.+);base64,(.+)$/)
        if (match) {
          imageMimeType = match[1] || 'image/jpeg'
          imageBase64 = match[2] || ''
        }
      }

      const response = await axios.post(
        `${backendUrl}/api/product/generate-description`,
        {
          name: name.trim(),
          category: selectedMainCategory?.name || '',
          subCategory: selectedSubCategory?.name || '',
          attributes,
          price: price ? `${Number(getRawPriceValue(price)).toLocaleString('vi-VN')}đ` : '',
          variants: attributes.map((attribute) => `${attribute.name}: ${attribute.values.join(', ')}`),
          imageBase64,
          imageMimeType,
        },
        { headers: { token } }
      )

      if (response.data?.success && response.data?.description) {
        setDescription(response.data.description)
        toast.success('Đã tạo mô tả tự động')
      } else {
        toast.error(response.data?.message || 'Không thể tạo mô tả')
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi khi tạo mô tả bằng AI')
    } finally {
      setIsGeneratingDescription(false)
    }
  }

  const hasVariants = variants.length > 0

  return (
    <section className="space-y-5">
      <div>
        <h1 className="admin-page-title text-2xl font-bold tracking-tight text-slate-800">Đăng bán sản phẩm</h1>
        <p className="admin-page-subtitle text-xs text-slate-400 mt-1 font-medium">Đăng tải thông tin chi tiết, hình ảnh minh họa và thiết lập biến thể cho sản phẩm mới.</p>
      </div>

      <form onSubmit={onSubmitHandler} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <div className="admin-card p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-tight">Hình ảnh sản phẩm</h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                Tải lên tối đa 4 ảnh. Khuyên dùng ảnh vuông, ảnh đầu tiên sẽ làm ảnh đại diện chính của sản phẩm.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {[image1, image2, image3, image4].map((image, index) => (
                <label
                  key={`image-input-${index + 1}`}
                  className="group relative flex h-28 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 transition-all hover:border-pink-400 hover:bg-slate-50"
                  htmlFor={`image${index + 1}`}
                >
                  {image ? (
                    <div className="relative h-full w-full">
                      <img
                        src={URL.createObjectURL(image)}
                        alt={`upload-${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200">
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">Thay đổi ảnh</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 p-3 text-center">
                      <svg className="w-5 h-5 text-slate-400 group-hover:text-pink-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-[10px] font-bold text-slate-450 group-hover:text-pink-600 transition-colors">
                        {index === 0 ? 'Ảnh chính' : `Ảnh phụ ${index}`}
                      </span>
                    </div>
                  )}
                  <input
                    type="file"
                    id={`image${index + 1}`}
                    hidden
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files[0]
                      if (index === 0) setImage1(file)
                      if (index === 1) setImage2(file)
                      if (index === 2) setImage3(file)
                      if (index === 3) setImage4(file)
                    }}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="admin-card p-5 space-y-5">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Giá & Trưng bày</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Giá sản phẩm (₫)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-450">₫</span>
                  <input
                    onChange={(event) => setPrice(formatPriceInput(event.target.value))}
                    value={price}
                    type="text"
                    inputMode="numeric"
                    className="admin-input pl-8 py-2.5 font-semibold text-slate-700 focus:border-pink-500"
                    placeholder="0"
                    required
                  />
                </div>
                {hasVariants && (
                  <p className="text-[10px] text-slate-400 mt-1.5 font-medium flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Tự động lấy giá thấp nhất từ các biến thể.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Tồn kho
                </label>
                <input
                  onChange={(event) => setStock(event.target.value)}
                  value={stock}
                  type="number"
                  min="0"
                  className="admin-input py-2.5 font-semibold text-slate-700 focus:border-pink-500"
                  placeholder="0"
                  required={!hasVariants}
                  disabled={hasVariants}
                />
                <p className="text-[10px] text-slate-400 mt-1.5 font-medium">
                  {hasVariants
                    ? 'Tự động cộng tổng tồn kho từ các biến thể.'
                    : 'Dùng cho sản phẩm không có biến thể / thuộc tính.'}
                </p>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <input
                  type="checkbox"
                  id="bestseller"
                  checked={bestseller}
                  onChange={(event) => setBestseller(event.target.checked)}
                  className="h-4.5 w-4.5 cursor-pointer rounded-md border-slate-300 text-pink-600 accent-pink-500 focus:ring-pink-500/20"
                />
                <label htmlFor="bestseller" className="cursor-pointer select-none text-xs font-semibold text-slate-750">
                  Đánh dấu là Bestseller
                  <span className="block text-[10px] text-slate-400 font-medium mt-0.5">Hiển thị nổi bật trên trang chủ storefront</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="admin-card p-5 space-y-5">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Thông tin chung</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Tên sản phẩm</label>
                <input
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                  className="admin-input py-2.5 text-sm font-medium focus:border-pink-500"
                  type="text"
                  placeholder="Nhập tên sản phẩm đầy đủ và chi tiết..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Danh mục chính <span className="text-rose-500">*</span>
                  </label>
                  {loadingCategories ? (
                    <div className="admin-input py-2.5 text-slate-400">Đang tải danh mục...</div>
                  ) : (
                    <select
                      value={category}
                      onChange={(event) => {
                        const selectedId = event.target.value
                        setCategory(selectedId)
                        const selected = mainCategories.find((categoryItem) => categoryItem._id === selectedId)
                        setSelectedCategory(selected || null)
                      }}
                      className="admin-select py-2.5 focus:border-pink-500"
                      required
                    >
                      <option value="">-- Chọn danh mục --</option>
                      {mainCategories.map((categoryItem) => (
                        <option key={categoryItem._id} value={categoryItem._id}>
                          {categoryItem.icon ? `${categoryItem.icon} ` : ''}
                          {categoryItem.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Danh mục con
                  </label>
                  <select
                    value={subCategory}
                    onChange={(event) => setSubCategory(event.target.value)}
                    className="admin-select py-2.5 focus:border-pink-500"
                    disabled={!category || subCategories.length === 0}
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
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Mô tả sản phẩm</label>
                  <button
                    type="button"
                    onClick={handleGenerateDescription}
                    disabled={isGeneratingDescription}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-xs font-bold shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isGeneratingDescription ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-sky-400 border-t-sky-700 rounded-full animate-spin"></span>
                        <span>Đang phân tích...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        <span>AI viết mô tả</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  onChange={(event) => setDescription(event.target.value)}
                  value={description}
                  className="admin-input min-h-[120px] py-2.5 text-sm leading-relaxed"
                  placeholder="Mô tả các thông số kỹ thuật, chất liệu, tính năng đặc biệt của sản phẩm..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Tags / Thẻ tìm kiếm
                </label>
                <input
                  onChange={(event) => setTagsInput(event.target.value)}
                  value={tagsInput}
                  className="admin-input py-2.5 text-sm font-medium focus:border-pink-500"
                  type="text"
                  placeholder="Nhập các thẻ cách nhau bằng dấu phẩy (ví dụ: son moi, skincare, han quoc)..."
                />
              </div>
            </div>
          </div>

          <div className="admin-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Thuộc tính sản phẩm</h3>
            <AttributesManager attributes={attributes} setAttributes={setAttributes} />
          </div>

          <div className="admin-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Biến thể & Tồn kho</h3>
            <VariantsManager attributes={attributes} variants={variants} onChange={setVariants} />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              className="admin-btn-primary w-full py-3 text-sm font-bold shadow-md shadow-pink-500/10 hover:shadow-lg hover:shadow-pink-500/15"
            >
              Đăng bán sản phẩm ngay
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}

export default Add
