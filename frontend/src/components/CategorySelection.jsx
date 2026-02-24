import React, { useContext, useEffect, useState } from 'react'
import { ShopContext } from '../context/ShopContext'
import { useNavigate } from 'react-router-dom'

const CategorySelection = () => {
    const {homepageCategories, getAllCategories, products} = useContext(ShopContext)
    const navigate = useNavigate()
    const [currentPage, setCurrentPage] = useState(0)
    const categoriesPerPage = 12
    
    useEffect(() => {
        getAllCategories()
    }, [getAllCategories])

    const handleCategoryClick = (categoryId) => {
        navigate(`/collection?category=${categoryId}`)
    }

    // Filter level 1 categories
    const level1Categories = homepageCategories?.categories?.filter(category => category.level === 1) || []
    
    // Calculate pagination
    const totalPages = Math.ceil(level1Categories.length / categoriesPerPage)
    const startIndex = currentPage * categoriesPerPage
    const endIndex = startIndex + categoriesPerPage
    const currentCategories = level1Categories.slice(startIndex, endIndex)

    const goToNextPage = () => {
        if (currentPage < totalPages - 1) {
            setCurrentPage(currentPage + 1)
        }
    }

    const goToPrevPage = () => {
        if (currentPage > 0) {
            setCurrentPage(currentPage - 1)
        }
    }

    return (
        <div className="my-10 bg-gradient-to-b from-gray-50 to-white py-12 -mx-4 sm:-mx-[5vw] md:-mx-[7vw] lg:-mx-[9vw] px-4 sm:px-[5vw] md:px-[7vw] lg:px-[9vw]">
            {/* Title */}
            <div className="text-center py-8">
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-3">
                    <span className="text-gray-600">Danh Mục</span>
                    <span className="text-orange-600"> Sản Phẩm</span>
                </h2>
                <p className="max-w-2xl mx-auto text-sm sm:text-base text-gray-600 mb-2">
                    Khám phá các danh mục sản phẩm đa dạng của chúng tôi
                </p>
                {level1Categories.length > 0 && (
                    <p className="text-sm text-gray-500">
                        {level1Categories.length} danh mục • {products.length} sản phẩm
                    </p>
                )}
            </div>

            {/* Categories Grid with Navigation */}
            <div className="relative">
                {/* Previous Arrow */}
                {currentPage > 0 && (
                    <button 
                        onClick={goToPrevPage}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 sm:-translate-x-4 z-10 bg-orange-600 hover:bg-orange-700 text-white rounded-full p-2 sm:p-3 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-300"
                        aria-label="Trang trước"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                    </button>
                )}

                {/* Categories Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 gap-y-6">
                    {currentCategories.map((category, index) => {
                        // Count products in this category (including subcategories)
                        const productCount = products.filter(product => 
                            product.category === category._id || 
                            product.subCategory === category._id ||
                            product.subSubCategory === category._id
                        ).length;

                        return (
                            <div 
                                key={index} 
                                onClick={() => handleCategoryClick(category._id)}
                                className="relative flex flex-col items-center justify-center p-4 border-2 border-gray-200 rounded-xl hover:border-orange-400 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer bg-white group overflow-hidden"
                            >
                                {/* Product Count Badge */}
                                {productCount > 0 && (
                                    <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                        {productCount}
                                    </div>
                                )}

                                {/* Category Icon/Image */}
                                <div className="w-20 h-20 mb-3 flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-orange-50 to-blue-50 group-hover:from-orange-100 group-hover:to-blue-100 transition-all duration-300 shadow-sm">
                                    {category.image ? (
                                        <img 
                                            src={category.image} 
                                            alt={category.name}
                                            className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
                                        />
                                    ) : category.icon ? (
                                        <span className="text-5xl group-hover:scale-110 transition-transform duration-300 filter drop-shadow-lg">
                                            {category.icon}
                                        </span>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-500">
                                            {category.name?.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Category Name */}
                                <p className="text-sm text-center font-semibold text-gray-700 group-hover:text-orange-600 transition-colors line-clamp-2 px-1">
                                    {category.name}
                                </p>

                                {/* Product Count Text */}
                                {productCount > 0 && (
                                    <p className="text-xs text-gray-500 mt-1 group-hover:text-orange-500 transition-colors">
                                        {productCount} sản phẩm
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Next Arrow */}
                {currentPage < totalPages - 1 && (
                    <button 
                        onClick={goToNextPage}
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 sm:translate-x-4 z-10 bg-orange-600 hover:bg-orange-700 text-white rounded-full p-2 sm:p-3 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-300"
                        aria-label="Trang sau"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Pagination Indicator */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8">
                    {Array.from({ length: totalPages }).map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentPage(index)}
                            className={`h-2 rounded-full transition-all duration-300 ${
                                currentPage === index 
                                    ? 'bg-orange-600 w-8 shadow-lg' 
                                    : 'bg-gray-300 w-2 hover:bg-orange-300 hover:w-4'
                            }`}
                            aria-label={`Trang ${index + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* Show message if no categories */}
            {level1Categories.length === 0 && (
                <div className="text-center py-10">
                    <p className="text-gray-500">Không có danh mục nào</p>
                </div>
            )}
        </div>
    )
}

export default CategorySelection