import React, { useContext, useEffect, useState } from 'react'
import { ShopContext } from '../../context/ShopContext'
import { useNavigate } from 'react-router-dom'
import Title from '../ui/Title'

// Bảng màu gradient xoay vòng cho từng category với phong cách thanh lịch
const ICON_COLORS = [
  { bg: 'bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-100/20 group-hover:shadow-rose-100/50' },
  { bg: 'bg-orange-50 border border-orange-100 text-orange-500 hover:bg-orange-100/20 group-hover:shadow-orange-100/50' },
  { bg: 'bg-blue-50 border border-blue-100 text-blue-500 hover:bg-blue-100/20 group-hover:shadow-blue-100/50' },
  { bg: 'bg-emerald-50 border border-emerald-100 text-emerald-500 hover:bg-emerald-100/20 group-hover:shadow-emerald-100/50' },
  { bg: 'bg-violet-50 border border-violet-100 text-violet-500 hover:bg-violet-100/20 group-hover:shadow-violet-100/50' },
  { bg: 'bg-amber-50 border border-amber-100 text-amber-500 hover:bg-amber-100/20 group-hover:shadow-amber-100/50' },
  { bg: 'bg-pink-50 border border-pink-100 text-pink-500 hover:bg-pink-100/20 group-hover:shadow-pink-100/50' },
  { bg: 'bg-teal-50 border border-teal-100 text-teal-500 hover:bg-teal-100/20 group-hover:shadow-teal-100/50' },
  { bg: 'bg-indigo-50 border border-indigo-100 text-indigo-500 hover:bg-indigo-100/20 group-hover:shadow-indigo-100/50' },
  { bg: 'bg-sky-50 border border-sky-100 text-sky-500 hover:bg-sky-100/20 group-hover:shadow-sky-100/50' },
];

