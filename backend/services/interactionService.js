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

const REC_CACHE_TTL_SEC = 300;
const REDIS_PREFIX = process.env.REDIS_PREFIX ?? "datn";

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

    const interactions = await userInteractionModel
        .find({ userId })
        .sort({ interactionScore: -1 })
        .limit(5)
        .lean();

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

    const userInteractions = await userInteractionModel
        .find({ userId })
        .sort({ interactionScore: -1 })
        .limit(5)
        .lean();

    if (userInteractions.length === 0) return [];

    const userProductIds = userInteractions.map((i) => i.productId);

    // Build target user's sparse interaction vector
    const userVector = {};
    for (const interaction of userInteractions) {
        userVector[interaction.productId.toString()] = interaction.interactionScore || 0;
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
                    $push: { productId: "$productId", score: "$interactionScore" }
                },
            }
        },
        { $limit: 50 },
    ]);

    if (candidateData.length === 0) return [];

    // Compute cosine similarity between target user and each candidate
    // over their shared interaction space
    const similarities = candidateData
        .map((candidate) => {
            const candidateVector = {};
            for (const { productId, score } of candidate.sharedScores) {
                candidateVector[productId.toString()] = score;
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
        productScores[pid] = (productScores[pid] || 0) + interaction.interactionScore * sim;
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

    // Invalidate recommendation cache so next fetch reflects new interaction
    await invalidateUserRecCache(String(userId));

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
