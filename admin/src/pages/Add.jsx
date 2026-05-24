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
      }

      if (!image1 && !image2 && !image3 && !image4) {
        toast.error('Vui lòng tải lên ít nhất một ảnh sản phẩm')
        return
      }

      const formData = new FormData()
      formData.append('name', name)
      formData.append('description', description)
      formData.append('price', rawPrice)
      formData.append('category', category)
      formData.append('subCategory', subCategory)
      formData.append('attributes', JSON.stringify(attributes))
      formData.append('variants', JSON.stringify(variants))
      formData.append('bestseller', bestseller)

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

  return (
    <section className="space-y-4">
      <div>
        <h1 className="admin-page-title">Thêm sản phẩm</h1>
        <p className="admin-page-subtitle">Tạo sản phẩm mới với danh mục, thuộc tính, biến thể và hình ảnh.</p>
      </div>

      <form onSubmit={onSubmitHandler} className="admin-card grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">
        <div className="lg:col-span-1">
          <p className="mb-3 text-sm font-semibold text-slate-800">Hình ảnh sản phẩm</p>
          <div className="flex flex-wrap gap-3">
            {[image1, image2, image3, image4].map((image, index) => (
              <label
                key={`image-input-${index + 1}`}
                className="flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-300 transition hover:border-pink-400"
                htmlFor={`image${index + 1}`}
              >
                <img
                  src={image ? URL.createObjectURL(image) : assets.upload_area}
                  alt="upload"
                  className={image ? 'h-full w-full object-cover' : 'h-11 w-11 opacity-70'}
                />
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
          <p className="mt-1 text-xs text-slate-400">Tối đa 4 ảnh. Khuyến nghị ảnh vuông hoặc tỷ lệ gần 1:1.</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Tên sản phẩm</label>
          <input
            onChange={(event) => setName(event.target.value)}
            value={name}
            className="admin-input"
            type="text"
            placeholder="Nhập tên sản phẩm"
            required
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-3">
            <label className="block text-sm font-medium text-slate-700">Mô tả sản phẩm</label>
            <button
              type="button"
              onClick={handleGenerateDescription}
              disabled={isGeneratingDescription}
              className="inline-flex items-center justify-center rounded-md border border-sky-200 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGeneratingDescription ? 'Đang tạo...' : 'AI tạo mô tả'}
            </button>
          </div>
          <textarea
            onChange={(event) => setDescription(event.target.value)}
            value={description}
            className="admin-input min-h-[132px]"
            placeholder="Mô tả chi tiết sản phẩm"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Danh mục <span className="text-rose-500">*</span>
          </label>
          {loadingCategories ? (
            <div className="admin-input text-slate-500">Đang tải danh mục...</div>
          ) : (
            <select
              value={category}
              onChange={(event) => {
                const selectedId = event.target.value
                setCategory(selectedId)
                const selected = mainCategories.find((categoryItem) => categoryItem._id === selectedId)
                setSelectedCategory(selected || null)
              }}
              className="admin-select"
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
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Danh mục con
            {subCategories.length === 0 && category && (
              <span className="ml-2 text-xs text-slate-400">(Không có danh mục con)</span>
            )}
          </label>
          <select
            value={subCategory}
            onChange={(event) => setSubCategory(event.target.value)}
            className="admin-select"
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

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Giá sản phẩm (₫)
            {variants.length > 0 && (
              <span className="ml-2 text-xs font-normal text-sky-600">(tự động lấy từ giá thấp nhất của biến thể)</span>
            )}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₫</span>
            <input
              onChange={(event) => setPrice(formatPriceInput(event.target.value))}
              value={price}
              type="text"
              inputMode="numeric"
              className="admin-input pl-8"
              placeholder="0"
              required
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="bestseller"
            checked={bestseller}
            onChange={(event) => setBestseller(event.target.checked)}
            className="h-4 w-4 cursor-pointer accent-pink-500"
          />
          <label htmlFor="bestseller" className="cursor-pointer select-none text-sm font-medium text-slate-700">
            Đánh dấu là Bestseller
            <span className="ml-1 text-xs text-slate-400">(hiển thị nổi bật trên storefront)</span>
          </label>
        </div>

        <div className="lg:col-span-2">
          <AttributesManager attributes={attributes} setAttributes={setAttributes} />
        </div>

        <div className="lg:col-span-2">
          <VariantsManager attributes={attributes} variants={variants} onChange={setVariants} />
        </div>

        <div className="lg:col-span-2">
          <button type="submit" className="admin-btn-primary w-full py-2.5">
            Thêm sản phẩm
          </button>
        </div>
      </form>
    </section>
  )
}

export default Add
