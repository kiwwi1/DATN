// Helper functions for category-specific features

/**
 * Categories that are clothing/fashion related and should have Size attribute
 */
const CLOTHING_CATEGORY_SLUGS = [
  'thoi-trang-nam',
  'thoi-trang-nu', 
  'thoi-trang-tre-em',
  'giay-dep-nu',
  'giay-dep-nam',
  'phu-kien-trang-suc-nu'
];

/**
 * Check if a category is clothing/fashion related
 */
export const isClothingCategory = (categorySlug) => {
  if (!categorySlug) return false;
  return CLOTHING_CATEGORY_SLUGS.includes(categorySlug.toLowerCase());
};

/**
 * Get default attributes based on category
 */
export const getDefaultAttributesForCategory = (category) => {
  if (!category) return [];
  
  const categoryName = category.name?.toLowerCase() || '';
  const categorySlug = category.slug?.toLowerCase() || '';
  
  // Clothing categories - default to Size
  if (isClothingCategory(categorySlug)) {
    return [
      {
        name: 'Size',
        values: ['S', 'M', 'L', 'XL', 'XXL']
      }
    ];
  }
  
  // Electronics - Color
  if (categoryName.includes('điện thoại') || 
      categoryName.includes('máy tính') || 
      categoryName.includes('laptop') ||
      categoryName.includes('điện tử')) {
    return [
      {
        name: 'Màu sắc',
        values: ['Đen', 'Trắng', 'Xanh', 'Đỏ']
      }
    ];
  }
  
  // Bags/Accessories - Color
  if (categoryName.includes('túi') || 
      categoryName.includes('balo') ||
      categoryName.includes('ví')) {
    return [
      {
        name: 'Màu sắc',
        values: ['Đen', 'Nâu', 'Xanh', 'Đỏ']
      }
    ];
  }
  
  // Home & Living - Color/Material
  if (categoryName.includes('nhà cửa') || 
      categoryName.includes('nội thất')) {
    return [
      {
        name: 'Màu sắc',
        values: ['Trắng', 'Đen', 'Nâu', 'Xám']
      }
    ];
  }
  
  // Books - Format
  if (categoryName.includes('sách')) {
    return [
      {
        name: 'Định dạng',
        values: ['Bìa mềm', 'Bìa cứng', 'Ebook']
      }
    ];
  }
  
  // Default - Generic variant
  return [
    {
      name: 'Phân loại',
      values: ['Loại 1', 'Loại 2', 'Loại 3']
    }
  ];
};

/**
 * Common attribute presets for quick selection
 */
export const ATTRIBUTE_PRESETS = {
  size: {
    name: 'Size',
    suggestions: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  },
  color: {
    name: 'Màu sắc',
    suggestions: ['Đen', 'Trắng', 'Xanh', 'Đỏ', 'Vàng', 'Xám', 'Nâu', 'Hồng']
  },
  material: {
    name: 'Chất liệu',
    suggestions: ['Cotton', 'Polyester', 'Len', 'Da', 'Vải', 'Kim loại', 'Nhựa']
  },
  capacity: {
    name: 'Dung lượng',
    suggestions: ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB']
  },
  weight: {
    name: 'Trọng lượng',
    suggestions: ['500g', '1kg', '2kg', '5kg']
  },
  format: {
    name: 'Định dạng',
    suggestions: ['Bìa mềm', 'Bìa cứng', 'Ebook', 'Audiobook']
  },
  version: {
    name: 'Phiên bản',
    suggestions: ['Standard', 'Pro', 'Plus', 'Premium']
  },
  flavor: {
    name: 'Hương vị',
    suggestions: ['Nguyên bản', 'Sô-cô-la', 'Vani', 'Dâu', 'Cà phê']
  }
};

/**
 * Suggest attribute type based on category
 */
export const suggestAttributeType = (categoryName = '') => {
  categoryName = categoryName.toLowerCase();
  
  if (categoryName.includes('quần') || categoryName.includes('áo')) return 'size';
  if (categoryName.includes('điện thoại') || categoryName.includes('laptop')) return 'color';
  if (categoryName.includes('sách')) return 'format';
  if (categoryName.includes('thực phẩm') || categoryName.includes('đồ ăn')) return 'flavor';
  if (categoryName.includes('ổ cứng') || categoryName.includes('usb')) return 'capacity';
  
  return 'color'; // Default
};















