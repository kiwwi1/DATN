import React, { use } from 'react'
import { useContext, useEffect, useState } from 'react';
import { ShopContext } from '../../context/ShopContext';
import Product from '../../pages/main/Product';
import { assets } from '../../assets/assets';
import Title from '../ui/Title';
import ProductItem from './ProductItem';

const RelatedProducts = ({category,subCategory}) => {
    const {products} = useContext(ShopContext);
    const [related, setRelated] = useState([]);
    useEffect(() => {
        if(products.length > 0){
            let productsCopy = products.slice();
            productsCopy = productsCopy.filter((item) => item.category === category );
            productsCopy = productsCopy.filter((item) => item.subCategory === subCategory );
            setRelated(productsCopy.slice(1, 6));
        }
    }, [category, subCategory, products]);
    return (
    <div className='my-24'>
        <div className='text-center text-3xl py-2 '>
            <Title text1={'Related '} text2={'Products'} />

        </div>
        <div className='grid grid-col sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 gap-y-6'>
            {related.map((item, index) => (
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
            ))}

        </div>

    </div>
  )
}

export default RelatedProducts