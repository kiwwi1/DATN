import React, { useState } from 'react'
import {assets} from '../assets/assets.js'
import { backendUrl } from '../App.jsx'
import axios from 'axios'
import { toast } from 'react-toastify'

const Add = ({token}) => {
  const [image1,setImage1]=useState(false)
  const [image2,setImage2]=useState(false)
  const [image3,setImage3]=useState(false)
  const [image4,setImage4]=useState(false)
  const [name,setName]=useState('')
  const [description,setDescription]=useState('')
  const [category,setCategory]=useState('Men')
  const [subCategory,setSubCategory]=useState('Topwear')
  const [price,setPrice]=useState('')
  const [sizes,setSizes]=useState([])
  const [bestseller,setBestseller]=useState(false)

  const onSubmitHandler = async (e) => {
    e.preventDefault()
    try {
      // Validate required fields
      if (!name || !description || !price || sizes.length === 0) {
        toast.error('Please fill all required fields')
        return
      }

      // Validate at least one image
      if (!image1 && !image2 && !image3 && !image4) {
        toast.error('Please upload at least one image')
        return
      }

      const formData = new FormData()

      formData.append('name',name)
      formData.append('description',description)
      formData.append('price',price)
      formData.append('category',category)
      formData.append('subCategory',subCategory)
      formData.append('sizes',JSON.stringify(sizes))
      formData.append('bestseller',bestseller)

      if (image1) formData.append('image1',image1)
      if (image2) formData.append('image2',image2)
      if (image3) formData.append('image3',image3)
      if (image4) formData.append('image4',image4)

      const response = await axios.post(backendUrl+'/api/product/add', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'token': token
        }
      })

      // Check if we have a response
      if (!response || !response.data) {
        toast.error('No response from server')
        return
      }

      // Handle success
      if (response.data.success) {
        toast.success(response.data.message || 'Product added successfully!')
        // Reset form
        setName('')
        setDescription('')
        setCategory('Men')
        setSubCategory('Topwear')
        setPrice('')
        setSizes([])
        setBestseller(false)
        setImage1(false)
        setImage2(false)
        setImage3(false)
        setImage4(false)
      } else {
        // Handle server-side error
        toast.error(response.data.message || 'Failed to add product')
      }

    } catch (error) {
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })

      // Handle different types of errors
      if (error.response) {
        // Server responded with error
        toast.error(error.response.data?.message || 'Server error')
      } else if (error.request) {
        // Request was made but no response
        toast.error('No response from server. Please check your connection.')
      } else {
        // Something else went wrong
        toast.error('Error sending request: ' + error.message)
      }
    }
  }


  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <form onSubmit={onSubmitHandler} className='flex flex-col w-full items-start gap-6 max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-6'>
        <div>
          <p className='text-lg font-medium text-gray-800 mb-3'>Upload Image</p>

          <div className='flex gap-4 flex-wrap'>
            <label className='w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-all duration-200 flex items-center justify-center overflow-hidden' htmlFor='image1'>
              <img 
                src={image1 ? URL.createObjectURL(image1) : assets.upload_area} 
                alt='upload' 
                className={`${image1 ? 'w-full h-full object-cover' : 'w-12 h-12 hover:scale-110 transition-transform duration-200'}`}
              />
              <input 
                type='file' 
                id='image1' 
                hidden 
                accept="image/*"
                onChange={(e) => setImage1(e.target.files[0])}
              />
            </label>
            <label className='w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-all duration-200 flex items-center justify-center overflow-hidden' htmlFor='image2'>
              <img 
                src={image2 ? URL.createObjectURL(image2) : assets.upload_area} 
                alt='upload' 
                className={`${image2 ? 'w-full h-full object-cover' : 'w-12 h-12 hover:scale-110 transition-transform duration-200'}`}
              />
              <input 
                type='file' 
                id='image2' 
                hidden 
                accept="image/*"
                onChange={(e) => setImage2(e.target.files[0])}
              />
            </label>
            <label className='w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-all duration-200 flex items-center justify-center overflow-hidden' htmlFor='image3'>
              <img 
                src={image3 ? URL.createObjectURL(image3) : assets.upload_area} 
                alt='upload' 
                className={`${image3 ? 'w-full h-full object-cover' : 'w-12 h-12 hover:scale-110 transition-transform duration-200'}`}
              />
              <input 
                type='file' 
                id='image3' 
                hidden 
                accept="image/*"
                onChange={(e) => setImage3(e.target.files[0])}
              />
            </label>
            <label className='w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-all duration-200 flex items-center justify-center overflow-hidden' htmlFor='image4'>
              <img 
                src={image4 ? URL.createObjectURL(image4) : assets.upload_area} 
                alt='upload' 
                className={`${image4 ? 'w-full h-full object-cover' : 'w-12 h-12 hover:scale-110 transition-transform duration-200'}`}
              />
              <input 
                type='file' 
                id='image4' 
                hidden 
                accept="image/*"
                onChange={(e) => setImage4(e.target.files[0])}
              />
            </label>
          </div>
        </div>

        <div className='w-full'>
          <p className='text-sm font-medium text-gray-700 mb-2'>Product Name</p>
          <input
            onChange={(e)=>setName(e.target.value)}
            value={name}
            className='w-full border-2 border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200' 
            type='text' 
            placeholder='Type product name here' 
            required 
          />
        </div>

        <div className='w-full'>
          <p className='text-sm font-medium text-gray-700 mb-2'>Product Description</p>
          <textarea 
            onChange={(e)=>setDescription(e.target.value)}
            value={description}
            className='w-full border-2 border-gray-300 rounded-lg p-2.5 h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200' 
            placeholder='Write detailed product description' 
            required 
          />
        </div>

        <div className='w-full'>
          <div>
            <p className='text-sm font-medium text-gray-700 mb-2'>Product Category</p>
            <select onChange={(e)=>setCategory(e.target.value)} className='w-full border-2 border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200'>
              <option value='Men'>Men</option>
              <option value='Women'>Women</option>
              <option value='Kids'>Kids</option>
            </select>
          </div>
        </div>

        <div className='w-full'>
          <div>
            <p className='text-sm font-medium text-gray-700 mb-2'>Product SubCategory</p>
            <select onChange={(e)=>setSubCategory(e.target.value)}  className='w-full border-2 border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200'>
              <option value='Topwear'>Topwear</option>
              <option value='Bottomwear'>Bottomwear</option>
              <option value='Winterwear'>Winterwear</option>
            </select>
          </div>
        </div>

        <div>
          <p className='text-sm font-medium text-gray-700 mb-2'>Product Price</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input 
              onChange={(e)=>setPrice(e.target.value)}
              value={price}
              type='number' 
              className='w-full border-2 border-gray-300 rounded-lg p-2.5 pl-8 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200' 
              placeholder='0.00' 
              min="0"
              step="0.01"
              required 
            />
          </div>
        </div>

        <div>
          <p className='text-sm font-medium text-gray-700 mb-3'>Product Sizes</p>
          <div className='flex gap-3 flex-wrap'>
            <div onClick={()=>setSizes(prev => prev.includes('S') ? prev.filter( item => item !== 'S') :[...prev,'S'])} className={`px-4 py-2 rounded-lg border-2 border-gray-300 hover:border-blue-500 cursor-pointer transition-all duration-200 ${sizes.includes('S') ? 'bg-blue-500 text-white' : ''}`}>
              <p>S</p>
            </div>
            <div onClick={()=>setSizes(prev => prev.includes('M') ? prev.filter( item => item !== 'M') :[...prev,'M'])} className={`px-4 py-2 rounded-lg border-2 border-gray-300 hover:border-blue-500 cursor-pointer transition-all duration-200 ${sizes.includes('M') ? 'bg-blue-500 text-white' : ''}`}>
              <p>M</p>
            </div>
            <div onClick={()=>setSizes(prev => prev.includes('L') ? prev.filter( item => item !== 'L') :[...prev,'L'])} className={`px-4 py-2 rounded-lg border-2 border-gray-300 hover:border-blue-500 cursor-pointer transition-all duration-200 ${sizes.includes('L') ? 'bg-blue-500 text-white' : ''}`}>
              <p>L</p>
            </div>
            <div onClick={()=>setSizes(prev => prev.includes('XL') ? prev.filter( item => item !== 'XL') :[...prev,'XL'])} className={`px-4 py-2 rounded-lg border-2 border-gray-300 hover:border-blue-500 cursor-pointer transition-all duration-200 ${sizes.includes('XL') ? 'bg-blue-500 text-white' : ''}`}>
              <p>XL</p>
            </div>
            <div onClick={()=>setSizes(prev => prev.includes('XXL') ? prev.filter( item => item !== 'XXL') :[...prev,'XXL'])} className={`px-4 py-2 rounded-lg border-2 border-gray-300 hover:border-blue-500 cursor-pointer transition-all duration-200 ${sizes.includes('XXL') ? 'bg-blue-500 text-white' : ''}`}>
              <p>XXL</p>
            </div>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <input 
            onChange={()=>setBestseller(prev => !prev)}
            checked={bestseller}
            type='checkbox' 
            id='bestseller'
            className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
          />
          <label 
            htmlFor='bestseller'
            className='text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900'
          >
            Add to BestSeller
          </label>
        </div>

        <button 
          type='submit'
          className='w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200'
        >
          Add Product
        </button>

      </form>
    </div>
  )
}

export default Add