export const normalizeSearchText = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

/**
 * Kiểm tra một sản phẩm có khớp với từ khoá tìm kiếm không.
 * Tìm trên: name, brand, vendorShopName, tags.
 */
export const matchesSearchTerm = (product, keyword) => {
  if (!keyword) return true;
  const norm = normalizeSearchText(keyword);
  if (!norm) return true;
  const tagsText = Array.isArray(product?.tags) ? product.tags.join(' ') : '';
  return (
    normalizeSearchText(product?.name).includes(norm) ||
    normalizeSearchText(product?.brand).includes(norm) ||
    normalizeSearchText(product?.vendorShopName).includes(norm) ||
    normalizeSearchText(tagsText).includes(norm)
  );
};

/**
 * Wrap phần khớp trong chuỗi `text` bằng thẻ <mark> để highlight.
 * Trả về mảng React-renderable gồm string và <mark> elements.
 * Dùng trong JSX: {highlightMatch(text, keyword)}
 */
export const highlightMatch = (text, keyword) => {
  const str = String(text || '');
  const norm = normalizeSearchText(keyword);
  if (!norm || !str) return [str];

  // Tìm vị trí trong chuỗi gốc bằng cách so sánh normalized
  const normStr = normalizeSearchText(str);
  const idx = normStr.indexOf(norm);
  if (idx === -1) return [str];

  return [
    str.slice(0, idx),
    { __highlight: true, text: str.slice(idx, idx + norm.length), key: idx },
    str.slice(idx + norm.length),
  ];
};

