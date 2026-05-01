import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../../utils/priceFormat'
import { formatImageUrl } from '../../utils/imageUtils'
import { ShopContext } from '../../context/ShopContext'
import { localizeProductName } from '../../utils/productNameUtils'

const ProductItem = ({ id, image, name, price, originalPrice, discount, rating, sold }) => {
  const { trackInteraction, token } = useContext(ShopContext);
  const hasDiscount = discount > 0 && originalPrice && originalPrice > price
  const displayName = localizeProductName(name)

  const handleClick = () => {
    if (token) trackInteraction(id, 'clicked');
  };

  return (
    <Link to={`/product/${id}`} onClick={handleClick} className='block bg-white rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300 border border-gray-100'>
      {/* Product Image */}
      <div className='relative overflow-hidden aspect-square'>
        <img 
          className='w-full h-full object-cover hover:scale-110 transition-transform duration-300' 
          src={formatImageUrl(image)} 
          alt={displayName}
          referrerPolicy="no-referrer"
        />
        
        {/* Discount Badge */}
        {hasDiscount && (
          <div className='absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded'>
            -{discount}%
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className='p-3'>
        {/* Product Name */}
        <p className='text-sm text-gray-800 line-clamp-2 h-10 mb-2'>
          {displayName}
        </p>

        {/* Rating and Sold */}
        {(rating || sold) && (
          <div className='flex items-center gap-3 text-xs text-gray-500 mb-2'>
            {rating && (
              <div className='flex items-center gap-1'>
                <span className='text-yellow-500'>★</span>
                <span>{Number(rating).toFixed(1)}</span>
              </div>
            )}
            {sold > 0 && (
              <span>Đã bán {sold >= 1000 ? `${(sold/1000).toFixed(1)}k` : sold}</span>
            )}
          </div>
        )}

        {/* Price */}
        <div className='flex items-baseline gap-2'>
          <p className='text-lg font-semibold text-orange-600'>
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