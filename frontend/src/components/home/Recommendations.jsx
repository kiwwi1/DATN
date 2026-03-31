import React, { useContext, useEffect, useState } from 'react'
import { ShopContext } from '../../context/ShopContext'
import Title from '../ui/Title'
import ProductItem from '../product/ProductItem'

const Recommendations = () => {
    const { recommendations, token } = useContext(ShopContext);
    const INITIAL_VISIBLE = 10;
    const STEP = 10;
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

    useEffect(() => {
        setVisibleCount(INITIAL_VISIBLE);
    }, [recommendations.length]);

    if (!token || recommendations.length === 0) return null;

    const visibleItems = recommendations.slice(0, visibleCount);
    const hasMore = visibleCount < recommendations.length;

    return (
        <div className='my-16'>
            <div className='text-center mb-8'>
                <Title text1={'GỢI Ý'} text2={' CHO BẠN'} />
            </div>
            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 px-4 sm:px-6 lg:px-8'>
                {visibleItems.map((item) => (
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
            {recommendations.length > INITIAL_VISIBLE && (
                <div className='text-center mt-8'>
                    {hasMore ? (
                        <button
                            type='button'
                            onClick={() => setVisibleCount((prev) => prev + STEP)}
                            className='border border-gray-300 px-6 py-2 text-sm hover:bg-gray-50 transition-colors'
                        >
                            Hiển thị thêm
                        </button>
                    ) : (
                        <button
                            type='button'
                            onClick={() => setVisibleCount(INITIAL_VISIBLE)}
                            className='border border-gray-300 px-6 py-2 text-sm hover:bg-gray-50 transition-colors'
                        >
                            Thu gọn
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

export default Recommendations
