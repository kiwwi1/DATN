import React, { useEffect, useState } from 'react'
import { ShopContext } from '../../context/ShopContext';
import { useContext } from 'react'
import Title from '../ui/Title';
import ProductItem from '../product/ProductItem';

const LATEST_LIMIT = 5;

const ProductSkeleton = () => (
    <div className="animate-pulse">
        <div className="bg-gray-200 rounded-xl aspect-square w-full mb-3" />
        <div className="h-3 bg-gray-200 rounded w-4/5 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-2/5" />
    </div>
);

const LatestCollection = () => {
    const { products, productsLoading, navigate } = useContext(ShopContext);
    const [latestProducts, setLatestProducts] = useState([]);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setLatestProducts(products.slice(0, LATEST_LIMIT));
        setIsVisible(true);
    }, [products]);

    return (
        <div className='relative'>
            {/* Background decoration */}
            <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-white opacity-50"></div>
            
            <div className='relative'>
                <div className='text-center py-16'>
                    <div className={`transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                        <Title text1={'BỘ SƯU TẬP'} text2={' MỚI NHẤT'}/>
                        <p className='w-3/4 m-auto text-sm md:text-base text-gray-600 mt-4 leading-relaxed'>
                            Cập nhật những sản phẩm mới nhất theo xu hướng hiện đại, dễ phối đồ và phù hợp với nhiều phong cách.
                            Mỗi thiết kế đều được chọn lọc kỹ để mang đến trải nghiệm mua sắm tốt hơn cho bạn.
                        </p>
                    </div>
                </div>

                {/* Products Grid with staggered animation */}
                <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 px-4 sm:px-6 lg:px-8'>
                    {productsLoading
                        ? Array.from({ length: LATEST_LIMIT }).map((_, i) => <ProductSkeleton key={i} />)
                        : latestProducts.map((item, index) => (
                        <div 
                            key={index}
                            className={`transform transition-all duration-700 delay-${index * 100} ${
                                isVisible 
                                    ? 'translate-y-0 opacity-100' 
                                    : 'translate-y-10 opacity-0'
                            }`}
                        >
                            <ProductItem 
                                id={item._id} 
                                image={item.image} 
                                name={item.name} 
                                price={item.price}
                                originalPrice={item.originalPrice}
                                discount={item.discount}
                                rating={item.rating}
                                sold={item.sold}
                            />
                        </div>
                    ))}
                </div>

                {/* View All Button */}
                <div className={`text-center mt-12 transform transition-all duration-1000 delay-700 ${
                    isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                }`}>
                    <button onClick={() => navigate('/collection')} className='px-8 py-4 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition-all duration-300 transform hover:scale-105 shadow-lg'>
                        Xem Tất Cả Sản Phẩm
                    </button>
                </div>
            </div>
        </div>
    )
}

export default LatestCollection
