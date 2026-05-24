import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import { trackInteractionService } from "./interactionService.js";

const DEFAULT_CART_OPTION_KEY = "__default__";

const normalizeCartOptionKey = (optionKey) => {
    const normalized = String(optionKey ?? "").trim();
    if (!normalized || normalized === "undefined" || normalized === "null") {
        return DEFAULT_CART_OPTION_KEY;
    }
    return normalized;
};

const normalizeCartDataShape = (cartData) => {
    if (!cartData || typeof cartData !== "object") return {};

    const normalizedCart = {};
    for (const [productId, rawOptions] of Object.entries(cartData)) {
        if (!rawOptions || typeof rawOptions !== "object") continue;

        const nextOptions = {};
        for (const [rawOptionKey, rawQuantity] of Object.entries(rawOptions)) {
            const optionKey = normalizeCartOptionKey(rawOptionKey);
            const quantity = Number(rawQuantity) || 0;
            if (quantity <= 0) continue;
            nextOptions[optionKey] = (nextOptions[optionKey] || 0) + quantity;
        }

        if (Object.keys(nextOptions).length > 0) {
            normalizedCart[productId] = nextOptions;
        }
    }

    return normalizedCart;
};

/** Keep only productIds that still exist in DB. */
export const sanitizeCartData = async (cartData) => {
    const normalized = normalizeCartDataShape(cartData);
    const ids = Object.keys(normalized);
    if (ids.length === 0) return {};

    const existing = await productModel.find({ _id: { $in: ids } }).select("_id").lean();
    const existingIds = new Set(existing.map((p) => p._id.toString()));

    const out = {};
    for (const id of ids) {
        if (existingIds.has(id)) out[id] = normalized[id];
    }
    return out;
};

export const addToCartService = async (userId, itemId, size) => {
    const userData = await userModel.findById(userId);
    const cartData = normalizeCartDataShape(userData?.cartData || {});
    const optionKey = normalizeCartOptionKey(size);

    if (!cartData[itemId]) cartData[itemId] = {};
    cartData[itemId][optionKey] = (cartData[itemId][optionKey] || 0) + 1;

    await userModel.findByIdAndUpdate(userId, { cartData });
    trackInteractionService(userId, itemId, "addedToCart").catch(() => {});
};

export const updateCartService = async (userId, itemId, size, quantity) => {
    const userData = await userModel.findById(userId);
    const cartData = normalizeCartDataShape(userData?.cartData || {});
    const optionKey = normalizeCartOptionKey(size);
    const nextQty = Number(quantity) || 0;

    if (!cartData[itemId]) cartData[itemId] = {};

    if (nextQty <= 0) {
        delete cartData[itemId][optionKey];
        if (!Object.keys(cartData[itemId]).length) {
            delete cartData[itemId];
        }
    } else {
        cartData[itemId][optionKey] = nextQty;
    }

    await userModel.findByIdAndUpdate(userId, { cartData });
};

export const getUserCartService = async (userId) => {
    const userData = await userModel.findById(userId);
    const raw = userData?.cartData || {};
    const cartData = await sanitizeCartData(raw);

    if (JSON.stringify(cartData) !== JSON.stringify(normalizeCartDataShape(raw))) {
        await userModel.findByIdAndUpdate(userId, { $set: { cartData } });
    }

    return cartData;
};

/** Clear cartData of all users (for script/admin use). */
export const clearAllCartsService = async () => {
    const result = await userModel.updateMany({}, { $set: { cartData: {} } });
    return result;
};
