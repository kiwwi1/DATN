/**
 * Format price to Vietnamese currency format
 * @param {number} price - Price in VND
 * @returns {string} Formatted price string
 */
export const formatPrice = (price) => {
  if (!price && price !== 0) return "0₫";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};

/**
 * Calculate discount percentage
 * @param {number} originalPrice - Original price
 * @param {number} salePrice - Sale price
 * @returns {number} Discount percentage
 */
export const calculateDiscount = (originalPrice, salePrice) => {
  if (!originalPrice || !salePrice || originalPrice <= salePrice) return 0;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
};

/**
 * Format price with discount information
 * @param {number} price - Current price
 * @param {number} originalPrice - Original price before discount
 * @param {number} discount - Discount percentage
 * @returns {object} Formatted price information
 */
export const formatPriceWithDiscount = (price, originalPrice, discount) => {
  const hasDiscount = discount > 0 && originalPrice && originalPrice > price;

  return {
    currentPrice: formatPrice(price),
    originalPrice: hasDiscount ? formatPrice(originalPrice) : null,
    discount: hasDiscount ? discount : 0,
    hasDiscount,
  };
};