const getCategorySvgIcon = (name, colorClass) => {
  const n = String(name || '').toLowerCase();
  
  if (n.includes('nam') && (n.includes('thời trang') || n.includes('quần áo') || n.includes('áo') || n.includes('quần'))) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 4.5L12 7l3-2.5M4 8.5v4l3 1.5v6.5h10v-6.5l3-1.5v-4H4z" />
      </svg>
    );
  }
  if (n.includes('nữ') && (n.includes('thời trang') || n.includes('quần áo') || n.includes('đầm') || n.includes('váy'))) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.5a3 3 0 013 3v2.5L18 19H6l3-9V7.5a3 3 0 013-3z" />
      </svg>
    );
  }
  if (n.includes('điện thoại') || n.includes('gadget') || n.includes('phụ kiện điện thoại')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <rect x="6" y="3" width="12" height="18" rx="3" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="18" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (n.includes('mẹ') || n.includes('bé') || n.includes('baby')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3a9 9 0 00-9 9c0 2.21 1.79 4 4 4h10c2.21 0 4-1.79 4-4a9 9 0 00-9-9zM7 16a2 2 0 11-4 0 2 2 0 014 0zm14 0a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    );
  }
  if (n.includes('điện tử') || n.includes('audio') || n.includes('tai nghe') || n.includes('loa')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 18v-6a9 9 0 0118 0v6M3 14h3v5H3v-5zm15 0h3v5h-3v-5z" />
      </svg>
    );
  }
  if (n.includes('nhà cửa') || n.includes('đời sống') || n.includes('nội thất')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11v11a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    );
  }
  if (n.includes('máy tính') || n.includes('laptop') || n.includes('linh kiện máy tính')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16v10H4V6zm-2 14h20M9 16v4m6-4v4" />
      </svg>
    );
  }
  if (n.includes('sắc đẹp') || n.includes('mỹ phẩm') || n.includes('trang điểm') || n.includes('makeup')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8h14v8a2 2 0 01-2 2H7a2 2 0 01-2-2v-8z" />
      </svg>
    );
  }
  if (n.includes('ảnh') || n.includes('quay phim') || n.includes('camera') || n.includes('drone')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h3l2-2h4l2 2h3a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth={1.8} />
      </svg>
    );
  }
  if (n.includes('sức khỏe') || n.includes('y tế') || n.includes('thuốc')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.5 12.5l8-8a4.95 4.95 0 117 7l-8 8a4.95 4.95 0 01-7-7zM8 9l7 7" />
      </svg>
    );
  }
  if (n.includes('đồng hồ') || n.includes('watch')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth={1.8} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 10v2l1 1M12 7V3.5m0 13.5v3.5M9 7.5L6.5 6m11 0l-2.5 1.5" />
      </svg>
    );
  }
  if (n.includes('giày dép nữ') || n.includes('giày nữ') || n.includes('heels') || n.includes('cao gót')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18h9.5c.83 0 1.5-.67 1.5-1.5V6l-3.5 6H9L6 18zm11-1.5V18" />
      </svg>
    );
  }
  if (n.includes('giày dép nam') || n.includes('giày nam') || n.includes('sneakers') || n.includes('giày thể thao')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 15h11l3-5.5h3.5v3a3 3 0 01-3 3H3v-3.5z" />
      </svg>
    );
  }
  if (n.includes('túi ví nữ') || n.includes('túi nữ') || n.includes('ví nữ') || n.includes('handbag')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 10H4L5 9z" />
      </svg>
    );
  }
  if (n.includes('gia dụng') || n.includes('thiết bị điện gia dụng') || n.includes('bếp') || n.includes('quạt')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 3v4M15 3v4M8 7h8v4a4 4 0 01-4 4v5M12 15v4" />
      </svg>
    );
  }
  if (n.includes('trang sức') || n.includes('phụ kiện nử') || n.includes('nhẫn') || n.includes('vòng cổ')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 3h6l4 5-7 11-7-11 4-5zM4 8h16M9 3l3 5 3-5M9 3v5m6-5v5" />
      </svg>
    );
  }
  if (n.includes('thể thao') || n.includes('du lịch') || n.includes('dã ngoại') || n.includes('vali')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.8} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.6 9h16.8M3.6 15h16.8M12 3a15.3 15.3 0 014 9 15.3 15.3 0 01-4 9 15.3 15.3 0 01-4-9 15.3 15.3 0 014-9z" />
      </svg>
    );
  }
  if (n.includes('bách hóa') || n.includes('thực phẩm') || n.includes('grocery') || n.includes('ăn vặt')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9h18v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9zm5-5l4 5 4-5" />
      </svg>
    );
  }
  if (n.includes('ô tô') || n.includes('xe máy') || n.includes('xe đạp') || n.includes('xe điện')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H6c-.6 0-1.1.2-1.4.7C3.7 8.6 3 10 3 10S1 10.6.5 11.1C.2 11.4 0 11.8 0 12.2v3.8c0 .6.4 1 1 1h2c0 1.7 1.3 3 3 3s3-1.3 3-3h6c0 1.7 1.3 3 3 3s3-1.3 3-3zm-13 1c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm11 0c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1z" />
      </svg>
    );
  }
  if (n.includes('sách') || n.includes('văn phòng phẩm') || n.includes('stationery')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    );
  }
  if (n.includes('balo') || n.includes('ba lô') || n.includes('backpack')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 20V8a3 3 0 013-3h8a3 3 0 013 3v12H5zm7-15V3.5a1.5 1.5 0 00-3 0V5m10 9a2 2 0 11-4 0m-8 0a2 2 0 11-4 0" />
      </svg>
    );
  }
  if (n.includes('đồ chơi') || n.includes('toys') || n.includes('blocks')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4M6 6h12v12H6V6z" />
      </svg>
    );
  }
  if (n.includes('giặt giũ') || n.includes('vệ sinh') || n.includes('chăm sóc nhà cửa')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 3v4M12 3v4M16 3v4M5 7h14v11a3 3 0 01-3 3H8a3 3 0 01-3-3V7z" />
      </svg>
    );
  }
  if (n.includes('thú cưng') || n.includes('pet') || n.includes('chó') || n.includes('mèo')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14a3 3 0 110-6 3 3 0 010 6zm-5-3a2 2 0 110-4 2 2 0 010 4zm10 0a2 2 0 110-4 2 2 0 010 4zM9 19c-1 0-2-1.5-2-2.5s1.5-1.5 2-1.5m6 4c1 0 2-1.5 2-2.5s-1.5-1.5-2-1.5" />
      </svg>
    );
  }
  if (n.includes('voucher') || n.includes('dịch vụ') || n.includes('vé')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    );
  }
  if (n.includes('dụng cụ') || n.includes('thiết bị tiện ích') || n.includes('tool')) {
    return (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`w-6 h-6 ${colorClass}`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.8} />
      </svg>
    );
  }

  // Default illustration
  return (
    <svg viewBox="0 0 48 48" fill="none" className={`w-6 h-6 ${colorClass}`} xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="6" width="15" height="15" rx="3" fill="currentColor" opacity="0.8"/>
      <rect x="27" y="6" width="15" height="15" rx="3" fill="currentColor" opacity="0.5"/>
      <rect x="6" y="27" width="15" height="15" rx="3" fill="currentColor" opacity="0.5"/>
      <rect x="27" y="27" width="15" height="15" rx="3" fill="currentColor" opacity="0.8"/>
    </svg>
  );
};

