import React, { useEffect, useState, useCallback } from 'react'
import { useContext } from 'react';
import { ShopContext } from '../context/ShopContext';
import { assets } from '../assets/assets';
import Title from '../components/Title';
import ProductItem from '../components/ProductItem';
import { useSearchParams } from 'react-router-dom';

const Collection = () => {
  const {products, search, showSearch, homepageCategories} = useContext(ShopContext);
  const [searchParams] = useSearchParams();
  const [showFilter, _setShowFilter] = useState(false);
  const [filterProducts, setFilterProducts] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [sortType, setSortType] = useState('relevant');
  const [currentMainCategory, setCurrentMainCategory] = useState(null);
  const [subCategories, setSubCategories] = useState([]);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Function to get all children category IDs recursively
  const getAllChildrenCategoryIds = useCallback((categoryId) => {
    if (!homepageCategories?.categories) return [categoryId];
    
    const allIds = [categoryId];
    const findChildren = (parentId) => {
      const children = homepageCategories.categories.filter(cat => {
        // parentCategory có thể là object (populated) hoặc string (ID)
        const catParentId = typeof cat.parentCategory === 'object' 
          ? cat.parentCategory?._id 
          : cat.parentCategory;
        return catParentId === parentId;
      });
      children.forEach(child => {
        allIds.push(child._id);
        findChildren(child._id); // Recursive call for nested children
      });
    };
    
    findChildren(categoryId);
    return allIds;
  }, [homepageCategories]);

  // Get direct children of a category
  const getDirectChildren = useCallback((categoryId) => {
    if (!homepageCategories?.categories) return [];
    return homepageCategories.categories.filter(cat => {
      // parentCategory có thể là object (populated) hoặc string (ID)
      const parentId = typeof cat.parentCategory === 'object' 
        ? cat.parentCategory?._id 
        : cat.parentCategory;
      return parentId === categoryId;
    });
  }, [homepageCategories]);

  // Check URL parameter for category filter
  useEffect(() => {
    const categoryFromUrl = searchParams.get('category');
    if (categoryFromUrl && homepageCategories?.categories) {
      console.log('🔍 Category from URL:', categoryFromUrl);
      console.log('📦 All categories:', homepageCategories.categories);
      
      setCurrentMainCategory(categoryFromUrl);
      
      // Get all level 2 subcategories (direct children of the selected category)
      const children = getDirectChildren(categoryFromUrl);
      console.log('👶 Direct children found:', children);
      setSubCategories(children);
      
      // Initially select all: main category + all its children (recursive)
      const allCategoryIds = getAllChildrenCategoryIds(categoryFromUrl);
      console.log('🎯 All category IDs (recursive):', allCategoryIds);
      setSelectedCategories(allCategoryIds);
    } else {
      setCurrentMainCategory(null);
      setSubCategories([]);
      setSelectedCategories([]);
    }
  }, [searchParams, homepageCategories, getAllChildrenCategoryIds, getDirectChildren]);

  // Toggle subcategory selection
  const toggleSubCategory = (subcategoryId) => {
    setSelectedCategories(prev => {
      // Get all children IDs of this subcategory
      const childrenIds = getAllChildrenCategoryIds(subcategoryId);
      
      // Check if this subcategory is currently selected
      if (prev.includes(subcategoryId)) {
        // Remove this subcategory and all its children
        return prev.filter(id => !childrenIds.includes(id));
      } else {
        // Add this subcategory and all its children
        return [...prev, ...childrenIds];
      }
    });
  };
  
  const sortProducts = () => {
    let productscopy = products.slice();
    
    // Get search term from URL or from context
    const searchFromUrl = searchParams.get('search');
    const searchTerm = searchFromUrl || search;
    
    // Apply search filter (by name, brand, or shop name)
    if((showSearch || searchFromUrl) && searchTerm){
      productscopy = productscopy.filter((item)=> {
        const searchLower = searchTerm.toLowerCase();
        const nameMatch = item.name?.toLowerCase().includes(searchLower);
        const brandMatch = item.brand?.toLowerCase().includes(searchLower);
        const shopMatch = item.vendorShopName?.toLowerCase().includes(searchLower);
        return nameMatch || brandMatch || shopMatch;
      });
    }
    
    // Apply category filter
    if(selectedCategories.length > 0){
      productscopy = productscopy.filter((item)=> 
        selectedCategories.includes(item.category) ||
        selectedCategories.includes(item.subCategory) ||
        selectedCategories.includes(item.subSubCategory)
      );
    }

    // Then apply sorting
    switch(sortType){
      case 'lowToHigh':
        setFilterProducts(productscopy.sort((a,b)=> a.price - b.price));
        break;
      case 'highToLow':
        setFilterProducts(productscopy.sort((a,b)=> b.price - a.price));
        break;
      default:
        setFilterProducts(productscopy);
        break;
    }
  };
  
  useEffect(() => {
    sortProducts();
    setCurrentPage(1); // Reset to page 1 when filters change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[selectedCategories, search, showSearch, products, sortType, searchParams])

  // Calculate pagination
  const totalPages = Math.ceil(filterProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filterProducts.slice(startIndex, endIndex);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);
  
  return (
    <div className='flex flex-col sm:flex-row gap-1 sm:gap-10 pt-10 border-t'>
        {/* Filter side */}
        <div className='min-w-60'>
        <p className='my-2 text-xl flex items-center cursor-pointer gap-2'>FILTERS
            <img className={`h-3 sm:hidden ${showFilter ? 'rotate-90' : ''}`} src={assets.dropdown_icon}/>
        </p>
        {/* Subcategories filter - Only show if a main category is selected */}
        {currentMainCategory && subCategories.length > 0 && (
          <div className={`border border-gray-300 pl-5 py-3 mt-6 ${showFilter ? '' : 'hidden'} sm:block max-h-96 overflow-y-auto`}>
            <div className='flex justify-between items-center mb-3'>
              <p className='text-sm font-medium text-gray-800 uppercase'>Danh Mục Con</p>
              {selectedCategories.length > 0 && (
                <button 
                  onClick={() => setSelectedCategories([])}
                  className='text-xs text-blue-600 hover:text-blue-800 underline'
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
            <div className='flex flex-col gap-2.5 text-sm text-gray-700'>
              {/* All categories option */}
              <label className='flex gap-2 items-center cursor-pointer hover:text-blue-600 transition-colors group'>
                <input 
                  className='w-4 h-4 cursor-pointer accent-blue-600' 
                  type="checkbox" 
                  checked={selectedCategories.includes(currentMainCategory)}
                  onChange={() => {
                    const allCategoryIds = getAllChildrenCategoryIds(currentMainCategory);
                    setSelectedCategories(allCategoryIds);
                  }}
                />
                <span className='font-semibold text-gray-800 group-hover:text-blue-600'>
                  ✓ Tất cả danh mục
                </span>
              </label>
              
              <hr className='my-1' />
              
              {/* Individual subcategories */}
              {subCategories.map((subCat) => {
                const productCount = products.filter(p => 
                  p.category === subCat._id || 
                  p.subCategory === subCat._id || 
                  p.subSubCategory === subCat._id
                ).length;
                
                return (
                  <label key={subCat._id} className='flex gap-2 items-center cursor-pointer hover:text-blue-600 transition-colors group'>
                    <input 
                      className='w-4 h-4 cursor-pointer accent-blue-600' 
                      type="checkbox" 
                      checked={selectedCategories.includes(subCat._id)}
                      onChange={() => toggleSubCategory(subCat._id)}
                    />
                    <span className='flex-1 group-hover:translate-x-1 transition-transform'>
                      {subCat.name}
                    </span>
                    {productCount > 0 && (
                      <span className='text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full'>
                        {productCount}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Message when no category selected */}
        {!currentMainCategory && (
          <div className={`border border-gray-300 pl-5 py-3 mt-6 ${showFilter ? '' : 'hidden'} sm:block`}>
            <p className='mb-2 text-sm font-medium text-gray-800 uppercase'>Bộ Lọc</p>
            <div className='text-sm text-gray-500 italic py-3 bg-gray-50 -ml-5 -mr-5 px-5 rounded'>
              <p className='flex items-center gap-2'>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <span>Chọn một danh mục để xem bộ lọc chi tiết</span>
              </p>
            </div>
          </div>
        )}


        </div>
        {/* right side */}
        <div className='flex-1'>
          <div className='flex justify-between items-start mb-4'>
            <div>
              {searchParams.get('search') ? (
                <>
                  <Title text1={'KẾT QUẢ TÌM KIẾM'} text2='' />
                  <p className='text-sm text-gray-600 mt-1'>
                    Tìm kiếm cho: <span className='font-medium text-blue-600'>"{searchParams.get('search')}"</span>
                  </p>
                  <p className='text-sm text-gray-500 mt-1'>
                    Hiển thị {filterProducts.length} sản phẩm
                  </p>
                </>
              ) : currentMainCategory ? (
                <>
                  <Title 
                    text1={homepageCategories?.categories?.find(cat => cat._id === currentMainCategory)?.name || 'DANH MỤC'} 
                    text2=''
                  />
                  <p className='text-sm text-gray-500 mt-1'>
                    Hiển thị {filterProducts.length} sản phẩm
                  </p>
                </>
              ) : (
                <>
                  <Title text1={'TẤT CẢ'} text2={' SẢN PHẨM'}/>
                  <p className='text-sm text-gray-500 mt-1'>
                    Hiển thị {filterProducts.length} sản phẩm
                  </p>
                </>
              )}
            </div>
            {/* Sort product */}
            <select onChange={(e)=>setSortType(e.target.value)} className='border-2 border-gray-700 text-sm px-2 py-1 rounded'>
              <option value="relavent">Sắp xếp: Liên quan</option>
              <option value="lowToHigh">Sắp xếp: Giá thấp đến cao</option>
              <option value="highToLow">Sắp xếp: Giá cao đến thấp</option>
            </select>
          </div>
          {/* Map products */}
          {filterProducts.length > 0 ? (
            <>
              <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 gap-y-6 '>
                {
                  currentProducts.map((item,index) => (
                    <ProductItem 
                      key={index} 
                      id={item._id} 
                      image={item.image} 
                      name={item.name} 
                      price={item.price}
                      originalPrice={item.originalPrice}
                      discount={item.discount}
                      rating={item.rating}
                      sold={item.sold}
                    />
                  ))
                }
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className='flex justify-center items-center gap-2 mt-12 mb-8'>
                  {/* Previous Button */}
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-orange-500 hover:text-orange-600'
                    }`}
                  >
                    ← Trước
                  </button>

                  {/* Page Numbers */}
                  <div className='flex gap-2'>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                      // Show first page, last page, current page, and pages around current
                      const showPage = page === 1 || 
                                      page === totalPages || 
                                      (page >= currentPage - 1 && page <= currentPage + 1);
                      
                      const showEllipsisBefore = page === currentPage - 2 && currentPage > 3;
                      const showEllipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;

                      if (showEllipsisBefore || showEllipsisAfter) {
                        return <span key={page} className='px-2 text-gray-400'>...</span>;
                      }

                      if (!showPage) return null;

                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-10 h-10 rounded-lg font-medium transition-all ${
                            currentPage === page
                              ? 'bg-orange-600 text-white shadow-lg'
                              : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-orange-500 hover:text-orange-600'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-orange-500 hover:text-orange-600'
                    }`}
                  >
                    Sau →
                  </button>
                </div>
              )}

              {/* Page Info */}
              {totalPages > 1 && (
                <div className='text-center text-sm text-gray-600 mb-8'>
                  Trang {currentPage} / {totalPages} (Hiển thị {startIndex + 1}-{Math.min(endIndex, filterProducts.length)} trong tổng số {filterProducts.length} sản phẩm)
                </div>
              )}
            </>
          ) : (
            <div className='flex flex-col items-center justify-center py-20 text-gray-500'>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              <p className='text-lg font-medium mb-2'>Không tìm thấy sản phẩm</p>
              <p className='text-sm text-center max-w-md'>
                Không có sản phẩm nào phù hợp với bộ lọc của bạn. Hãy thử thay đổi bộ lọc hoặc tìm kiếm khác.
              </p>
              {selectedCategories.length > 0 && (
                <button 
                  onClick={() => {
                    const allCategoryIds = getAllChildrenCategoryIds(currentMainCategory);
                    setSelectedCategories(allCategoryIds);
                  }}
                  className='mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
                >
                  Xem tất cả sản phẩm
                </button>
              )}
            </div>
          )}

        </div>

    </div>
  )
}

export default Collection