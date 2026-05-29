import React, { useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShopContext } from '../../context/ShopContext'
import { formatPrice } from '../../utils/priceFormat'
import { formatImageUrl } from '../../utils/imageUtils'
import { normalizeSearchText, matchesSearchTerm, highlightMatch } from '../../utils/searchUtils'

const MAX_HISTORY_ITEMS = 8
const SEARCH_HISTORY_PREFIX = 'datn_search_history'

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
  const { products, userId } = useContext(ShopContext)
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchHistory, setSearchHistory] = useState([])
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const inputRef = useRef(null)
  const listboxId = 'navbar-search-listbox'

  const searchHistoryKey = useMemo(
    () => `${SEARCH_HISTORY_PREFIX}:${userId || 'guest'}`,
    [userId]
  )

  // Load lịch sử khi đổi user
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(searchHistoryKey)
      if (!raw) { setSearchHistory([]); return }
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

  // Auto-focus
  useEffect(() => {
    const timer = setTimeout(() => { inputRef.current?.focus() }, 0)
    return () => clearTimeout(timer)
  }, [])

  // Debounce 200ms để tránh filter liên tục mỗi keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 200)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const updateSearchHistory = useCallback((keyword) => {
    const value = String(keyword || '').trim()
    if (!value) return

    setSearchHistory((prev) => {
      const normalizedValue = normalizeSearchText(value)
      const next = [
        value,
        ...prev.filter((item) => normalizeSearchText(item) !== normalizedValue),
      ].slice(0, MAX_HISTORY_ITEMS)

      if (typeof window !== 'undefined') {
        try { window.localStorage.setItem(searchHistoryKey, JSON.stringify(next)) } catch { /* ignore */ }
      }
      return next
    })
  }, [searchHistoryKey])

  const clearSearchHistory = () => {
    setSearchHistory([])
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem(searchHistoryKey) } catch { /* ignore */ }
    }
  }

  // Suggestion dùng debouncedTerm + matchesSearchTerm (có tags)
  const suggestions = useMemo(() => {
    const keyword = normalizeSearchText(debouncedTerm)
    if (!keyword) return []
    return (products || [])
      .filter((product) => matchesSearchTerm(product, debouncedTerm))
      .slice(0, 6)
  }, [products, debouncedTerm])

  const navigateToSearchResults = useCallback((keyword = searchTerm) => {
    const normalizedKeyword = String(keyword || '').trim()
    if (!normalizedKeyword) return
    updateSearchHistory(normalizedKeyword)
    navigate(`/collection?search=${encodeURIComponent(normalizedKeyword)}`)
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
    if (event.key === 'Escape') {
      setShowSuggestions(false)
      setActiveSuggestionIndex(-1)
    }
  }

  const isOpen = showSuggestions && searchTerm.trim()

  return (
    <div className='relative w-full'>
      <form onSubmit={handleSubmit} className='w-full' role='search'>
        <div
          className='flex items-center gap-2 rounded-full border border-rose-100 bg-white/90 px-2 py-1 shadow-[0_8px_20px_rgba(244,114,182,0.12)] backdrop-blur transition-all duration-300 focus-within:border-rose-300 focus-within:shadow-[0_12px_24px_rgba(244,114,182,0.2)]'
        >
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
          {/* Nút xoá nhanh */}
          {searchTerm && (
            <button
              type='button'
              aria-label='Xoá từ khoá'
              onClick={() => { setSearchTerm(''); setShowSuggestions(false); inputRef.current?.focus() }}
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

      {isOpen && (
        <div
          id={listboxId}
          role='listbox'
          aria-label='Gợi ý tìm kiếm'
          className='absolute top-full left-0 right-0 mt-2 bg-white/95 border border-rose-100 rounded-2xl shadow-[0_16px_28px_rgba(15,23,42,0.12)] max-h-96 overflow-y-auto z-50 backdrop-blur'
        >
          {suggestions.length > 0 ? (
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
                    className='w-11 h-11 object-cover rounded-lg border border-rose-100'
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
