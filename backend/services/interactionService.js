import userInteractionModel from "../models/userInteractionModel.js";
import productModel from "../models/productModel.js";
import { getRedisClient } from "../config/redis.js";

const ALLOWED_INTERACTIONS = new Set([
    "purchased",
    "rated",
    "reviewed",
    "addedToCart",
    "wishlisted",
    "viewed",
    "clicked",
    "searched",
    "timeSpent",
]);
const BOOLEAN_INTERACTIONS = new Set(["reviewed", "wishlisted"]);
const HIGH_SIGNAL_INTERACTIONS = new Set(["purchased", "addedToCart", "wishlisted", "rated", "reviewed"]);

const REC_CACHE_TTL_SEC = 300;
const REDIS_PREFIX = process.env.REDIS_PREFIX ?? "datn";

const DECAY_TIME_CONSTANT_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Lấy rộng hơn số dùng thực để việc re-rank sau suy hao không bị bó theo
// thứ tự index (index sort theo điểm đã lưu, chưa nhân suy hao).
const TOP_INTERACTIONS_FETCH = 15;
const TOP_INTERACTIONS_USE = 5;

// Suy hao "lười" tại thời điểm đọc: điểm lưu trong DB là điểm chốt tại lần
// tương tác cuối; nhân e^(-Δt/30) để quy mọi bản ghi về cùng mốc hiện tại
// trước khi so sánh/xếp hạng (Δt tính đến "thời điểm tính toán").
export const applyTimeDecay = (interactionScore, lastInteraction, now = Date.now()) => {
    const lastMs = new Date(lastInteraction || 0).getTime();
    if (!Number.isFinite(lastMs) || lastMs <= 0) return 0;
    const days = Math.max(0, (now - lastMs) / MS_PER_DAY);
    return (Number(interactionScore) || 0) * Math.exp(-days / DECAY_TIME_CONSTANT_DAYS);
};

// Top tương tác của một user sau khi đã áp suy hao thời gian.
const getTopDecayedInteractions = async (userId) => {
    const interactions = await userInteractionModel
        .find({ userId })
        .sort({ interactionScore: -1 })
        .limit(TOP_INTERACTIONS_FETCH)
        .lean();

    const now = Date.now();
    return interactions
        .map((interaction) => ({
            ...interaction,
            decayedScore: applyTimeDecay(interaction.interactionScore, interaction.lastInteraction, now),
        }))
        .filter((interaction) => interaction.decayedScore > 0)
        .sort((a, b) => b.decayedScore - a.decayedScore)
        .slice(0, TOP_INTERACTIONS_USE);
};

const normalizeLimit = (limit) => {
    return Number.isFinite(limit) && limit > 0 ? limit : null;
};

const normalizeNumericValue = (value) => {
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) return 1;
    return Math.max(0, parsedValue);
};

// Cosine similarity between two sparse vectors (plain objects: { id: score })
const cosineSimilarity = (vecA, vecB) => {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (const [key, a] of Object.entries(vecA)) {
        normA += a * a;
        if (vecB[key] !== undefined) dot += a * vecB[key];
    }
    for (const b of Object.values(vecB)) normB += b * b;
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

// ─── Cache helpers ─────────────────────────────────────────────────────────

const recCacheKey = (userId, limit) =>
    `${REDIS_PREFIX}:rec:${userId}:${limit ?? "all"}`;

const invalidateUserRecCache = async (userId) => {
    const redis = getRedisClient();
    if (!redis) return;
    try {
        const pattern = `${REDIS_PREFIX}:rec:${userId}:*`;
        let cursor = 0;
        const keys = [];
        do {
            const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 50 });
            cursor = result.cursor;
            keys.push(...result.keys);
        } while (cursor !== 0);
        if (keys.length > 0) await redis.del(keys);
    } catch {
        // cache invalidation failure is non-fatal
    }
};

// ─── Interaction update ────────────────────────────────────────────────────

const buildInteractionUpdate = (interactionType, value) => {
    if (BOOLEAN_INTERACTIONS.has(interactionType)) {
        return {
            $set: {
                [`interactions.${interactionType}`]: true,
                lastInteraction: new Date(),
            },
        };
    }

    return {
        $inc: { [`interactions.${interactionType}`]: normalizeNumericValue(value) },
        $set: { lastInteraction: new Date() },
    };
};

