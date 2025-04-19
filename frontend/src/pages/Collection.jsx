import React, { use, useEffect, useState } from 'react'
import { useContext } from 'react';
import { ShopContext } from '../context/ShopContext';
import { assets } from '../assets/assets';
import Title from '../components/Title';
import ProductItem from '../components/ProductItem';

const Collection = () => {
  const {products} = useContext(ShopContext);
  const [showFilter, setShowFilter] = useState(false);
  const [filterProducts, setFilterProducts] = useState([]);
  const [category, setCategory] = useState([]);
  const [subCategory, setSubCategory] = useState([]);
  const [sortType, setSortType] = useState('relevant');


  const toggleCategory = (e) => {
    if(category.includes(e.target.value)){
      setCategory(prev=> prev.filter((item) => item !== e.target.value));
    }
    else{
      setCategory(prev=> [...prev, e.target.value]);
    }
  }
 
  const togglesubCategory = (e) => {
    if(subCategory.includes(e.target.value)){
      setSubCategory(prev=>prev.filter((item)=> item !== e.target.value))
    }
    else{
      setSubCategory(prev=> [...prev, e.target.value]);
    }
  }
  
  const applyFilter = () => {
    let productscopy = products.slice();
    if(category.length > 0){
      productscopy = productscopy.filter((item)=> category.includes(item.category));
    }

    if(subCategory.length > 0){
      productscopy = productscopy.filter((item)=> subCategory.includes(item.subCategory));
    }

    setFilterProducts(productscopy);
}

  const sortProducts = () => {
    let fpCopy = filterProducts.slice();
    switch(sortType){
      case 'lowToHigh':
        setFilterProducts(fpCopy.sort((a,b)=> a.price - b.price));
        break;
      case 'highToLow':
        setFilterProducts(fpCopy.sort((a,b)=> b.price - a.price));
        break;
      default:
        applyFilter();
        break;
    }
  }
  

  
  
  useEffect(() => {
    applyFilter();
  },[category,subCategory])

  useEffect(() => {
    sortProducts();
  },[sortType])
  
  return (
    <div className='flex flex-col sm:flex-row gap-1 sm:gap-10 pt-10 border-t'>
        {/* Filter side */}
        <div className='min-w-60'>
        <p className='my-2 text-xl flex items-center cursor-pointer gap-2'>FILTERS
            <img className={`h-3 sm:hidden ${showFilter ? 'rotate-90' : ''}`} src={assets.dropdown_icon}/>
        </p>
        {/* category filter */}
        <div className={`border border-gray-300 pl-5 py-3 mt-6 ${showFilter ? '' : 'hidden'} sm:block`}>
            <p className='mb-3 text-sm font-medium'>CATEGORIES</p>
            <div className='flex flex-col gap-2 text-sm font-light text-gray-600'>
              <p className='flex gap-2'>
                <input className='w-3' type="checkbox" value={'Men'} onChange={toggleCategory} />Men
              </p>
              <p className='flex gap-2'>
                <input className='w-3' type="checkbox" value={'Women'} onChange={toggleCategory}/>Women
              </p>
              <p className='flex gap-2'>
                <input className='w-3' type="checkbox" value={'Kids'} onChange={toggleCategory}/>Kid
              </p>

            </div>
        </div>
        {/* subCategory */}
        <div className={`border border-gray-300 pl-5 py-3 my-5 ${showFilter ? '' : 'hidden'} sm:block`}>
            <p className='mb-3 text-sm font-medium'>TYPE</p>
            <div className='flex flex-col gap-2 text-sm font-light text-gray-600'>
              <p className='flex gap-2'>
                <input className='w-3' type="checkbox" value={'Topwear'} onChange={togglesubCategory}/>Topwear
              </p>
              <p className='flex gap-2'>
                <input className='w-3' type="checkbox" value={'Bottomwear'} onChange={togglesubCategory}/>Bottomwear
              </p>
              <p className='flex gap-2'>
                <input className='w-3' type="checkbox" value={'Winterwear'} onChange={togglesubCategory}/>Winterwear
              </p>

            </div>
        </div>


        </div>
        {/* right side */}
        <div className='flex-1'>
          <div className='flex justify-between text-base mb-4'>

            <Title text1={'ALL'} text2={' COLLECTIONS'}/>
            {/* Sort product */}
            <select onChange={(e)=>setSortType(e.target.value)} className='border-2 border-gray-700 text-sm px-2'>
              <option value="relavent">Sort by: Relavent</option>
              <option value="lowToHigh">Sort by: Low to High</option>
              <option value="highToLow">Sort by: High to Low</option>
            </select>
          </div>
          {/* Map products */}
          <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 gap-y-6 '>
            {
              filterProducts.map((item,index) => (
                <ProductItem key={index} id={item._id} image={item.image} name={item.name} price={item.price}/>
              ))
            }

          </div>

        </div>

    </div>
  )
}

export default Collection