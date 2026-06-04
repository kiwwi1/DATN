import {
    searchProductsService,
    getAutocompleteService,
    getTrendingSearchesService,
} from '../services/searchService.js';

/**
 * GET /api/search
 * Query params: q, page, limit, userId, categoryId, minPrice, maxPrice, sort
 */
export const searchProducts = async (req, res) => {
    try {
        const { q, page, limit, userId, categoryId, minPrice, maxPrice, sort } = req.query;
        const result = await searchProductsService({ q, page, limit, userId, categoryId, minPrice, maxPrice, sort });
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/search/autocomplete
 * Query params: q, limit
 */
export const autocomplete = async (req, res) => {
    try {
        const { q, limit } = req.query;
        const products = await getAutocompleteService(q, limit);
        res.json({ success: true, products });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/search/trending
 * Query params: limit
 */
export const getTrending = async (req, res) => {
    try {
        const { limit } = req.query;
        const queries = await getTrendingSearchesService(limit);
        res.json({ success: true, queries });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};
