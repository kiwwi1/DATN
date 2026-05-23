import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../../utils/priceFormat'
import { formatImageUrl } from '../../utils/imageUtils'
import { ShopContext } from '../../context/ShopContext'
import { localizeProductName } from '../../utils/productNameUtils'

const ProductItem = ({
  id,
  image,
  name,
  price,
  originalPrice,
  discount,
  rating,
  sold,
  highlight = 'default',
  rank,
}) => {
  const { trackInteraction, token } = useContext(ShopContext)
  const hasDiscount = discount > 0 && originalPrice && originalPrice > price
  const displayName = localizeProductName(name)
  const isBestSellerCard = highlight === 'bestseller'

  const handleClick = () => {
    if (token) trackInteraction(id, 'clicked')
  }

  const containerClass = isBestSellerCard
    ? 'block bg-gradient-to-b from-amber-50 to-white rounded-xl overflow-hidden border border-amber-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300'
    : 'block bg-white rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300 border border-gray-100'

  return (
    <Link to={`/product/${id}`} onClick={handleClick} className={containerClass}>
      <div className='relative overflow-hidden aspect-square'>
        <img
          className='w-full h-full object-cover hover:scale-110 transition-transform duration-300'
          src={formatImageUrl(image)}
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

        {(rating || sold) && (
          <div className='flex items-center gap-3 text-xs text-gray-500 mb-2'>
            {rating && (
              <div className='flex items-center gap-1'>
                <span className='text-yellow-500'>★</span>
                <span>{Number(rating).toFixed(1)}</span>
              </div>
            )}
            {sold > 0 && (
              <span>Đã bán {sold >= 1000 ? `${(sold / 1000).toFixed(1)}k` : sold}</span>
            )}
          </div>
        )}

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
