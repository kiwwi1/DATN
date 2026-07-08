import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import { ShopContext } from '../../context/ShopContext'
import Title from '../ui/Title'
import ProductItem from '../product/ProductItem'

const PREVIEW_LIMIT = 10

const Recommendations = () => {
    const { recommendations, token } = useContext(ShopContext)

    if (!token || recommendations.length === 0) return null

    const previewItems = recommendations.slice(0, PREVIEW_LIMIT)

    return (
        <div className='my-16'>
            <div className='text-center mb-8'>
                <Title text1={'Gợi Ý'} text2={' Cho Bạn'} />
            </div>

            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 px-4 sm:px-6 lg:px-8'>
                {previewItems.map((item) => (
                    <ProductItem
                        key={item._id}
                        id={item._id}
                        image={item.image}
                        name={item.name}
                        price={item.price}
                        originalPrice={item.originalPrice}
                        discount={item.discount}
                        rating={item.rating}
                        reviewCount={item.reviewCount}
                        sold={item.sold}
                        vendorShopName={item.vendorShopName}
                    />
                ))}
            </div>

            {recommendations.length > PREVIEW_LIMIT && (
                <div className='mt-8 text-center'>
                    <Link
                        to='/recommendations'
                        className='inline-flex items-center justify-center rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50'
                    >
                        Xem thêm gợi ý
                    </Link>
                </div>
            )}
        </div>
    )
}

export default Recommendations



