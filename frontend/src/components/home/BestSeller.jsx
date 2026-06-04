import React, { useContext, useMemo } from 'react'
import { ShopContext } from '../../context/ShopContext'
import ProductItem from '../product/ProductItem'
import Title from '../ui/Title'

const BEST_SELLER_LIMIT = 5
const RECOMMENDATION_SCORE_WEIGHT = 250

const toNumber = (value) => Number(value) || 0

const getRecommendationBoost = (item, recommendationScoreMap) => {
  if (!item?._id || !recommendationScoreMap) return 0
  return toNumber(recommendationScoreMap.get(String(item._id)))
}

const sortByBestSellerScore = (a, b, recommendationScoreMap) => {
  const aSoldScore = toNumber(a?.sold) + getRecommendationBoost(a, recommendationScoreMap)
  const bSoldScore = toNumber(b?.sold) + getRecommendationBoost(b, recommendationScoreMap)
  const soldDiff = bSoldScore - aSoldScore
  if (soldDiff !== 0) return soldDiff

  const ratingDiff = toNumber(b?.rating) - toNumber(a?.rating)
  if (ratingDiff !== 0) return ratingDiff

  return toNumber(b?.date) - toNumber(a?.date)
}

const BestSeller = () => {
  const { products, recommendations } = useContext(ShopContext)

  const bestSellerProducts = useMemo(() => {
    const activeProducts = (products || []).filter((item) => item?.isActive !== false)
    const recommendationScoreMap = new Map(
      (recommendations || []).map((item, index) => [
        String(item?._id),
        Math.max(0, recommendations.length - index) * RECOMMENDATION_SCORE_WEIGHT / Math.max(recommendations.length, 1),
      ])
    )

    const pinnedBestSellers = activeProducts
      .filter((item) => item?.bestseller)
      .sort((a, b) => sortByBestSellerScore(a, b, recommendationScoreMap))

    if (pinnedBestSellers.length >= BEST_SELLER_LIMIT) {
      return pinnedBestSellers.slice(0, BEST_SELLER_LIMIT)
    }

    const pinnedIds = new Set(pinnedBestSellers.map((item) => String(item._id)))
    const fallbackBySold = activeProducts
      .filter((item) => !pinnedIds.has(String(item._id)))
      .sort((a, b) => sortByBestSellerScore(a, b, recommendationScoreMap))

    return [...pinnedBestSellers, ...fallbackBySold].slice(0, BEST_SELLER_LIMIT)
  }, [products, recommendations])

  return (
    <div className='my-10'>
      <div className='text-center py-8 text-3xl'>
        <Title text1={'BÁN'} text2={' CHẠY'} />
        <p className='w-3/4 m-auto text-xs sm:text-sm md:text-base text-gray-600'>
          Những sản phẩm được yêu thích nhất dựa trên số lượng bán và đánh giá từ khách hàng.
        </p>
      </div>

      <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 gap-y-6'>
        {bestSellerProducts.map((item, index) => (
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
            highlight='bestseller'
            rank={index + 1}
          />
        ))}
      </div>
    </div>
  )
}

export default BestSeller
