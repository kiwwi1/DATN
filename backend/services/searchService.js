import mongoose from 'mongoose';
import productModel from '../models/productModel.js';
import userInteractionModel from '../models/userInteractionModel.js';
import searchAnalyticsModel from '../models/searchAnalyticsModel.js';

// Weights cho công thức tính điểm liên quan
const SCORE_WEIGHTS = {
    textScore: 0.4,   // Độ khớp từ khoá (MongoDB $text)
    sales: 0.3,       // Độ phổ biến (sold)
    rating: 0.2,      // Chất lượng (rating)
    personal: 0.1,    // Cá nhân hoá (interaction history)
};

/**
 * Normalize dấu tiếng Việt để tìm kiếm không dấu
 */
const normalizeText = (text = '') =>
    String(text)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');

/**
 * Tìm kiếm sản phẩm server-side với relevance scoring + personalization
 * @param {object} options
 * @param {string} options.q - Từ khoá tìm kiếm
 * @param {number} options.page - Trang (bắt đầu từ 1)
 * @param {number} options.limit - Số SP/trang (max 50)
 * @param {string} [options.userId] - ID user để personalize
 * @param {string} [options.categoryId] - Lọc theo category
 * @param {number} [options.minPrice] - Giá tối thiểu
 * @param {number} [options.maxPrice] - Giá tối đa
 * @param {string} [options.sort] - relevant | newest | bestsell | lowToHigh | highToLow
 */
export const searchProductsService = async ({
    q = '',
    page = 1,
    limit = 20,
    userId,
    categoryId,
    minPrice,
    maxPrice,
    sort = 'relevant',
}) => {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    // --- Build base filter ---
    const baseFilter = { isActive: true };
    if (categoryId && mongoose.isValidObjectId(categoryId)) {
        baseFilter.$or = [
            { category: categoryId },
            { subCategory: categoryId },
            { subSubCategory: categoryId },
        ];
    }
    if (minPrice !== undefined && minPrice !== '') baseFilter.price = { ...(baseFilter.price || {}), $gte: Number(minPrice) };
    if (maxPrice !== undefined && maxPrice !== '') baseFilter.price = { ...(baseFilter.price || {}), $lte: Number(maxPrice) };

    const keyword = q.trim();

    // --- Nếu không có từ khoá: trả về danh sách thường ---
    if (!keyword) {
        const sortObj = _buildSortObject(sort, false);
        const [total, products] = await Promise.all([
            productModel.countDocuments(baseFilter),
            productModel.find(baseFilter).sort(sortObj).skip(skip).limit(limitNum).lean(),
        ]);
        return { products, total, page: pageNum, totalPages: Math.ceil(total / limitNum) };
    }

    // --- Chiến lược tìm kiếm kép ---
    // Phase 1: $text search (nhanh, có weight: name×10, brand×5, tags×3)
    const textFilter = { ...baseFilter, $text: { $search: keyword } };
    const textMatches = await productModel
        .find(textFilter, { score: { $meta: 'textScore' } })
        .lean();

    // Phase 2: $regex fallback — bắt partial match & từ không dấu
    const normalizedKeyword = normalizeText(keyword);
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexPattern = new RegExp(escapeRegex(keyword), 'i');
    const regexNormPattern = new RegExp(escapeRegex(normalizedKeyword), 'i');

    const textIds = new Set(textMatches.map((p) => String(p._id)));
    const regexMatches = await productModel
        .find({
            ...baseFilter,
            _id: { $nin: [...textIds].map((id) => new mongoose.Types.ObjectId(id)) },
            $or: [
                { name: regexPattern },
                { name: regexNormPattern },
                { brand: regexPattern },
                { vendorShopName: regexPattern },
            ],
        })
        .lean();

    // Gắn textScore=0 cho regex-only results
    const allMatches = [
        ...textMatches,
        ...regexMatches.map((p) => ({ ...p, score: 0 })),
    ];

    const total = allMatches.length;
    if (total === 0) {
        await _trackQuery(keyword);
        return { products: [], total: 0, page: pageNum, totalPages: 0 };
    }

    // --- Nếu sort không phải relevant: sort đơn giản, không cần scoring ---
    if (sort !== 'relevant') {
        const sortFn = _buildJsSortFn(sort);
        const sorted = allMatches.sort(sortFn);
        await _trackQuery(keyword);
        return {
            products: sorted.slice(skip, skip + limitNum),
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
        };
    }

    // --- Relevant sort: tính điểm tổng hợp ---
    // Lấy interaction scores của user (nếu đã đăng nhập)
    let personalScores = {};
    if (userId && mongoose.isValidObjectId(userId)) {
        const interactions = await userInteractionModel
            .find({
                userId: new mongoose.Types.ObjectId(userId),
                productId: { $in: allMatches.map((p) => p._id) },
            })
            .select('productId interactionScore')
            .lean();

        const maxInteraction = Math.max(...interactions.map((i) => i.interactionScore || 0), 1);
        for (const i of interactions) {
            personalScores[String(i.productId)] = (i.interactionScore || 0) / maxInteraction;
        }
    }

    // Chuẩn hoá: tìm giá trị max để normalize về [0, 1]
    const maxSold = Math.max(...allMatches.map((p) => p.sold || 0), 1);
    const maxTextScore = Math.max(...allMatches.map((p) => p.score || 0), 1);

    // Tính finalScore cho từng sản phẩm
    const scored = allMatches.map((p) => {
        const normText = (p.score || 0) / maxTextScore;
        const normSales = (p.sold || 0) / maxSold;
        const normRating = (p.rating || 0) / 5;
        const boost = personalScores[String(p._id)] || 0;

        const finalScore =
            normText * SCORE_WEIGHTS.textScore +
            normSales * SCORE_WEIGHTS.sales +
            normRating * SCORE_WEIGHTS.rating +
            boost * SCORE_WEIGHTS.personal;

        return { ...p, _finalScore: finalScore };
    });

    scored.sort((a, b) => b._finalScore - a._finalScore);

    await _trackQuery(keyword);

    return {
        products: scored.slice(skip, skip + limitNum),
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
    };
};