const incrementInteraction = async (userId, productId, interactionType, value, useUpsert) => {
    const update = buildInteractionUpdate(interactionType, value);

    return userInteractionModel.findOneAndUpdate(
        { userId, productId },
        update,
        { upsert: useUpsert, new: true }
    );
};

// ─── Content-based filtering ───────────────────────────────────────────────

const getContentBasedRecs = async (userId, limit) => {
    const normalizedLimit = normalizeLimit(limit);

    const interactions = await getTopDecayedInteractions(userId);

    if (interactions.length === 0) return [];

    const seenProductIds = interactions.map((i) => i.productId);
    const topProducts = await productModel
        .find({ _id: { $in: seenProductIds } })
        .select("category subCategory brand tags")
        .lean();

    const categoryIds = [...new Set(
        topProducts.flatMap((p) => [p.category, p.subCategory].filter(Boolean).map(String))
    )];
    const brands = [...new Set(topProducts.map((p) => p.brand).filter(Boolean))];
    const tags = [...new Set(
        topProducts.flatMap((p) => (Array.isArray(p.tags) ? p.tags : [])).filter(Boolean)
    )];

    const orConditions = [
        { category: { $in: categoryIds } },
        { subCategory: { $in: categoryIds } },
    ];
    if (brands.length > 0) orConditions.push({ brand: { $in: brands } });
    if (tags.length > 0) orConditions.push({ tags: { $in: tags } });

    const query = productModel.find({
        $or: orConditions,
        _id: { $nin: seenProductIds },
        isActive: true,
    }).sort({ sold: -1, rating: -1 });

    if (normalizedLimit) query.limit(normalizedLimit);
    return query.lean();
};

// ─── Collaborative filtering (user-based with cosine similarity) ───────────

const getItemBasedRecs = async (userId, limit) => {
    const normalizedLimit = normalizeLimit(limit);

    const userInteractions = await getTopDecayedInteractions(userId);

    if (userInteractions.length === 0) return [];

    const userProductIds = userInteractions.map((i) => i.productId);

    // Build target user's sparse interaction vector
    const userVector = {};
    for (const interaction of userInteractions) {
        userVector[interaction.productId.toString()] = interaction.decayedScore;
    }

    // Find candidate users who have interacted with the same products
    // and collect their scores on those shared products
    const candidateData = await userInteractionModel.aggregate([
        {
            $match: {
                productId: { $in: userProductIds },
                userId: { $ne: userId },
                interactionScore: { $gt: 0 },
            }
        },
        {
            $group: {
                _id: "$userId",
                sharedScores: {
                    $push: {
                        productId: "$productId",
                        score: "$interactionScore",
                        lastInteraction: "$lastInteraction",
                    }
                },
            }
        },
        { $limit: 50 },
    ]);

    if (candidateData.length === 0) return [];

    const now = Date.now();

    // Compute cosine similarity between target user and each candidate
    // over their shared interaction space
    const similarities = candidateData
        .map((candidate) => {
            const candidateVector = {};
            for (const { productId, score, lastInteraction } of candidate.sharedScores) {
                candidateVector[productId.toString()] = applyTimeDecay(score, lastInteraction, now);
            }
            return {
                userId: candidate._id,
                similarity: cosineSimilarity(userVector, candidateVector),
            };
        })
        .filter((c) => c.similarity > 0)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 20);

    if (similarities.length === 0) return [];

    const similarityMap = new Map(
        similarities.map((c) => [c.userId.toString(), c.similarity])
    );
    const similarUserIds = similarities.map((c) => c.userId);

    // Collect products from similar users that the target user hasn't seen
    const candidateInteractions = await userInteractionModel.find({
        userId: { $in: similarUserIds },
        productId: { $nin: userProductIds },
        interactionScore: { $gt: 0 },
    }).lean();

    // Weight each product's score by the recommending user's cosine similarity
    const productScores = {};
    for (const interaction of candidateInteractions) {
        const pid = interaction.productId.toString();
        const sim = similarityMap.get(interaction.userId.toString()) || 0;
        const decayedScore = applyTimeDecay(interaction.interactionScore, interaction.lastInteraction, now);
        productScores[pid] = (productScores[pid] || 0) + decayedScore * sim;
    }

    const rankedProductIds = Object.entries(productScores)
        .sort(([, a], [, b]) => b - a)
        .map(([pid]) => pid);

    const topProductIds = normalizedLimit
        ? rankedProductIds.slice(0, normalizedLimit)
        : rankedProductIds;

    if (topProductIds.length === 0) return [];

    const products = await productModel.find({
        _id: { $in: topProductIds },
        isActive: true,
    }).lean();

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    return topProductIds.map((pid) => productMap.get(pid)).filter(Boolean);
};

