import axios from 'axios';

const BASE = import.meta.env.VITE_BACKEND_URL;

/**
 * Tìm kiếm sản phẩm server-side với relevance scoring + personalization
 * @param {object} params
 * @param {string} params.q
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} [params.userId]
 * @param {string} [params.categoryId]
 * @param {number} [params.minPrice]
 * @param {number} [params.maxPrice]
 * @param {string} [params.sort] - relevant | newest | bestsell | lowToHigh | highToLow
 * @param {AbortSignal} [params.signal]
 */
export const searchProductsApi = async ({
    q,
    page = 1,
    limit = 20,
    userId,
    categoryId,
    minPrice,
    maxPrice,
    sort = 'relevant',
    signal,
} = {}) => {
    const params = { q, page, limit, sort };
    if (userId) params.userId = userId;
    if (categoryId) params.categoryId = categoryId;
    if (minPrice !== null && minPrice !== undefined && minPrice !== '') params.minPrice = minPrice;
    if (maxPrice !== null && maxPrice !== undefined && maxPrice !== '') params.maxPrice = maxPrice;

    const { data } = await axios.get(`${BASE}/api/search`, { params, signal });
    return data; // { success, products, total, page, totalPages }
};

/**
 * Gợi ý autocomplete khi user đang gõ
 * @param {string} q - Từ khoá đang gõ
 * @param {number} [limit=6]
 * @param {AbortSignal} [signal]
 */
export const autocompleteApi = async (q, limit = 6, signal) => {
    const { data } = await axios.get(`${BASE}/api/search/autocomplete`, {
        params: { q, limit },
        signal,
    });
    return data.products || []; // array of product objects
};

/**
 * Lấy danh sách từ khoá tìm kiếm phổ biến
 * @param {number} [limit=8]
 */
export const getTrendingSearchesApi = async (limit = 8) => {
    const { data } = await axios.get(`${BASE}/api/search/trending`, { params: { limit } });
    return data.queries || []; // [{ query, count }]
};