/**
 * Autocomplete: kết hợp $text (nhanh, có weight) + $regex prefix (bắt partial)
 */
export const getAutocompleteService = async (q, limit = 6) => {
    const keyword = q?.trim();
    if (!keyword || keyword.length < 1) return [];

    const limitNum = Math.min(10, parseInt(limit) || 6);
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexPattern = new RegExp(escapeRegex(keyword), 'i');

    const projection = { name: 1, image: 1, price: 1, sold: 1, rating: 1, brand: 1 };

    const [textResults, regexResults] = await Promise.all([
        productModel
            .find({ $text: { $search: keyword }, isActive: true }, { ...projection, score: { $meta: 'textScore' } })
            .sort({ score: { $meta: 'textScore' } })
            .limit(limitNum)
            .lean(),
        productModel
            .find({ name: regexPattern, isActive: true }, projection)
            .sort({ sold: -1 })
            .limit(limitNum)
            .lean(),
    ]);

    // Merge, dedup bằng _id
    const seen = new Set(textResults.map((p) => String(p._id)));
    const merged = [...textResults];
    for (const p of regexResults) {
        if (!seen.has(String(p._id))) {
            merged.push(p);
            seen.add(String(p._id));
            if (merged.length >= limitNum) break;
        }
    }

    return merged.slice(0, limitNum);
};

/**
 * Trending: top queries được search nhiều nhất
 */
export const getTrendingSearchesService = async (limit = 8) => {
    return searchAnalyticsModel
        .find({})
        .sort({ count: -1, lastSearched: -1 })
        .limit(Math.min(20, parseInt(limit) || 8))
        .select('query count -_id')
        .lean();
};

// ── Helpers ────────────────────────────────────────────────────────────────

const _buildSortObject = (sort, hasText) => {
    switch (sort) {
        case 'newest': return { date: -1 };
        case 'bestsell': return { sold: -1 };
        case 'lowToHigh': return { price: 1 };
        case 'highToLow': return { price: -1 };
        default: return hasText ? { score: { $meta: 'textScore' } } : { date: -1 };
    }
};

const _buildJsSortFn = (sort) => {
    switch (sort) {
        case 'newest': return (a, b) => (b.date || 0) - (a.date || 0);
        case 'bestsell': return (a, b) => (b.sold || 0) - (a.sold || 0);
        case 'lowToHigh': return (a, b) => a.price - b.price;
        case 'highToLow': return (a, b) => b.price - a.price;
        default: return (a, b) => (b.score || 0) - (a.score || 0);
    }
};

const _trackQuery = async (keyword) => {
    try {
        const normalized = normalizeText(keyword);
        if (!normalized) return;
        await searchAnalyticsModel.findOneAndUpdate(
            { query: normalized },
            { $inc: { count: 1 }, $set: { lastSearched: new Date() } },
            { upsert: true, new: false }
        );
    } catch { /* fire-and-forget, không block response */ }
};
