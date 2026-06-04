import { trackInteractionService, getRecommendationsService } from "../services/interactionService.js";

const VALID_INTERACTIONS = [
    "purchased",
    "rated",
    "reviewed",
    "addedToCart",
    "wishlisted",
    "viewed",
    "clicked",
    "searched",
    "timeSpent",
];
const DEFAULT_RECOMMENDATION_LIMIT = 40;
const MAX_RECOMMENDATION_LIMIT = 100;

const trackInteraction = async (req, res) => {
    try {
        const { userId, productId, interactionType, value } = req.body;
        if (!productId || !interactionType) {
            return res.status(400).json({ success: false, message: "productId and interactionType are required" });
        }
        if (!VALID_INTERACTIONS.includes(interactionType)) {
            return res.status(400).json({ success: false, message: "Invalid interaction type" });
        }
        await trackInteractionService(userId, productId, interactionType, value);
        res.json({ success: true });
    } catch (error) {
        console.log(error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const getRecommendations = async (req, res) => {
    try {
        const { userId } = req.body;
        const parsedLimit = Number.parseInt(req.query.limit, 10);
        const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
            ? Math.min(parsedLimit, MAX_RECOMMENDATION_LIMIT)
            : DEFAULT_RECOMMENDATION_LIMIT;
        const products = await getRecommendationsService(userId, limit);
        res.json({ success: true, products });
    } catch (error) {
        console.log(error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

export { trackInteraction, getRecommendations };
