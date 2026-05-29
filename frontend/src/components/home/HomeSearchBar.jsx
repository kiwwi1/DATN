import React, { useState, useContext } from 'react'
import { ShopContext } from '../../context/ShopContext'
import { useNavigate } from 'react-router-dom'
import { formatPrice } from '../../utils/priceFormat'
import { formatImageUrl } from '../../utils/imageUtils'
import { matchesSearchTerm } from '../../utils/searchUtils'

const HomeSearchBar = () => {
    const { products } = useContext(ShopContext)
    const [searchTerm, setSearchTerm] = useState('')
    const [suggestions, setSuggestions] = useState([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const navigate = useNavigate()

    // Handle search input change
    const handleSearchChange = (e) => {
        const value = e.target.value
        setSearchTerm(value)

    if (value.trim().length > 0) {
            const filtered = products
              .filter(product => matchesSearchTerm(product, value))
              .slice(0, 8)

            setSuggestions(filtered)
            setShowSuggestions(true)
        } else {
            setSuggestions([])
            setShowSuggestions(false)
        }
    }

    // Handle search submit
    const handleSearch = (e) => {
        e.preventDefault()
        if (searchTerm.trim()) {
            navigate(`/collection?search=${encodeURIComponent(searchTerm)}`)
            setShowSuggestions(false)
        }
    }

    // Handle suggestion click
    const handleSuggestionClick = (product) => {
        navigate(`/product/${product._id}`)
        setSearchTerm('')
        setShowSuggestions(false)
    }

    // Handle click outside to close suggestions
    const handleBlur = () => {
        setTimeout(() => {
            setShowSuggestions(false)
        }, 200)
    }

    return (
        <div className='my-8 w-full max-w-4xl mx-auto px-4'>
            <div className='relative'>
                {/* Search Form */}
                <form onSubmit={handleSearch} className='relative'>
                    <div className='flex items-center bg-white border-2 border-gray-300 rounded-full overflow-hidden shadow-md hover:shadow-lg transition-shadow focus-within:border-blue-500'>
                        {/* Search Icon */}
                        <div className='pl-6 pr-3'>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-gray-400">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                            </svg>
                        </div>

                        {/* Search Input */}
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={handleSearchChange}
                            onBlur={handleBlur}
                            onFocus={() => searchTerm && setShowSuggestions(true)}
                            placeholder="Tìm kiếm sản phẩm, thương hiệu, shop..."
                            className='flex-1 py-4 outline-none text-base text-gray-700 placeholder-gray-400'
                        />

                        {/* Clear Button */}
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchTerm('')
                                    setSuggestions([])
                                    setShowSuggestions(false)
                                }}
                                className='px-3 text-gray-400 hover:text-gray-600'
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}

                        {/* Search Button */}
                        <button
                            type="submit"
                            className='bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 font-medium transition-colors'
                        >
                            Tìm kiếm
                        </button>
                    </div>
                </form>

                {/* Search Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                    <div className='absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50'>
                        <div className='p-2'>
                            <p className='text-xs text-gray-500 px-3 py-2 font-medium uppercase'>
                                Kết quả gợi ý ({suggestions.length})
                            </p>
                            {suggestions.map((product) => (
                                <div
                                    key={product._id}
                                    onClick={() => handleSuggestionClick(product)}
                                    className='flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors'
                                >
                                    {/* Product Image */}
                                    <div className='w-12 h-12 flex-shrink-0 bg-gray-100 rounded overflow-hidden'>
                                        <img
                                            src={formatImageUrl(product.image, { variant: "thumb", width: 96, height: 96, fit: "cover", quality: 76, format: "webp" })}
                                            referrerPolicy="no-referrer"
                                            alt={product.name}
                                            className='w-full h-full object-cover'
                                        />
                                    </div>

                                    {/* Product Info */}
                                    <div className='flex-1 min-w-0'>
                                        <p className='text-sm font-medium text-gray-800 truncate'>
                                            {product.name}
                                        </p>
                                        <div className='flex items-center gap-2 mt-1'>
                                            {product.brand && (
                                                <span className='text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded'>
                                                    {product.brand}
                                                </span>
                                            )}
                                            {product.vendorShopName && (
                                                <span className='text-xs text-gray-500'>
                                                    {product.vendorShopName}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Product Price */}
                                    <div className='text-right'>
                                        <p className='text-sm font-semibold text-orange-600'>
                                            {formatPrice(product.price)}
                                        </p>
                                        {product.discount > 0 && product.originalPrice && (
                                            <p className='text-xs text-gray-400 line-through'>
                                                {formatPrice(product.originalPrice)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* View All Results */}
                        <div className='border-t border-gray-200 p-3'>
                            <button
                                onClick={handleSearch}
                                className='w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium py-2'
                            >
                                Xem tất cả kết quả cho "{searchTerm}"
                            </button>
                        </div>
                    </div>
                )}

                {/* No Results */}
                {showSuggestions && searchTerm && suggestions.length === 0 && (
                    <div className='absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl p-6 z-50'>
                        <div className='text-center text-gray-500'>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto mb-3 text-gray-400">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                            </svg>
                            <p className='font-medium mb-1'>Không tìm thấy kết quả</p>
                            <p className='text-sm'>Thử tìm kiếm với từ khóa khác</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Popular Searches */}
            <div className='mt-4 flex items-center gap-2 flex-wrap'>
                <span className='text-sm text-gray-500'>Tìm kiếm phổ biến:</span>
                {['iPhone', 'Samsung', 'Áo thun', 'Giày thể thao', 'Tai nghe'].map((keyword) => (
                    <button
                        key={keyword}
                        onClick={() => {
                            setSearchTerm(keyword)
                            handleSearchChange({ target: { value: keyword } })
                        }}
                        className='text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors'
                    >
                        {keyword}
                    </button>
                ))}
            </div>
        </div>
    )
}

export default HomeSearchBar

