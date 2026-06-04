import React, { useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShopContext } from '../../context/ShopContext'
import { formatPrice } from '../../utils/priceFormat'
import { formatImageUrl } from '../../utils/imageUtils'
import { normalizeSearchText, highlightMatch } from '../../utils/searchUtils'
import { autocompleteApi, getTrendingSearchesApi } from '../../api/searchApi'

const MAX_HISTORY_ITEMS = 8
const SEARCH_HISTORY_PREFIX = 'datn_search_history'
const AUTOCOMPLETE_DEBOUNCE_MS = 280

/** Render chuỗi có highlight từ khoá */
const HighlightText = ({ text, keyword }) => {
  const parts = highlightMatch(text, keyword)
  return (
    <>
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          <span key={i}>{part}</span>
        ) : (
          <mark key={i} className='bg-yellow-100 text-yellow-800 rounded-sm px-0.5'>
            {part.text}
          </mark>
        )
      )}
    </>
  )
}

const NavbarSearch = () => {
  const { userId } = useContext(ShopContext)
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchHistory, setSearchHistory] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [trendingQueries, setTrendingQueries] = useState([])
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)

  const inputRef = useRef(null)
  const abortRef = useRef(null)
  const debounceRef = useRef(null)
  const listboxId = 'navbar-search-listbox'

  const searchHistoryKey = `${SEARCH_HISTORY_PREFIX}:${userId || 'guest'}`

  // Load lịch sử khi đổi user
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(searchHistoryKey)
      const parsed = raw ? JSON.parse(raw) : []
      setSearchHistory(Array.isArray(parsed) ? parsed.filter((i) => typeof i === 'string') : [])
    } catch {
      setSearchHistory([])
    }
  }, [searchHistoryKey])

  // Auto-focus
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [])

  // Load trending khi mount (hiện khi input rỗng)
  useEffect(() => {
    getTrendingSearchesApi(8)
      .then(setTrendingQueries)
      .catch(() => {})
  }, [])

  // Debounced autocomplete từ API
  useEffect(() => {
    clearTimeout(debounceRef.current)
    const keyword = searchTerm.trim()

    if (!keyword) {
      setSuggestions([])
      setIsLoadingSuggestions(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      // Huỷ request cũ nếu còn đang chạy
      abortRef.current?.abort()
      abortRef.current = new AbortController()

      setIsLoadingSuggestions(true)
      try {
        const results = await autocompleteApi(keyword, 6, abortRef.current.signal)
        setSuggestions(results)
        setActiveSuggestionIndex(-1)
      } catch (err) {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          setSuggestions([])
        }
      } finally {
        setIsLoadingSuggestions(false)
      }
    }, AUTOCOMPLETE_DEBOUNCE_MS)

    return () => clearTimeout(debounceRef.current)
  }, [searchTerm])

  const updateSearchHistory = useCallback((keyword) => {
    const value = String(keyword || '').trim()
    if (!value) return
    setSearchHistory((prev) => {
      const normalizedValue = normalizeSearchText(value)
      const next = [value, ...prev.filter((item) => normalizeSearchText(item) !== normalizedValue)].slice(0, MAX_HISTORY_ITEMS)
      try { window.localStorage.setItem(searchHistoryKey, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [searchHistoryKey])

  const clearSearchHistory = () => {
    setSearchHistory([])
    try { window.localStorage.removeItem(searchHistoryKey) } catch { /* ignore */ }
  }

  const navigateToSearchResults = useCallback((keyword = searchTerm) => {
    const kw = String(keyword || '').trim()
    if (!kw) return
    updateSearchHistory(kw)
    navigate(`/collection?search=${encodeURIComponent(kw)}`)
    setShowSuggestions(false)
    setActiveSuggestionIndex(-1)
  }, [searchTerm, updateSearchHistory, navigate])

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

  const handleInputKeyDown = (event) => {
    if (!showSuggestions || suggestions.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveSuggestionIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
    } else if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      event.preventDefault()
      const selected = suggestions[activeSuggestionIndex]
      if (selected?._id) handleSuggestionClick(selected._id)
    } else if (event.key === 'Escape') {
      setShowSuggestions(false)
      setActiveSuggestionIndex(-1)
    }
  }

  const isOpen = showSuggestions && searchTerm.trim()

  // Nội dung dropdown
  const renderDropdown = () => {
    if (isLoadingSuggestions) {
      return (
        <div className='px-4 py-4 flex items-center gap-2 text-sm text-slate-400'>
          <svg className='w-4 h-4 animate-spin' fill='none' viewBox='0 0 24 24'>
            <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
            <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8v8z' />
          </svg>
          Đang tìm kiếm...
        </div>
      )
    }

    if (suggestions.length > 0) {
      return (
        <div className='p-2.5'>
          {suggestions.map((product, index) => (
            <button
              key={product._id}
              id={`suggestion-${index}`}
              type='button'
              role='option'
              aria-selected={activeSuggestionIndex === index}
              onMouseDown={() => handleSuggestionClick(product._id)}
              onMouseEnter={() => setActiveSuggestionIndex(index)}
              className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                activeSuggestionIndex === index ? 'bg-rose-50/80' : 'hover:bg-rose-50/70'
              }`}
            >
              <img
                src={formatImageUrl(product.image, { variant: 'thumb', width: 96, height: 96, fit: 'cover', quality: 76, format: 'webp' })}
                referrerPolicy='no-referrer'
                alt={product.name}
                className='w-11 h-11 object-cover rounded-lg border border-rose-100 flex-shrink-0'
              />
              <div className='flex-1 min-w-0'>
                <p className='text-sm text-slate-800 truncate'>
                  <HighlightText text={product.name} keyword={searchTerm} />
                </p>
                <p className='text-xs text-rose-600 font-medium mt-0.5'>{formatPrice(product.price)}</p>
              </div>
            </button>
          ))}
          <button
            type='button'
            onMouseDown={() => navigateToSearchResults()}
            className='w-full mt-1 py-2 text-sm text-rose-600 hover:text-rose-700 font-medium'
          >
            Xem tất cả kết quả cho &ldquo;{searchTerm.trim()}&rdquo;
          </button>
        </div>
      )
    }

    return <p className='px-4 py-3 text-sm text-slate-500'>Không tìm thấy kết quả phù hợp</p>
  }

  return (
    <div className='relative w-full'>
      <form onSubmit={handleSubmit} className='w-full' role='search'>
        <div className='flex items-center gap-2 rounded-full border border-rose-100 bg-white/90 px-2 py-1 shadow-[0_8px_20px_rgba(244,114,182,0.12)] backdrop-blur transition-all duration-300 focus-within:border-rose-300 focus-within:shadow-[0_12px_24px_rgba(244,114,182,0.2)]'>
          <input
            ref={inputRef}
            id='navbar-search-input'
            type='text'
            role='combobox'
            aria-autocomplete='list'
            aria-expanded={isOpen ? 'true' : 'false'}
            aria-controls={listboxId}
            aria-activedescendant={activeSuggestionIndex >= 0 ? `suggestion-${activeSuggestionIndex}` : undefined}
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
          {searchTerm && (
            <button
              type='button'
              aria-label='Xoá từ khoá'
              onClick={() => { setSearchTerm(''); setSuggestions([]); setShowSuggestions(false); inputRef.current?.focus() }}
              className='text-slate-400 hover:text-slate-600 transition px-1'
            >
              <svg xmlns='http://www.w3.org/2000/svg' className='w-4 h-4' fill='none' viewBox='0 0 24 24' strokeWidth={2} stroke='currentColor'>
                <path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
              </svg>
            </button>
          )}
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

      {/* Dropdown suggestions */}
      {isOpen && (
        <div
          id={listboxId}
          role='listbox'
          aria-label='Gợi ý tìm kiếm'
          className='absolute top-full left-0 right-0 mt-2 bg-white/95 border border-rose-100 rounded-2xl shadow-[0_16px_28px_rgba(15,23,42,0.12)] max-h-96 overflow-y-auto z-50 backdrop-blur'
        >
          {renderDropdown()}
        </div>
      )}

      {/* Trending + search history (hiện khi input rỗng, đang focus) */}
      {showSuggestions && !searchTerm.trim() && (trendingQueries.length > 0 || searchHistory.length > 0) && (
        <div className='absolute top-full left-0 right-0 mt-2 bg-white/95 border border-rose-100 rounded-2xl shadow-[0_16px_28px_rgba(15,23,42,0.12)] z-50 backdrop-blur p-4 space-y-3'>
          {trendingQueries.length > 0 && (
            <div>
              <p className='text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2'>Tìm kiếm phổ biến</p>
              <div className='flex flex-wrap gap-1.5'>
                {trendingQueries.map(({ query }) => (
                  <button
                    key={query}
                    type='button'
                    onMouseDown={() => navigateToSearchResults(query)}
                    className='flex items-center gap-1 rounded-full border border-rose-100 bg-rose-50/60 px-3 py-1 text-xs text-rose-700 hover:bg-rose-100 transition-colors'
                  >
                    <svg className='w-3 h-3 text-rose-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' />
                    </svg>
                    {query}
                  </button>
                ))}
              </div>
            </div>
          )}
          {searchHistory.length > 0 && (
            <div>
              <div className='flex items-center justify-between mb-2'>
                <p className='text-xs font-semibold text-slate-500 uppercase tracking-wide'>Tìm kiếm gần đây</p>
                <button type='button' onClick={clearSearchHistory} className='text-xs text-slate-400 hover:text-rose-500 transition-colors'>
                  Xóa tất cả
                </button>
              </div>
              <div className='flex flex-wrap gap-1.5'>
                {searchHistory.map((keyword) => (
                  <button
                    key={keyword}
                    type='button'
                    onMouseDown={() => navigateToSearchResults(keyword)}
                    className='rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-rose-200 hover:text-rose-600 transition-colors'
                  >
                    {keyword}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick history chips bên dưới ô input */}
      {searchHistory.length > 0 && !showSuggestions && (
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
          <button type='button' onClick={clearSearchHistory} className='ml-1 text-slate-500 hover:text-rose-600 underline'>
            Xóa
          </button>
        </div>
      )}
    </div>
  )
}

export default NavbarSearch
