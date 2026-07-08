import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../../utils/priceFormat'
import { formatImageUrl } from '../../utils/imageUtils'
import { ShopContext } from '../../context/ShopContext'
import { localizeProductName } from '../../utils/productNameUtils'
import { getProductSocialProof } from '../../utils/productSocialProof'

const ProductItem = ({
  id,
  image,
  name,
  price,
  originalPrice,
  discount,
  rating,
  reviewCount,
  sold,
  vendorShopName,
  highlight = 'default',
  rank,
}) => {
  const { trackInteraction, token } = useContext(ShopContext)
  const hasDiscount = discount > 0 && originalPrice && originalPrice > price
  const displayName = localizeProductName(name)
  const isBestSellerCard = highlight === 'bestseller'
  const socialProof = getProductSocialProof({ rating, reviewCount, sold })
  const shopLabel = String(vendorShopName || '').trim()

  const handleClick = () => {
    if (token) trackInteraction(id, 'clicked')
  }

  const containerClass = isBestSellerCard
    ? 'block bg-gradient-to-b from-amber-50 to-white rounded-xl overflow-hidden border border-amber-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300'
    : 'block bg-white rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300 border border-gray-100'

  const shopClass = isBestSellerCard
    ? 'border-amber-200 bg-amber-100/90 text-amber-900'
    : 'border-orange-100 bg-gradient-to-r from-orange-50 to-rose-50 text-orange-700 shadow-sm'

  return (
    <Link to={`/product/${id}`} onClick={handleClick} className={containerClass}>
      <div className='relative overflow-hidden aspect-square'>
        <img
          className='w-full h-full object-cover hover:scale-105 transition-transform duration-300'
          src={formatImageUrl(image, { variant: 'thumb', width: 420, height: 420, fit: 'cover', quality: 80, format: 'webp' })}
          alt={displayName}
          referrerPolicy='no-referrer'
        />

        {isBestSellerCard && (
          <div className='absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-amber-900/30 to-transparent pointer-events-none' />
        )}

        {hasDiscount && (
          <div className='absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded'>
            -{discount}%
          </div>
        )}

        {isBestSellerCard && (
          <div className='absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow'>
            TOP {rank || ''}
          </div>
        )}
      </div>

      <div className='p-3'>
        <p className='text-sm text-gray-800 line-clamp-2 h-10 mb-2'>
          {displayName}
        </p>

        {shopLabel && (
          <div className={`mb-3 inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${shopClass}`}>
            <svg className='h-3.5 w-3.5 shrink-0' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path strokeLinecap='round' strokeLinejoin='round' d='M3 9.5 4.5 4h15L21 9.5M5 10h14v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8Zm4 4h6' />
            </svg>
            <span className='truncate'>{shopLabel}</span>
          </div>
        )}

        <div className='flex flex-wrap items-center gap-2 mb-3 min-h-[24px] text-xs'>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${
              socialProof.hasReviews
                ? isBestSellerCard
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-amber-50 text-amber-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <span className={socialProof.hasReviews ? 'text-yellow-500' : 'text-slate-400'}>&#9733;</span>
            <span>{socialProof.hasReviews ? socialProof.ratingText : socialProof.reviewCountText}</span>
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 ${
              socialProof.hasSales
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {socialProof.hasSales ? socialProof.soldText : socialProof.summaryText}
          </span>
        </div>

        <div className='flex items-baseline gap-2'>
          <p className={`text-lg font-semibold ${isBestSellerCard ? 'text-amber-700' : 'text-orange-600'}`}>
            {formatPrice(price)}
          </p>
          {hasDiscount && (
            <p className='text-sm text-gray-400 line-through'>
              {formatPrice(originalPrice)}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

export default ProductItem
