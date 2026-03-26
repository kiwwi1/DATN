import React, { useContext } from 'react'
import { ShopContext } from '../../context/ShopContext'
import Title from '../ui/Title'
import ProductItem from '../product/ProductItem'

const Recommendations = () => {
    const { recommendations, token } = useContext(ShopContext);

    if (!token || recommendations.length === 0) return null;

    return (
        <div className='my-16'>
            <div className='text-center mb-8'>
                <Title text1={'GỢI Ý'} text2={' CHO BẠN'} />
            </div>
            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 px-4 sm:px-6 lg:px-8'>
                {recommendations.map((item) => (
                    <ProductItem
                        key={item._id}
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

export default Recommendations
