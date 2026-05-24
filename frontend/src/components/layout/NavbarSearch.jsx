import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
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
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const inputRef = useRef(null)

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

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
    return () => clearTimeout(timer)
  }, [])

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
    setActiveSuggestionIndex(-1)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    navigateToSearchResults()
  }

  const handleSuggestionClick = (productId) => {
    navigate(`/product/${productId}`)
    setSearchTerm('')
    setShowSuggestions(false)
    setActiveSuggestionIndex(-1)
  }

  const handleBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false)
      setActiveSuggestionIndex(-1)
    }, 150)
  }

  useEffect(() => {
    if (!showSuggestions || suggestions.length === 0) {
      setActiveSuggestionIndex(-1)
      return
    }
    if (activeSuggestionIndex >= suggestions.length) {
      setActiveSuggestionIndex(suggestions.length - 1)
    }
  }, [activeSuggestionIndex, showSuggestions, suggestions])

  const handleInputKeyDown = (event) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveSuggestionIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
      return
    }

    if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      event.preventDefault()
      const selected = suggestions[activeSuggestionIndex]
      if (selected?._id) handleSuggestionClick(selected._id)
    }
  }

  return (
    <div className='relative w-full'>
      <form onSubmit={handleSubmit} className='w-full'>
        <div className='flex items-center gap-2 rounded-full border border-rose-100 bg-white/90 px-2 py-1 shadow-[0_8px_20px_rgba(244,114,182,0.12)] backdrop-blur transition-all duration-300 focus-within:border-rose-300 focus-within:shadow-[0_12px_24px_rgba(244,114,182,0.2)]'>
          <input
            ref={inputRef}
            type='text'
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setShowSuggestions(true)
              setActiveSuggestionIndex(-1)
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={handleBlur}
            onKeyDown={handleInputKeyDown}
            placeholder='Tìm sản phẩm, thương hiệu hoặc cửa hàng...'
            className='w-full bg-transparent px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none'
          />
          <button
            type='submit'
            className='rounded-full p-2.5 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white hover:brightness-110 transition'
            aria-label='Tìm kiếm'
          >
            <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={2} stroke='currentColor' className='w-4 h-4'>
              <path strokeLinecap='round' strokeLinejoin='round' d='m21 21-4.35-4.35m0 0a7.5 7.5 0 1 0-10.607 0 7.5 7.5 0 0 0 10.607 0Z' />
            </svg>
          </button>
        </div>
      </form>

      {showSuggestions && searchTerm.trim() && (
        <div className='absolute top-full left-0 right-0 mt-2 bg-white/95 border border-rose-100 rounded-2xl shadow-[0_16px_28px_rgba(15,23,42,0.12)] max-h-96 overflow-y-auto z-50 backdrop-blur'>
          {suggestions.length > 0 ? (
            <div className='p-2.5'>
              {suggestions.map((product, index) => (
                <button
                  key={product._id}
                  type='button'
                  onMouseDown={() => handleSuggestionClick(product._id)}
                  onMouseEnter={() => setActiveSuggestionIndex(index)}
                  className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                    activeSuggestionIndex === index ? 'bg-rose-50/80' : 'hover:bg-rose-50/70'
                  }`}
                >
                  <img
                    src={formatImageUrl(product.image, { variant: "thumb", width: 96, height: 96, fit: "cover", quality: 76, format: "webp" })}
                    referrerPolicy='no-referrer'
                    alt={product.name}
                    className='w-11 h-11 object-cover rounded-lg border border-rose-100'
                  />
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm text-slate-800 truncate'>{product.name}</p>
                    <p className='text-xs text-rose-600 font-medium mt-0.5'>{formatPrice(product.price)}</p>
                  </div>
                </button>
              ))}
              <button
                type='button'
                onMouseDown={() => navigateToSearchResults()}
                className='w-full mt-1 py-2 text-sm text-rose-600 hover:text-rose-700 font-medium'
              >
                Xem tất cả kết quả cho "{searchTerm.trim()}"
              </button>
            </div>
          ) : (
            <p className='px-4 py-3 text-sm text-slate-500'>Không tìm thấy kết quả phù hợp</p>
          )}
        </div>
      )}

      {searchHistory.length > 0 && (
        <div className='mt-2 flex items-center gap-2 text-xs text-slate-500 overflow-x-auto whitespace-nowrap scrollbar-hide'>
          <span className='font-medium text-slate-600'>Tìm nhanh:</span>
          {searchHistory.map((keyword) => (
            <button
              key={keyword}
              type='button'
              onClick={() => navigateToSearchResults(keyword)}
              className='rounded-full border border-rose-100 bg-white/75 px-3 py-1 hover:bg-rose-50 hover:text-rose-600 transition-colors'
            >
              {keyword}
            </button>
          ))}
          <button
            type='button'
            onClick={clearSearchHistory}
            className='ml-1 text-slate-500 hover:text-rose-600 underline'
          >
            Xóa
          </button>
        </div>
      )}
    </div>
  )
}

export default NavbarSearch