const CategorySelection = () => {
  const { homepageCategories, getAllCategories } = useContext(ShopContext)
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState(0)
  const categoriesPerPage = 20

  useEffect(() => {
    getAllCategories()
  }, [getAllCategories])

  const handleCategoryClick = (categoryId) => {
    navigate(`/collection?category=${categoryId}`)
  }

  const level1Categories = homepageCategories?.categories?.filter(c => c.level === 1) || []
  const totalPages = Math.ceil(level1Categories.length / categoriesPerPage)
  const currentCategories = level1Categories.slice(
    currentPage * categoriesPerPage,
    (currentPage + 1) * categoriesPerPage
  )

  return (
    <div className="my-6 bg-white py-6 -mx-4 sm:-mx-[5vw] md:-mx-[7vw] lg:-mx-[9vw] px-4 sm:px-[5vw] md:px-[7vw] lg:px-[9vw]">
      {/* Title */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold text-gray-800">
          <Title text1={'DANH MỤC'} text2={' NỔI BẬT'}/>   
        </h2>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 0))}
              disabled={currentPage === 0}
              className="w-7 h-7 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-pink-400 hover:text-pink-650 disabled:opacity-30 transition-all duration-200"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="text-[11px] font-bold text-slate-450 uppercase tracking-widest">{currentPage + 1} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages - 1))}
              disabled={currentPage === totalPages - 1}
              className="w-7 h-7 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-pink-400 hover:text-pink-650 disabled:opacity-30 transition-all duration-200"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Categories Grid */}
      {level1Categories.length === 0 ? (
        <p className="text-xs font-semibold text-slate-400 text-center py-8">Đang tải danh mục sản phẩm...</p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-10 gap-2">
          {currentCategories.map((category, index) => {
            const color = ICON_COLORS[index % ICON_COLORS.length];
            return (
              <button
                key={category._id}
                onClick={() => handleCategoryClick(category._id)}
                className="flex flex-col items-center gap-2 px-1 py-3 rounded-2xl hover:bg-slate-50/50 transition-all duration-300 group"
              >
                {/* Icon container */}
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-md ${color.bg}`}>
                  {category.image ? (
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-7 h-7 object-contain transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    getCategorySvgIcon(category.name, 'transition-transform duration-300 group-hover:scale-110')
                  )}
                </div>
                
                {/* Category Name */}
                <span className="text-[11px] font-bold text-center text-slate-600 group-hover:text-pink-600 leading-tight line-clamp-2 w-full transition-colors duration-200 px-1">
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  )
}

export default CategorySelection
