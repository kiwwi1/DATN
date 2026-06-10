import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useContext } from 'react';
import { ShopContext } from '../../context/ShopContext';
import ProductItem from '../../components/product/ProductItem';
import { useSearchParams } from 'react-router-dom';
import { matchesSearchTerm } from '../../utils/searchUtils';
import { searchProductsApi } from '../../api/searchApi';

const SORT_OPTIONS = [
  { key: 'relevant', label: 'Liên Quan' },
  { key: 'newest', label: 'Mới Nhất' },
  { key: 'bestsell', label: 'Bán Chạy' },
  { key: 'lowToHigh', label: 'Giá', dir: 'asc' },
  { key: 'highToLow', label: 'Giá', dir: 'desc' },
];

const ITEMS_PER_PAGE = 20;

const Collection = () => {
  const { products, homepageCategories, userId } = useContext(ShopContext);
  const [searchParams] = useSearchParams();

  // ── Chế độ browse (category, không có search) ─────────────────────────────
  const [filterProducts, setFilterProducts] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [currentMainCategory, setCurrentMainCategory] = useState(null);
  const [subCategories, setSubCategories] = useState([]);
  const [showAllSubs, setShowAllSubs] = useState(false);

  // ── Chế độ search (server-side) ───────────────────────────────────────────
  const [searchResults, setSearchResults] = useState([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchTotalPages, setSearchTotalPages] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);

  // ── Chung ─────────────────────────────────────────────────────────────────
  const [sortType, setSortType] = useState('relevant');
  const [currentPage, setCurrentPage] = useState(1);
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [showPriceDropdown, setShowPriceDropdown] = useState(false);

  // Price filter
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [appliedMin, setAppliedMin] = useState(null);
  const [appliedMax, setAppliedMax] = useState(null);
  const [priceError, setPriceError] = useState('');

  const MAX_VISIBLE_SUBS = 8;
  const abortRef = useRef(null);

  const searchTerm = searchParams.get('search') || '';
  const categoryFromUrl = searchParams.get('category') || '';
  const isSearchMode = Boolean(searchTerm.trim());

  // ── Helpers category ──────────────────────────────────────────────────────
  const getAllChildrenCategoryIds = useCallback((categoryId) => {
    if (!homepageCategories?.categories) return [categoryId];
    const allIds = [categoryId];
    const findChildren = (parentId) => {
      homepageCategories.categories
        .filter(cat => {
          const p = typeof cat.parentCategory === 'object' ? cat.parentCategory?._id : cat.parentCategory;
          return p === parentId;
        })
        .forEach(child => { allIds.push(child._id); findChildren(child._id); });
    };
    findChildren(categoryId);
    return allIds;
  }, [homepageCategories]);

  const getDirectChildren = useCallback((categoryId) => {
    if (!homepageCategories?.categories) return [];
    return homepageCategories.categories.filter(cat => {
      const p = typeof cat.parentCategory === 'object' ? cat.parentCategory?._id : cat.parentCategory;
      return p === categoryId;
    });
  }, [homepageCategories]);

  // ── Reset khi URL category thay đổi ──────────────────────────────────────
  useEffect(() => {
    if (categoryFromUrl && homepageCategories?.categories) {
      setCurrentMainCategory(categoryFromUrl);
      setSubCategories(getDirectChildren(categoryFromUrl));
      setSelectedCategories([]);
    } else {
      setCurrentMainCategory(null);
      setSubCategories([]);
      setSelectedCategories([]);
    }
    setShowAllSubs(false);
    setCurrentPage(1);
  }, [categoryFromUrl, homepageCategories, getDirectChildren]);

  // ── Khi sort hoặc params thay đổi: reset page ────────────────────────────
  useEffect(() => {
    setCurrentPage(1);
  }, [sortType, appliedMin, appliedMax, searchTerm, categoryFromUrl]);

  const toggleSubCategory = (subcategoryId) => {
    setCurrentPage(1);
    setSelectedCategories(prev =>
      prev.includes(subcategoryId) ? [] : getAllChildrenCategoryIds(subcategoryId)
    );
  };

  // ── CHẾ ĐỘ BROWSE: filter client-side khi không có ?search= ──────────────
  useEffect(() => {
    if (isSearchMode) return;

    let copy = products.slice();
    if (selectedCategories.length > 0) {
      copy = copy.filter(p => {
        const effectiveCategory = p.subSubCategory || p.subCategory || p.category;
        return selectedCategories.includes(effectiveCategory);
      });
    } else if (categoryFromUrl) {
      const allIds = getAllChildrenCategoryIds(categoryFromUrl);
      copy = copy.filter(p => {
        const effectiveCategory = p.subSubCategory || p.subCategory || p.category;
        return allIds.includes(effectiveCategory);
      });
    }
    if (appliedMin !== null) copy = copy.filter(p => p.price >= appliedMin);
    if (appliedMax !== null) copy = copy.filter(p => p.price <= appliedMax);

    switch (sortType) {
      case 'lowToHigh': copy.sort((a, b) => a.price - b.price); break;
      case 'highToLow': copy.sort((a, b) => b.price - a.price); break;
      case 'bestsell': copy.sort((a, b) => (b.sold || 0) - (a.sold || 0)); break;
      case 'newest': copy.sort((a, b) => (b.date || 0) - (a.date || 0)); break;
      default: break;
    }
    setFilterProducts(copy);
  }, [isSearchMode, selectedCategories, products, sortType, appliedMin, appliedMax, categoryFromUrl, getAllChildrenCategoryIds]);

  // ── CHẾ ĐỘ SEARCH: gọi API server-side ──────────────────────────────────
  useEffect(() => {
    if (!isSearchMode) {
      setSearchResults([]);
      setSearchTotal(0);
      setSearchTotalPages(0);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setSearchLoading(true);
    searchProductsApi({
      q: searchTerm,
      page: currentPage,
      limit: ITEMS_PER_PAGE,
      userId: userId || undefined,
      categoryId: selectedCategories[0] || categoryFromUrl || undefined,
      minPrice: appliedMin !== null ? appliedMin : undefined,
      maxPrice: appliedMax !== null ? appliedMax : undefined,
      sort: sortType,
      signal: abortRef.current.signal,
    })
      .then((data) => {
        setSearchResults(data.products || []);
        setSearchTotal(data.total || 0);
        setSearchTotalPages(data.totalPages || 0);
      })
      .catch((err) => {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          setSearchResults([]);
        }
      })
      .finally(() => setSearchLoading(false));
  }, [isSearchMode, searchTerm, currentPage, sortType, appliedMin, appliedMax, selectedCategories, categoryFromUrl, userId]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [currentPage]);

  // ── Tính toán cho render ──────────────────────────────────────────────────
  const displayProducts = isSearchMode ? searchResults : filterProducts;
  const totalItems = isSearchMode ? searchTotal : filterProducts.length;
  const totalPages = isSearchMode
    ? searchTotalPages
    : Math.ceil(filterProducts.length / ITEMS_PER_PAGE);
  const currentProducts = isSearchMode
    ? displayProducts
    : displayProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const categoryName = homepageCategories?.categories?.find(c => c._id === currentMainCategory)?.name;

  const applyPrice = () => {
    setPriceError('');
    const min = minPrice.trim() === '' ? null : Number(minPrice);
    const max = maxPrice.trim() === '' ? null : Number(maxPrice);
    if (min !== null && (isNaN(min) || min < 0)) { setPriceError('Giá tối thiểu không hợp lệ'); return; }
    if (max !== null && (isNaN(max) || max < 0)) { setPriceError('Giá tối đa không hợp lệ'); return; }
    if (min !== null && max !== null && min > max) { setPriceError('Giá tối thiểu phải nhỏ hơn hoặc bằng giá tối đa'); return; }
    setAppliedMin(min === null ? null : min * 1000);
    setAppliedMax(max === null ? null : max * 1000);
  };

  const resetPrice = () => {
    setMinPrice(''); setMaxPrice('');
    setAppliedMin(null); setAppliedMax(null);
    setPriceError('');
  };

  // ── Sidebar JSX ───────────────────────────────────────────────────────────
  const sidebarContent = (
    <div className="space-y-4">
      {/* Category Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
        <div className="px-4 py-3.5 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-550 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            {categoryName || 'Tất Cả Danh Mục'}
          </span>
        </div>
        <ul className="py-2.5 divide-y divide-slate-50/50">
          {currentMainCategory && subCategories.length > 0 ? (
            <>
              {(showAllSubs ? subCategories : subCategories.slice(0, MAX_VISIBLE_SUBS)).map(sub => {
                const count = products.filter(p =>
                  getAllChildrenCategoryIds(sub._id).some(id =>
                    p.category === id || p.subCategory === id || p.subSubCategory === id
                  )
                ).length;
                const isSelected = selectedCategories.includes(sub._id);
                return (
                  <li key={sub._id}>
                    <button
                      onClick={() => toggleSubCategory(sub._id)}
                      className={`w-full flex justify-between items-center px-4.5 py-2.5 text-xs transition-all duration-200 font-semibold ${isSelected
                          ? 'text-pink-600 bg-pink-50/40'
                          : 'text-slate-600 hover:text-pink-600 hover:bg-slate-50/50'
                        }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${isSelected ? 'bg-pink-600' : 'bg-slate-300'}`} />
                        <span className="truncate">{sub.name}</span>
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold transition-colors ${isSelected ? 'bg-pink-100 text-pink-600' : 'bg-slate-100 text-slate-400'}`}>{count}</span>
                    </button>
                  </li>
                );
              })}
              {subCategories.length > MAX_VISIBLE_SUBS && (
                <li>
                  <button
                    onClick={() => setShowAllSubs(v => !v)}
                    className="w-full flex items-center justify-center gap-1 py-2 text-[11px] font-bold text-slate-400 hover:text-pink-600 transition-colors bg-slate-50/20"
                  >
                    <span>{showAllSubs ? 'Thu gọn danh mục ∧' : 'Xem thêm danh mục ∨'}</span>
                  </button>
                </li>
              )}
            </>
          ) : (
            <li className="px-5 py-6 text-center text-xs text-slate-400 font-medium italic">
              Hãy chọn danh mục chính từ trang chủ để xem danh mục phụ.
            </li>
          )}
        </ul>
      </div>

      {/* Price Range Filter Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
        <div className="px-4 py-3.5 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-550 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Khoảng Giá</span>
        </div>
        
        <div className="p-4.5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-slate-400">₫</span>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off"
                placeholder="Từ" value={minPrice} onChange={e => setMinPrice(e.target.value)}
                className="w-full border border-slate-200 rounded-xl pl-6 pr-2.5 py-2 text-xs focus:outline-none focus:border-pink-500 font-semibold focus:ring-2 focus:ring-pink-500/10"
              />
            </div>
            <span className="text-slate-300 text-xs shrink-0">—</span>
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-slate-400">₫</span>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off"
                placeholder="Đến" value={maxPrice} onChange={e => setMaxPrice(e.target.value)}
                className="w-full border border-slate-200 rounded-xl pl-6 pr-2.5 py-2 text-xs focus:outline-none focus:border-pink-500 font-semibold focus:ring-2 focus:ring-pink-500/10"
              />
            </div>
          </div>
          
          {priceError && <p className="text-[10px] font-semibold text-rose-600">{priceError}</p>}
          
          <div className="flex gap-2">
            <button 
              onClick={applyPrice} 
              className="flex-1 bg-gradient-to-r from-rose-500 to-orange-500 hover:opacity-95 text-white text-xs font-bold py-2 rounded-xl transition-all duration-200 shadow-sm shadow-orange-500/10"
            >
              Áp dụng
            </button>
            {(appliedMin !== null || appliedMax !== null) && (
              <button 
                onClick={resetPrice} 
                className="flex-1 border border-slate-200 text-slate-650 text-xs font-bold py-2 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Lọc lại
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 -mx-4 sm:-mx-[5vw] md:-mx-[7vw] lg:-mx-[9vw] px-4 sm:px-[5vw] md:px-[7vw] lg:px-[9vw] pt-4 pb-16">

      {/* Breadcrumb Navigation */}
      <nav className="text-[11px] font-semibold text-slate-400 mb-4 flex items-center gap-1.5">
        <span className="hover:text-slate-600 transition-colors cursor-pointer">Trang chủ</span>
        <span className="text-slate-300">/</span>
        {searchTerm ? (
          <>
            <span className="hover:text-slate-600 transition-colors cursor-pointer">Tìm kiếm</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-800 font-bold">"{searchTerm}"</span>
          </>
        ) : categoryName ? (
          <span className="text-slate-800 font-bold">{categoryName}</span>
        ) : (
          <span className="text-slate-800 font-bold">Tất cả sản phẩm</span>
        )}
      </nav>

      {/* Search Result Info Badge */}
      {isSearchMode && !searchLoading && (
        <div className="mb-4 bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
            <svg className="w-5 h-5 text-slate-450 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>
              Tìm thấy <strong className="text-pink-650 font-extrabold">{searchTotal.toLocaleString()}</strong> kết quả phù hợp cho
              <strong className="text-slate-850 font-extrabold"> &ldquo;{searchTerm}&rdquo;</strong>
            </span>
          </div>
          {userId && (
            <span className="self-start sm:self-auto text-[10px] font-extrabold bg-pink-50 text-pink-650 border border-pink-100 rounded-full px-2.5 py-0.5 uppercase tracking-wide">
              Đã Cá Nhân Hóa Đề Xuất
            </span>
          )}
        </div>
      )}

      {/* Main Grid: Sidebar + Product Grid */}
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* Desktop Sidebar */}
        <aside className="hidden sm:block w-56 shrink-0">{sidebarContent}</aside>

        {/* Product Listing Area */}
        <div className="flex-1 min-w-0 w-full">
          {/* Sort & Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 mb-4 flex flex-wrap items-center gap-2 px-4 py-3 shadow-2xs">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Căn chỉnh theo:</span>
            
            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
              {SORT_OPTIONS.filter(o => o.key !== 'highToLow').map(opt => {
                const isActive = sortType === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setSortType(opt.key)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 border ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-650 hover:text-slate-800 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
              
              {/* Price Dropdown Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowPriceDropdown(v => !v)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 ${
                    sortType === 'lowToHigh' || sortType === 'highToLow'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-650 hover:text-slate-800 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span>{sortType === 'lowToHigh' ? 'Giá: Thấp → Cao' : sortType === 'highToLow' ? 'Giá: Cao → Thấp' : 'Mức giá'}</span>
                  <svg className={`w-3.5 h-3.5 transition-transform shrink-0 ${showPriceDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showPriceDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowPriceDropdown(false)} />
                    <div className="absolute top-full left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-20 w-44 overflow-hidden py-1">
                      <button 
                        onClick={() => { setSortType('lowToHigh'); setShowPriceDropdown(false); }} 
                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 flex items-center justify-between ${sortType === 'lowToHigh' ? 'text-pink-600 bg-pink-50/20' : 'text-slate-700'}`}
                      >
                        <span>Giá: Thấp đến Cao</span>
                        {sortType === 'lowToHigh' && <span className="w-1.5 h-1.5 rounded-full bg-pink-600" />}
                      </button>
                      <button 
                        onClick={() => { setSortType('highToLow'); setShowPriceDropdown(false); }} 
                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 flex items-center justify-between ${sortType === 'highToLow' ? 'text-pink-600 bg-pink-50/20' : 'text-slate-700'}`}
                      >
                        <span>Giá: Cao đến Thấp</span>
                        {sortType === 'highToLow' && <span className="w-1.5 h-1.5 rounded-full bg-pink-600" />}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Mobile Filter Toggle */}
            <button 
              onClick={() => setShowMobileFilter(true)} 
              className="sm:hidden flex items-center gap-1.5 bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-750 hover:bg-slate-50"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              <span>Bộ Lọc</span>
            </button>

            <span className="text-xs font-bold text-slate-450 hidden lg:block shrink-0">{totalItems.toLocaleString()} mặt hàng</span>

            {/* Micro pager next to sort bar */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 shrink-0 ml-2">
                <span>{currentPage}/{totalPages} trang</span>
                <div className="flex gap-1">
                  <button 
                    disabled={currentPage === 1} 
                    onClick={() => setCurrentPage(p => p - 1)} 
                    className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded-lg hover:border-slate-350 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-650" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button 
                    disabled={currentPage === totalPages} 
                    onClick={() => setCurrentPage(p => p + 1)} 
                    className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded-lg hover:border-slate-350 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-650" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Loading Skeletons */}
          {searchLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200/70 p-3 space-y-3 animate-pulse shadow-2xs">
                  <div className="aspect-square bg-slate-100 rounded-xl" />
                  <div className="space-y-2">
                    <div className="h-3.5 bg-slate-100 rounded-lg w-3/4" />
                    <div className="h-3.5 bg-slate-100 rounded-lg w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Product Items Grid */}
          {!searchLoading && currentProducts.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {currentProducts.map((item) => (
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
                />
              ))}
            </div>
          )}

          {/* Empty Search / Filters Result State */}
          {!searchLoading && currentProducts.length === 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/80 flex flex-col items-center justify-center py-20 px-4 text-center shadow-2xs">
              <div className="w-16 h-16 bg-slate-50 border border-slate-150 rounded-2xl text-slate-400 flex items-center justify-center mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-sm font-extrabold text-slate-700 uppercase tracking-wide">Không tìm thấy sản phẩm</p>
              <p className="text-xs text-slate-450 mt-1 max-w-sm leading-relaxed">
                Hệ thống không tìm thấy kết quả nào phù hợp với yêu cầu lọc hoặc từ khóa tìm kiếm của bạn. Vui lòng làm mới hoặc thử lại.
              </p>
              {(selectedCategories.length > 0 || appliedMin !== null || appliedMax !== null) && (
                <button
                  onClick={() => { setSelectedCategories([]); resetPrice(); }}
                  className="mt-5 px-6 py-2.5 bg-gradient-to-r from-rose-500 to-orange-500 hover:opacity-95 text-white font-bold rounded-xl text-xs transition-all shadow-sm"
                >
                  Xóa bộ lọc tìm kiếm
                </button>
              )}
            </div>
          )}

          {/* Pagination Controls */}
          {!searchLoading && totalPages > 1 && (
            <div className="flex justify-center items-center gap-1.5 mt-10">
              <button 
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} 
                disabled={currentPage === 1} 
                className="w-9 h-9 flex items-center justify-center border border-slate-200 rounded-xl bg-white hover:border-pink-500 hover:text-pink-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 font-bold shadow-2xs"
              >
                ‹
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                const show = page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                const ellipsisBefore = page === currentPage - 2 && currentPage > 3;
                const ellipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;
                
                if (ellipsisBefore || ellipsisAfter) return <span key={page} className="text-slate-300 font-bold px-1.5">…</span>;
                if (!show) return null;
                
                const isActive = currentPage === page;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 rounded-xl text-xs font-extrabold transition-all duration-200 border ${
                      isActive 
                        ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white border-transparent shadow-sm shadow-orange-500/10' 
                        : 'bg-white border-slate-200 text-slate-650 hover:border-pink-500 hover:text-pink-600'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              
              <button 
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} 
                disabled={currentPage === totalPages} 
                className="w-9 h-9 flex items-center justify-center border border-slate-200 rounded-xl bg-white hover:border-pink-500 hover:text-pink-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 font-bold shadow-2xs"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filter Slide Drawer */}
      {showMobileFilter && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-xs animate-fade-in" onClick={() => setShowMobileFilter(false)} />
          <div className="w-80 bg-white h-full overflow-y-auto p-5 shadow-2xl flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <p className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Bộ lọc tìm kiếm</p>
                <button onClick={() => setShowMobileFilter(false)} className="text-slate-450 hover:text-slate-800 transition-colors p-1 rounded-lg hover:bg-slate-50">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {sidebarContent}
            </div>
            
            <button 
              onClick={() => setShowMobileFilter(false)} 
              className="mt-6 w-full bg-gradient-to-r from-rose-500 to-orange-500 text-white py-3 rounded-xl font-bold text-xs hover:opacity-95 transition-all shadow-sm"
            >
              Xem {totalItems.toLocaleString()} kết quả
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Collection;
