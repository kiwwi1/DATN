import React, { useEffect } from 'react'
import { useContext } from 'react'
import { ShopContext } from '../../context/ShopContext'
import { useState } from 'react'
import ProductItem from '../product/ProductItem'
import Title from '../ui/Title'
import { Link } from 'react-router-dom'


const BestSeller = () => {
    const {products} = useContext(ShopContext);
    const [bestSeller,setBestSeller] = useState([]);
    useEffect(() => {
        setBestSeller(products.sort((a,b) => b.sold - a.sold).slice(0,5));
    },[products])
  return (
    <div className='my-10'>
      <div className='text-center py-8 text-3xl'>
        <Title text1={'BEST'} text2={' SELLER'}/>
        <p className='w-3/4 m-auto text-xs sm:text-sm md:text-base text-gray-600'>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque fringilla, nunc ac facilisis sodales, leo nisi suscipit ligula, nec facilisis justo felis id augue.
        </p>
      </div>
      {/* Render product */}
      <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 gap-y-6 '>
        {
          bestSeller.map((item,index) => (
            <ProductItem 
              key={index} 
              id={item._id} 
              image={item.image} 
              name={item.name} 
              price={item.price}
              originalPrice={item.originalPrice}
              discount={item.discount}
              rating={item.rating}
              sold={item.sold}
            />
          ))
        }
      </div>

    </div>
  )
}

export default BestSeller