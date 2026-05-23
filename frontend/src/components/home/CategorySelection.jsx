import React, { useContext, useEffect, useState } from 'react'
import { ShopContext } from '../../context/ShopContext'
import { useNavigate } from 'react-router-dom'
import Title from '../ui/Title'

// Bảng màu gradient xoay vòng cho từng category
const ICON_COLORS = [
    { bg: 'bg-orange-100',   text: 'text-orange-500'  },
    { bg: 'bg-pink-100',     text: 'text-pink-500'    },
    { bg: 'bg-blue-100',     text: 'text-blue-500'    },
    { bg: 'bg-green-100',    text: 'text-green-500'   },
    { bg: 'bg-purple-100',   text: 'text-purple-500'  },
    { bg: 'bg-yellow-100',   text: 'text-yellow-500'  },
    { bg: 'bg-red-100',      text: 'text-red-500'     },
    { bg: 'bg-teal-100',     text: 'text-teal-500'    },
    { bg: 'bg-indigo-100',   text: 'text-indigo-500'  },
    { bg: 'bg-rose-100',     text: 'text-rose-500'    },
];

// SVG minh hoạ mặc định khi category không có icon/image
const DefaultCategoryIllustration = ({ colorClass }) => (
    <svg viewBox="0 0 48 48" fill="none" className={`w-7 h-7 ${colorClass}`} xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="6" width="15" height="15" rx="3" fill="currentColor" opacity="0.8"/>
        <rect x="27" y="6" width="15" height="15" rx="3" fill="currentColor" opacity="0.5"/>
        <rect x="6" y="27" width="15" height="15" rx="3" fill="currentColor" opacity="0.5"/>
        <rect x="27" y="27" width="15" height="15" rx="3" fill="currentColor" opacity="0.8"/>
    </svg>
);

const CategorySelection = () => {
    const { homepageCategories, getAllCategories, products } = useContext(ShopContext)
    const navigate = useNavigate()
    const [currentPage, setCurrentPage] = useState(0)
    const categoriesPerPage = 20

    useEffect(() => {
        getAllCategories()
    }, [getAllCategories])

    const handleCategoryClick = (categoryId) => {
        navigate(`/collection?category=${categoryId}`)
    }

    const level1Categories = homepageCategories?.categories?.filter(c => c.level === 1) || []
    const totalPages = Math.ceil(level1Categories.length / categoriesPerPage)
    const currentCategories = level1Categories.slice(
        currentPage * categoriesPerPage,
        (currentPage + 1) * categoriesPerPage
    )

    return (
        <div className="my-6 bg-white py-5 -mx-4 sm:-mx-[5vw] md:-mx-[7vw] lg:-mx-[9vw] px-4 sm:px-[5vw] md:px-[7vw] lg:px-[9vw]">
            {/* Title */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-800">
                    <Title text1={'DANH MỤC'} text2={' SẢN PHẨM'}/>   
                </h2>
                {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(p - 1, 0))}
                            disabled={currentPage === 0}
                            className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:border-orange-400 hover:text-orange-500 disabled:opacity-30 transition-colors"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                        </button>
                        <span className="text-xs text-gray-400">{currentPage + 1}/{totalPages}</span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages - 1))}
                            disabled={currentPage === totalPages - 1}
                            className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:border-orange-400 hover:text-orange-500 disabled:opacity-30 transition-colors"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            {/* Categories Grid */}
            {level1Categories.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Không có danh mục nào</p>
            ) : (
                <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-8 lg:grid-cols-10 gap-1">
                    {currentCategories.map((category, index) => {
                        const color = ICON_COLORS[index % ICON_COLORS.length];
                        return (
                            <button
                                key={category._id}
                                onClick={() => handleCategoryClick(category._id)}
                                className="flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-lg hover:bg-orange-50 transition-colors group"
                            >
                                {/* Icon container */}
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color.bg} group-hover:scale-105 transition-transform`}>
                                    {category.image ? (
                                        <img
                                            src={category.image}
                                            alt={category.name}
                                            className="w-8 h-8 object-contain"
                                        />
                                    ) : category.icon ? (
                                        <span className="text-2xl leading-none">{category.icon}</span>
                                    ) : (
                                        <DefaultCategoryIllustration colorClass={color.text} />
                                    )}
                                </div>
                                {/* Name */}
                                <span className="text-[11px] text-center text-gray-600 group-hover:text-orange-500 leading-tight line-clamp-2 w-full transition-colors">
                                    {category.name}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    )
}

export default CategorySelection