// ─── Public API ────────────────────────────────────────────────────────────

export const trackInteractionService = async (userId, productId, interactionType, value = 1) => {
    if (!userId || !productId) {
        throw Object.assign(new Error("userId and productId are required"), { status: 400 });
    }
    if (!ALLOWED_INTERACTIONS.has(interactionType)) {
        throw Object.assign(new Error("Invalid interaction type"), { status: 400 });
    }

    let updated;
    try {
        updated = await incrementInteraction(userId, productId, interactionType, value, true);
    } catch (err) {
        if (err.code === 11000) {
            updated = await incrementInteraction(userId, productId, interactionType, value, false);
        } else {
            throw err;
        }
    }

    const score = updated.calculateScore();
    await userInteractionModel.updateOne(
        { _id: updated._id },
        { $set: { interactionScore: score, decayFactor: updated.decayFactor } }
    );

    // Only invalidate recommendation cache for high-signal interactions.
    // Low-signal events (viewed, clicked, searched, timeSpent) shift scores
    // only marginally and would thrash the cache during active browsing sessions.
    if (HIGH_SIGNAL_INTERACTIONS.has(interactionType)) {
        await invalidateUserRecCache(String(userId));
    }

    return score;
};

export const getRecommendationsService = async (userId, limit = null) => {
    const normalizedLimit = normalizeLimit(limit);

    // Serve from cache if available
    const redis = getRedisClient();
    const cacheKey = recCacheKey(userId, normalizedLimit);
    if (redis) {
        try {
            const cached = await redis.get(cacheKey);
            if (cached) return JSON.parse(cached);
        } catch {
            // cache read failure — proceed to compute
        }
    }

    const half = normalizedLimit ? Math.ceil(normalizedLimit / 2) : null;

    const [cfRecs, contentRecs] = await Promise.all([
        getItemBasedRecs(userId, half),
        getContentBasedRecs(userId, normalizedLimit),
    ]);

    const seen = new Set();
    const result = [];

    for (const p of [...cfRecs, ...contentRecs]) {
        if (normalizedLimit && result.length >= normalizedLimit) break;
        const id = p._id.toString();
        if (!seen.has(id)) {
            seen.add(id);
            result.push(p);
        }
    }

    if (!normalizedLimit || result.length < normalizedLimit) {
        const excludeIds = result.map((p) => p._id);
        const fallbackQuery = productModel.find({
            _id: { $nin: excludeIds },
            isActive: true,
        }).sort({ sold: -1, rating: -1, date: -1 });

        if (normalizedLimit) {
            fallbackQuery.limit(normalizedLimit - result.length);
        }

        const fallback = await fallbackQuery.lean();
        result.push(...fallback);
    }

    // Store in cache
    if (redis) {
        try {
            await redis.setEx(cacheKey, REC_CACHE_TTL_SEC, JSON.stringify(result));
        } catch {
            // cache write failure is non-fatal
        }
    }

    return result;
};

export const getWishlistService = async (userId) => {
    const items = await userInteractionModel
        .find({ userId, "interactions.wishlisted": true })
        .select("productId")
        .lean();

    if (items.length === 0) return [];

    const productIds = items.map((i) => i.productId);
    return productModel.find({ _id: { $in: productIds }, isActive: true }).lean();
};

export const toggleWishlistService = async (userId, productId) => {
    const existing = await userInteractionModel.findOne({ userId, productId });
    const nextState = !(existing?.interactions?.wishlisted ?? false);

    await userInteractionModel.findOneAndUpdate(
        { userId, productId },
        {
            $set: { "interactions.wishlisted": nextState, lastInteraction: new Date() },
        },
        { upsert: true }
    );

    await invalidateUserRecCache(String(userId));
    return nextState;
};
