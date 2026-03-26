import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import { trackInteractionService } from "./interactionService.js";

/** Chỉ giữ lại các productId còn tồn tại trong DB (sản phẩm đã xóa sẽ bị bỏ khỏi cart). */
export const sanitizeCartData = async (cartData) => {
    if (!cartData || typeof cartData !== "object") return {};
    const ids = Object.keys(cartData);
    if (ids.length === 0) return {};
    const existing = await productModel.find({ _id: { $in: ids } }).select("_id").lean();
    const existingIds = new Set(existing.map((p) => p._id.toString()));
    const out = {};
    for (const id of ids) {
        if (existingIds.has(id)) out[id] = cartData[id];
    }
    return out;
};

export const addToCartService = async (userId, itemId, size) => {
    const userData = await userModel.findById(userId);
    const cartData = { ...userData.cartData };

    if (cartData[itemId]) {
        cartData[itemId][size] = (cartData[itemId][size] || 0) + 1;
    } else {
        cartData[itemId] = { [size]: 1 };
    }

    await userModel.findByIdAndUpdate(userId, { cartData });
    trackInteractionService(userId, itemId, 'addedToCart').catch(() => {});
};

export const updateCartService = async (userId, itemId, size, quantity) => {
    const userData = await userModel.findById(userId);
    const cartData = { ...userData.cartData };
    cartData[itemId][size] = quantity;
    await userModel.findByIdAndUpdate(userId, { cartData });
};

export const getUserCartService = async (userId) => {
    const userData = await userModel.findById(userId);
    const cartData = await sanitizeCartData(userData.cartData || {});
    const raw = userData.cartData || {};
    if (Object.keys(cartData).length !== Object.keys(raw).length) {
        await userModel.findByIdAndUpdate(userId, { $set: { cartData } });
    }
    return cartData;
};

/** Xóa cartData của tất cả user (dùng cho script/admin). */
export const clearAllCartsService = async () => {
    const result = await userModel.updateMany({}, { $set: { cartData: {} } });
    return result;
};
