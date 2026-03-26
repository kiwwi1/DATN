import React, { useEffect, useState, useCallback } from 'react'
import { useContext } from 'react';
import { ShopContext } from '../../context/ShopContext';
import ProductItem from '../../components/product/ProductItem';
import { useSearchParams } from 'react-router-dom';

const SORT_OPTIONS = [
  { key: 'relevant', label: 'Liên Quan' },
  { key: 'newest', label: 'Mới Nhất' },
  { key: 'bestsell', label: 'Bán Chạy' },
  { key: 'lowToHigh', label: 'Giá', dir: 'asc' },
  { key: 'highToLow', label: 'Giá', dir: 'desc' },
];

const ITEMS_PER_PAGE = 30;

const Collection = () => {
  const { products, search, showSearch, homepageCategories, trackInteraction, token } = useContext(ShopContext);
  const [searchParams] = useSearchParams();

  const [filterProducts, setFilterProducts] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [sortType, setSortType] = useState('relevant');
  const [currentMainCategory, setCurrentMainCategory] = useState(null);
  const [subCategories, setSubCategories] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [showPriceDropdown, setShowPriceDropdown] = useState(false);
  const [showAllSubs, setShowAllSubs] = useState(false);

  const MAX_VISIBLE_SUBS = 7;

  // Price range filter
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [appliedMin, setAppliedMin] = useState(null);
  const [appliedMax, setAppliedMax] = useState(null);

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

  useEffect(() => {
    const categoryFromUrl = searchParams.get('category');
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
  }, [searchParams, homepageCategories, getAllChildrenCategoryIds, getDirectChildren]);

  const toggleSubCategory = (subcategoryId) => {
    setSelectedCategories(prev =>
      prev.includes(subcategoryId)
        ? []
        : getAllChildrenCategoryIds(subcategoryId)
    );
  };

  useEffect(() => {
    let copy = products.slice();
    const searchTerm = searchParams.get('search') || (showSearch ? search : '');
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      copy = copy.filter(p =>
        p.name?.toLowerCase().includes(lower) ||
        p.brand?.toLowerCase().includes(lower) ||
        p.vendorShopName?.toLowerCase().includes(lower)
      );
    }
    const categoryFromUrl = searchParams.get('category');
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
    setCurrentPage(1);

    // Track searched signal cho top 5 sản phẩm khi user đang tìm kiếm
    const activeTerm = searchParams.get('search') || (showSearch ? search : '');
    if (activeTerm && token && copy.length > 0) {
      copy.slice(0, 5).forEach((p) => trackInteraction(p._id, 'searched'));
    }
  }, [selectedCategories, search, showSearch, products, sortType, searchParams, appliedMin, appliedMax, getAllChildrenCategoryIds, trackInteraction, token]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [currentPage]);

  const totalPages = Math.ceil(filterProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentProducts = filterProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const categoryName = homepageCategories?.categories?.find(c => c._id === currentMainCategory)?.name;
  const searchTerm = searchParams.get('search');

  const applyPrice = () => {
    const min = minPrice.trim() === '' ? null : Number(minPrice);
    const max = maxPrice.trim() === '' ? null : Number(maxPrice);

    setAppliedMin(min === null || Number.isNaN(min) ? null : min * 1000);
    setAppliedMax(max === null || Number.isNaN(max) ? null : max * 1000);
  };
  const resetPrice = () => {
    setMinPrice(''); setMaxPrice('');
    setAppliedMin(null); setAppliedMax(null);
  };

  // ── Sidebar JSX (không phải component — tránh remount mỗi re-render) ──────
  const sidebarContent = (
    <div className="space-y-4">
      {/* Categories */}
      <div className="bg-white rounded border border-gray-200">
        <p className="px-4 py-3 text-sm font-bold text-gray-800 border-b border-gray-100">
          {categoryName || 'Tất Cả Danh Mục'}
        </p>
        <ul className="py-2">
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
                      className={`w-full flex justify-between items-center px-4 py-2 text-sm transition-colors ${isSelected
                          ? 'text-orange-500 font-semibold'
                          : 'text-gray-600 hover:text-orange-500 hover:bg-gray-50'
                        }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {isSelected
                          ? <span className="text-orange-500 text-xs">▶</span>
                          : <span className="w-3 inline-block" />
                        }
                        {sub.name}
                      </span>
                      <span className="text-xs text-gray-400">{count}</span>
                    </button>
                  </li>
                );
              })}
              {subCategories.length > MAX_VISIBLE_SUBS && (
                <li>
                  <button
                    onClick={() => setShowAllSubs(v => !v)}
                    className="w-full flex items-center gap-1 px-4 py-2 text-sm text-gray-500 hover:text-orange-500 transition-colors"
                  >
                    <span className="w-3 inline-block" />
                    {showAllSubs ? 'Thu gọn ∧' : `Thêm ∨`}
                  </button>
                </li>
              )}
            </>
          ) : (
            <li className="px-4 py-3 text-sm text-gray-400 italic">
              Chọn danh mục để lọc
            </li>
          )}
        </ul>
      </div>

      {/* Price Range */}
      <div className="bg-white rounded border border-gray-200">
        <p className="px-4 py-3 text-sm font-semibold text-gray-700 border-b border-gray-100 uppercase tracking-wide">
          Khoảng Giá
        </p>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              placeholder="Từ (nghìn ₫)"
              value={minPrice}
              onChange={e => setMinPrice(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400"
            />
            <span className="text-gray-400 text-xs">—</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              placeholder="Đến (nghìn ₫)"
              value={maxPrice}
              onChange={e => setMaxPrice(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={applyPrice}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs py-1.5 rounded transition-colors"
            >
              Áp dụng
            </button>
            {(appliedMin !== null || appliedMax !== null) && (
              <button
                onClick={resetPrice}
                className="flex-1 border border-gray-300 text-gray-600 text-xs py-1.5 rounded hover:bg-gray-50 transition-colors"
              >
                Xóa
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f5f5f5] -mx-4 sm:-mx-[5vw] md:-mx-[7vw] lg:-mx-[9vw] px-4 sm:px-[5vw] md:px-[7vw] lg:px-[9vw] pt-4 pb-10">

      {/* Breadcrumb */}
      <nav className="text-xs text-gray-500 mb-3 flex items-center gap-1">
        <span>Trang chủ</span>
        <span>›</span>
        {searchTerm ? (
          <>
            <span>Tìm kiếm</span>
            <span>›</span>
            <span className="text-gray-800">"{searchTerm}"</span>
          </>
        ) : categoryName ? (
          <span className="text-gray-800">{categoryName}</span>
        ) : (
          <span className="text-gray-800">Tất cả sản phẩm</span>
        )}
      </nav>

      <div className="flex gap-3">
        {/* ── Sidebar desktop ── */}
        <aside className="hidden sm:block w-52 flex-shrink-0">
          {sidebarContent}
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0">
          {/* Sort bar — Shopee style */}
          <div className="bg-[#ededed] rounded mb-3 flex flex-wrap items-center gap-1 px-4 py-2.5">
            <span className="text-sm text-gray-600 mr-2 whitespace-nowrap">Sắp xếp theo</span>
            {SORT_OPTIONS.filter(o => o.key !== 'highToLow').map(opt => (
              <button
                key={opt.key}
                onClick={() => setSortType(opt.key)}
                className={`px-4 py-1.5 rounded text-sm transition-colors ${sortType === opt.key
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-700 hover:text-orange-500 border border-gray-200'
                  }`}
              >
                {opt.label}
              </button>
            ))}
            {/* Giá dropdown (asc/desc) */}
            <div className="relative ml-1">
              <button
                onClick={() => setShowPriceDropdown(v => !v)}
                className={`flex items-center gap-1 px-4 py-1.5 rounded text-sm border transition-colors ${sortType === 'lowToHigh' || sortType === 'highToLow'
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-gray-700 hover:text-orange-500 border-gray-200'
                  }`}
              >
                {sortType === 'lowToHigh' ? 'Giá: Thấp → Cao' : sortType === 'highToLow' ? 'Giá: Cao → Thấp' : 'Giá'}
                <svg className={`w-3 h-3 transition-transform ${showPriceDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showPriceDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowPriceDropdown(false)} />
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-20 w-40">
                    <button
                      onClick={() => { setSortType('lowToHigh'); setShowPriceDropdown(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 hover:text-orange-500 ${sortType === 'lowToHigh' ? 'text-orange-500 font-medium bg-orange-50' : 'text-gray-700'}`}
                    >
                      Thấp đến Cao
                    </button>
                    <button
                      onClick={() => { setSortType('highToLow'); setShowPriceDropdown(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 hover:text-orange-500 ${sortType === 'highToLow' ? 'text-orange-500 font-medium bg-orange-50' : 'text-gray-700'}`}
                    >
                      Cao đến Thấp
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mobile: nút filter */}
            <button
              onClick={() => setShowMobileFilter(true)}
              className="sm:hidden ml-auto flex items-center gap-1 bg-white border border-gray-200 px-3 py-1.5 rounded text-sm text-gray-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              Lọc
            </button>

            {/* Result count — đẩy sang phải */}
            <span className="ml-auto text-sm text-gray-500 hidden sm:block">
              {filterProducts.length} sản phẩm
            </span>

            {/* Pagination mini */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-sm text-gray-600 ml-2">
                <span>{currentPage}/{totalPages}</span>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:border-orange-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:border-orange-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Product grid */}
          {currentProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
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
          ) : (
            <div className="bg-white rounded flex flex-col items-center justify-center py-24 text-gray-400">
              <svg className="w-20 h-20 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <p className="text-base font-medium text-gray-500">Không tìm thấy sản phẩm</p>
              <p className="text-sm mt-1">Hãy thử thay đổi bộ lọc hoặc từ khoá tìm kiếm</p>
              {(selectedCategories.length > 0 || appliedMin !== null || appliedMax !== null) && (
                <button
                  onClick={() => {
                    setSelectedCategories([]);
                    resetPrice();
                  }}
                  className="mt-4 px-6 py-2 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition-colors"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          )}

          {/* Bottom pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-1.5 mt-8">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded bg-white hover:border-orange-500 hover:text-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                const show = page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                const ellipsisBefore = page === currentPage - 2 && currentPage > 3;
                const ellipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;
                if (ellipsisBefore || ellipsisAfter) return <span key={page} className="text-gray-400 px-1">…</span>;
                if (!show) return null;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 rounded text-sm font-medium transition-colors border ${currentPage === page
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-orange-500 hover:text-orange-500'
                      }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded bg-white hover:border-orange-500 hover:text-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {showMobileFilter && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setShowMobileFilter(false)} />
          <div className="w-72 bg-white h-full overflow-y-auto p-4 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <p className="font-semibold text-gray-800">Bộ Lọc</p>
              <button onClick={() => setShowMobileFilter(false)} className="text-gray-500 hover:text-gray-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {sidebarContent}
            <button
              onClick={() => setShowMobileFilter(false)}
              className="mt-6 w-full bg-orange-500 text-white py-2.5 rounded font-medium hover:bg-orange-600 transition-colors"
            >
              Xem {filterProducts.length} sản phẩm
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Collection;
