import React, { useContext, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ProductItem from '../../components/product/ProductItem'
import Title from '../../components/ui/Title'
import { ShopContext } from '../../context/ShopContext'

const PAGE_SIZE = 20
const MAX_PAGE_BUTTONS = 7

const RecommendationsPage = () => {
    const { recommendations, token } = useContext(ShopContext)
    const [searchParams, setSearchParams] = useSearchParams()

    const totalPages = Math.max(1, Math.ceil(recommendations.length / PAGE_SIZE))

    const currentPage = useMemo(() => {
        const rawPage = Number.parseInt(searchParams.get('page') || '1', 10)
        if (!Number.isFinite(rawPage) || rawPage < 1) return 1
        if (rawPage > totalPages) return totalPages
        return rawPage
    }, [searchParams, totalPages])

    const startIndex = (currentPage - 1) * PAGE_SIZE
    const pageItems = recommendations.slice(startIndex, startIndex + PAGE_SIZE)

    const goToPage = (page) => {
        const nextPage = Math.min(Math.max(1, page), totalPages)
        setSearchParams(nextPage > 1 ? { page: String(nextPage) } : {})
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const pageNumbers = useMemo(() => {
        if (totalPages <= MAX_PAGE_BUTTONS) {
            return Array.from({ length: totalPages }, (_, index) => index + 1)
        }

        const half = Math.floor(MAX_PAGE_BUTTONS / 2)
        let start = Math.max(1, currentPage - half)
        let end = Math.min(totalPages, start + MAX_PAGE_BUTTONS - 1)

        if (end - start + 1 < MAX_PAGE_BUTTONS) {
            start = Math.max(1, end - MAX_PAGE_BUTTONS + 1)
        }

        return Array.from({ length: end - start + 1 }, (_, index) => start + index)
    }, [currentPage, totalPages])

    if (!token) {
        return (
            <div className='my-12 rounded-xl border border-gray-200 bg-white px-6 py-10 text-center'>
                <p className='text-lg font-medium text-gray-800'>Đăng nhập để xem gợi ý dành riêng cho bạn</p>
                <Link to='/login' className='mt-4 inline-flex rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black'>
                    Đăng nhập
                </Link>
            </div>
        )
    }

    return (
        <div className='my-10'>
            <div className='mb-8 text-center'>
                <Title text1='Gợi Ý' text2=' Cho Bạn' />
                <p className='text-sm text-gray-500'>Tổng cộng {recommendations.length} sản phẩm gợi ý</p>
            </div>

            {recommendations.length === 0 ? (
                <div className='rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-gray-500'>
                    Chưa có dữ liệu gợi ý cho bạn lúc này.
                </div>
            ) : (
                <>
                    <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6'>
                        {pageItems.map((item) => (
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

                    <div className='mt-8 flex items-center justify-center gap-3'>
                        <button
                            type='button'
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage === 1}
                            className='rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                            Trước
                        </button>

                        <div className='flex items-center gap-2'>
                            {pageNumbers[0] > 1 && (
                                <>
                                    <button
                                        type='button'
                                        onClick={() => goToPage(1)}
                                        className='h-9 min-w-9 rounded-md border border-gray-300 px-3 text-sm text-gray-700'
                                    >
                                        1
                                    </button>
                                    {pageNumbers[0] > 2 && <span className='text-gray-400'>...</span>}
                                </>
                            )}

                            {pageNumbers.map((page) => (
                                <button
                                    key={page}
                                    type='button'
                                    onClick={() => goToPage(page)}
                                    className={`h-9 min-w-9 rounded-md border px-3 text-sm ${
                                        currentPage === page
                                            ? 'border-gray-900 bg-gray-900 text-white'
                                            : 'border-gray-300 text-gray-700'
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}

                            {pageNumbers[pageNumbers.length - 1] < totalPages && (
                                <>
                                    {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <span className='text-gray-400'>...</span>}
                                    <button
                                        type='button'
                                        onClick={() => goToPage(totalPages)}
                                        className='h-9 min-w-9 rounded-md border border-gray-300 px-3 text-sm text-gray-700'
                                    >
                                        {totalPages}
                                    </button>
                                </>
                            )}
                        </div>

                        <button
                            type='button'
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className='rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                            Tiếp
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}

export default RecommendationsPage



