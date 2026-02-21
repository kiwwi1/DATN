import React, { useEffect, useState } from 'react'
import { backendUrl } from '../App'
import axios from 'axios'
import { toast } from 'react-toastify'
import AttributesManager from '../components/AttributesManager'
import { formatPrice } from '../utils/priceFormat'
import { formatImageUrl } from '../utils/imageUtils'

const List = ({token}) => {

  const [list, setList] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [currentProduct, setCurrentProduct] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    subCategory: '',
    attributes: [],
    bestseller: false
  })
  
  // Categories state
  const [mainCategories, setMainCategories] = useState([])
  const [subCategories, setSubCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [categoryMap, setCategoryMap] = useState({})

  // Fetch categories for mapping
  const fetchCategories = async () => {
    try {
      const response = await axios.get(backendUrl + '/api/category/list')
      if (response.data.success) {
        const allCategories = response.data.categories
        
        // Create category map for quick lookup
        const map = {}
        allCategories.forEach(cat => {
          map[cat._id] = cat
        })
        setCategoryMap(map)
        
        // Set main categories for dropdown
        const mainCats = allCategories.filter(cat => cat.level === 1)
        setMainCategories(mainCats)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    } finally {
      setLoadingCategories(false)
    }
  }

  const fetchList = async () => {
    try {
      // Use vendor-specific endpoint to only show products owned by the vendor
      const response = await axios.get(backendUrl+'/api/product/vendor-list', {
        headers: { token }
      })
      if(response.data.success){
        setList(response.data.products)
      }
      else{
        toast.error(response.data.message)
      }
    } catch (e) {
      console.log(e)
      toast.error(e.message)
    }
  }
  
  // Fetch subcategories when category changes in modal
  const fetchSubCategories = async (categoryId) => {
    if (!categoryId) {
      setSubCategories([])
      return
    }

    try {
      const response = await axios.get(backendUrl + `/api/category/${categoryId}/subcategories`)
      if (response.data.success) {
        setSubCategories(response.data.subcategories)
      }
    } catch (error) {
      console.error('Error fetching subcategories:', error)
      setSubCategories([])
    }
  }

  const removeProduct = async (id) => {
    try {
      const response = await axios.post(backendUrl+'/api/product/remove', {id} ,{headers:{token}})
      if(response.data.success){
        toast.success(response.data.message)
        await fetchList()
      }
      else{
        toast.error(response.data.message)
      }
      
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }

  const openUpdateModal = async (product) => {
    setCurrentProduct(product)
    
    // Fetch subcategories for the product's category
    if (product.category) {
      await fetchSubCategories(product.category)
    }
    
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      subCategory: product.subCategory || '',
      attributes: product.attributes || [],
      bestseller: product.bestseller
    })
    setShowModal(true)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    
    if (name === 'category') {
      // When category changes, fetch new subcategories and reset subCategory
      fetchSubCategories(value)
      setFormData({
        ...formData,
        category: value,
        subCategory: ''
      })
    } else {
      setFormData({
        ...formData,
        [name]: type === 'checkbox' ? checked : value
      })
    }
  }

  const updateProduct = async (e) => {
    e.preventDefault()
    try {
      // Validate attributes
      const hasValidAttributes = formData.attributes.every(attr => attr.values && attr.values.length > 0)
      if (!hasValidAttributes) {
        toast.error('Please add at least one value for each attribute')
        return
      }

      const response = await axios.post(backendUrl+'/api/product/update', 
        {
          productId: currentProduct._id, 
          name: formData.name, 
          description: formData.description, 
          price: formData.price, 
          category: formData.category, 
          subCategory: formData.subCategory, 
          attributes: formData.attributes, 
          bestseller: formData.bestseller
        }, 
        {headers:{token}}
      )
      if(response.data.success){
        toast.success(response.data.message)
        setShowModal(false)
        await fetchList()
      }
      else{
        toast.error(response.data.message)
      }
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }

  useEffect(()=>{
    fetchCategories()
    fetchList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])
  return (
    <>
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl my-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Update Product</h2>
            <form onSubmit={updateProduct}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Name</label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleInputChange} 
                  className="w-full border-2 border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea 
                  name="description" 
                  value={formData.description} 
                  onChange={handleInputChange} 
                  className="w-full border-2 border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  rows="3"
                  required
                ></textarea>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Price</label>
                <input 
                  type="number" 
                  name="price" 
                  value={formData.price} 
                  onChange={handleInputChange} 
                  className="w-full border-2 border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  step="0.01"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Category <span className="text-red-500">*</span></label>
                {loadingCategories ? (
                  <div className='w-full border-2 border-gray-300 rounded-lg p-2 text-gray-500'>
                    Loading categories...
                  </div>
                ) : (
                  <select 
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange} 
                    className="w-full border-2 border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    required
                  >
                    <option value="">-- Select Category --</option>
                    {mainCategories.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.icon && `${cat.icon} `}{cat.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">
                  Sub Category
                  {subCategories.length === 0 && formData.category && (
                    <span className="text-xs text-gray-500 ml-2">(No subcategories available)</span>
                  )}
                </label>
                <select 
                  name="subCategory"
                  value={formData.subCategory}
                  onChange={handleInputChange}  
                  className="w-full border-2 border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  disabled={!formData.category || subCategories.length === 0}
                >
                  <option value="">-- Select SubCategory (Optional) --</option>
                  {subCategories.map((subCat) => (
                    <option key={subCat._id} value={subCat._id}>
                      {subCat.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Attributes Manager */}
              <div className="mb-3">
                <AttributesManager 
                  attributes={formData.attributes} 
                  setAttributes={(attrs) => setFormData({...formData, attributes: attrs})} 
                />
              </div>
              
              <div className="mb-4 flex items-center">
                <input 
                  type="checkbox" 
                  name="bestseller" 
                  checked={formData.bestseller} 
                  onChange={handleInputChange} 
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                />
                <label className="text-sm font-medium">Bestseller</label>
              </div>
              <div className="flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Update Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <p className='mb-2 '>My Products</p>
      <div className='flex flex-col gap-2'>
        {/* List table title */}
        <div className='hidden md:grid grid-cols-[1fr_3fr_1fr_1fr_1fr] items-center text-sm px-1 py-2 border bg-gray-100'>
          <b>Image</b>
          <b>Name</b>
          <b>Category</b>
          <b>Price</b>
          <b className='text-center'>Action</b>
        </div>
        {/* -----------Product List------- */}

        {
          list.map((item,index)=>(
            <div key={index} className='grid grid-cols-[1fr_3fr_1fr_1fr_1fr] md:grid-cols-[1fr_3fr_1fr_1fr_1fr] gap-2 items-center text-sm px-2 py-1 border'>
            <img className='w-12' src={formatImageUrl(item.image?.[0])} alt={item.name}></img>
            <p>{item.name}</p>
            <p>
              {categoryMap[item.category]?.name || item.category}
              {item.subCategory && categoryMap[item.subCategory] && (
                <span className="text-xs text-gray-500 block">
                  {categoryMap[item.subCategory].name}
                </span>
              )}
            </p>
            <p className="font-semibold text-gray-800">{formatPrice(item.price)}</p>
            <div className="flex gap-2 justify-end md:justify-center">
              <span onClick={()=>openUpdateModal(item)} className='cursor-pointer text-blue-500 hover:text-blue-700 font-medium'>Edit</span>
              <span onClick={()=>removeProduct(item._id)} className='cursor-pointer text-red-500 hover:text-red-700 font-bold'>X</span>
            </div>
            </div>
          
          ))
        }
      </div>
    </>

  )
}

export default List