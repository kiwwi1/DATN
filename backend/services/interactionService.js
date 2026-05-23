import userInteractionModel from "../models/userInteractionModel.js";
import productModel from "../models/productModel.js";

const normalizeLimit = (limit) => {
    return Number.isFinite(limit) && limit > 0 ? limit : null;
};

const incrementInteraction = async (userId, productId, interactionType, value, useUpsert) => {
    return userInteractionModel.findOneAndUpdate(
        { userId, productId },
        {
            $inc: { [`interactions.${interactionType}`]: value },
            $set: { lastInteraction: new Date() }
        },
        { upsert: useUpsert, new: true }
    );
};

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
        .select('category subCategory')
        .lean();

    const categoryIds = [...new Set(
        topProducts.flatMap((p) => [p.category, p.subCategory].filter(Boolean).map(String))
    )];

    const query = productModel.find({
        $or: [{ category: { $in: categoryIds } }, { subCategory: { $in: categoryIds } }],
        _id: { $nin: seenProductIds },
        isActive: true,
    }).sort({ sold: -1, rating: -1 });

    if (normalizedLimit) query.limit(normalizedLimit);
    return query.lean();
};

const getItemBasedRecs = async (userId, limit) => {
    const normalizedLimit = normalizeLimit(limit);

    const userInteractions = await userInteractionModel
        .find({ userId })
        .sort({ interactionScore: -1 })
        .limit(5)
        .lean();

    if (userInteractions.length === 0) return [];

    const userProductIds = userInteractions.map((i) => i.productId);

    const similarUsers = await userInteractionModel.aggregate([
        {
            $match: {
                productId: { $in: userProductIds },
                userId: { $ne: userId }
            }
        },
        {
            $group: {
                _id: "$userId",
                sharedProducts: { $addToSet: "$productId" },
                totalScore: { $sum: "$interactionScore" }
            }
        },
        { $sort: { totalScore: -1 } },
        { $limit: 20 },
    ]);

    if (similarUsers.length === 0) return [];

    const similarUserIds = similarUsers.map((u) => u._id);
    const candidateInteractions = await userInteractionModel.find({
        userId: { $in: similarUserIds },
        productId: { $nin: userProductIds }
    })
    .sort({ interactionScore: -1 })
    .lean();

    const productScores = {};
    for (const interaction of candidateInteractions) {
        const pid = interaction.productId.toString();
        productScores[pid] = (productScores[pid] || 0) + interaction.interactionScore;
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

export const trackInteractionService = async (userId, productId, interactionType, value = 1) => {
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

    return score;
};

export const getRecommendationsService = async (userId, limit = null) => {
    const normalizedLimit = normalizeLimit(limit);
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

    return result;
};
