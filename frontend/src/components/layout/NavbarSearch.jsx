import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShopContext } from '../../context/ShopContext'
import { formatPrice } from '../../utils/priceFormat'
import { formatImageUrl } from '../../utils/imageUtils'
import { normalizeSearchText } from '../../utils/searchUtils'

const MAX_HISTORY_ITEMS = 8
const SEARCH_HISTORY_PREFIX = 'datn_search_history'

const NavbarSearch = () => {
  const { products, userId } = useContext(ShopContext)
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchHistory, setSearchHistory] = useState([])

  const searchHistoryKey = useMemo(
    () => `${SEARCH_HISTORY_PREFIX}:${userId || 'guest'}`,
    [userId]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(searchHistoryKey)
      if (!raw) {
        setSearchHistory([])
        return
      }
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setSearchHistory(parsed.filter((item) => typeof item === 'string'))
      } else {
        setSearchHistory([])
      }
    } catch {
      setSearchHistory([])
    }
  }, [searchHistoryKey])

  const updateSearchHistory = (keyword) => {
    const value = String(keyword || '').trim()
    if (!value) return

    setSearchHistory((prev) => {
      const normalizedValue = normalizeSearchText(value)
      const next = [
        value,
        ...prev.filter((item) => normalizeSearchText(item) !== normalizedValue),
      ].slice(0, MAX_HISTORY_ITEMS)

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(searchHistoryKey, JSON.stringify(next))
        } catch {
          // ignore storage errors
        }
      }
      return next
    })
  }

  const clearSearchHistory = () => {
    setSearchHistory([])
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(searchHistoryKey)
      } catch {
        // ignore storage errors
      }
    }
  }

  const suggestions = useMemo(() => {
    const keyword = normalizeSearchText(searchTerm)
    if (!keyword) return []

    return (products || [])
      .filter((product) => {
        const nameMatch = normalizeSearchText(product.name).includes(keyword)
        const brandMatch = normalizeSearchText(product.brand).includes(keyword)
        const shopMatch = normalizeSearchText(product.vendorShopName).includes(keyword)
        return nameMatch || brandMatch || shopMatch
      })
      .slice(0, 6)
  }, [products, searchTerm])

  const navigateToSearchResults = (keyword = searchTerm) => {
    const normalizedKeyword = String(keyword || '').trim()
    if (!normalizedKeyword) return
    updateSearchHistory(normalizedKeyword)
    navigate(`/collection?search=${encodeURIComponent(normalizedKeyword)}`)
    setShowSuggestions(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    navigateToSearchResults()
  }

  const handleSuggestionClick = (productId) => {
    navigate(`/product/${productId}`)
    setSearchTerm('')
    setShowSuggestions(false)
  }

  const handleBlur = () => {
    setTimeout(() => setShowSuggestions(false), 150)
  }

  return (
    <div className='relative w-full'>
      <form onSubmit={handleSubmit} className='w-full'>
        <div className='flex items-center bg-white rounded-sm overflow-hidden border border-orange-200'>
          <input
            type='text'
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={handleBlur}
            placeholder='Uu dai den 40%'
            className='w-full px-4 py-2.5 text-sm text-gray-700 outline-none'
          />
          <button
            type='submit'
            className='h-full px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white transition-colors'
            aria-label='Search'
          >
            <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={2} stroke='currentColor' className='w-5 h-5'>
              <path strokeLinecap='round' strokeLinejoin='round' d='M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z' />
            </svg>
          </button>
        </div>
      </form>

      {showSuggestions && searchTerm.trim() && (
        <div className='absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-xl max-h-96 overflow-y-auto z-50'>
          {suggestions.length > 0 ? (
            <div className='p-2'>
              {suggestions.map((product) => (
                <button
                  key={product._id}
                  type='button'
                  onMouseDown={() => handleSuggestionClick(product._id)}
                  className='w-full text-left flex items-center gap-3 p-2 hover:bg-gray-50 rounded'
                >
                  <img
                    src={formatImageUrl(product.image)}
                    referrerPolicy='no-referrer'
                    alt={product.name}
                    className='w-10 h-10 object-cover rounded'
                  />
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm text-gray-800 truncate'>{product.name}</p>
                    <p className='text-xs text-orange-600 font-medium'>{formatPrice(product.price)}</p>
                  </div>
                </button>
              ))}
              <button
                type='button'
                onMouseDown={() => navigateToSearchResults()}
                className='w-full mt-1 py-2 text-sm text-orange-600 hover:text-orange-700'
              >
                Xem tat ca ket qua cho "{searchTerm.trim()}"
              </button>
            </div>
          ) : (
            <p className='px-4 py-3 text-sm text-gray-500'>Khong tim thay ket qua phu hop</p>
          )}
        </div>
      )}

      {searchHistory.length > 0 && (
        <div className='mt-2 flex items-center gap-3 text-xs text-gray-500 overflow-x-auto whitespace-nowrap scrollbar-hide'>
          <span className='font-medium text-gray-600'>Lich su tim kiem:</span>
          {searchHistory.map((keyword) => (
            <button
              key={keyword}
              type='button'
              onClick={() => navigateToSearchResults(keyword)}
              className='text-gray-500 hover:text-orange-600 hover:underline'
            >
              {keyword}
            </button>
          ))}
          <button
            type='button'
            onClick={clearSearchHistory}
            className='ml-1 text-gray-500 hover:text-orange-600 underline'
          >
            Xoa
          </button>
        </div>
      )}
    </div>
  )
}

export default NavbarSearch
