import shopFollowModel from "../models/shopFollowModel.js";
import userModel from "../models/userModel.js";

export const followShopService = async (userId, vendorId) => {
    if (!userId || !vendorId) {
        throw Object.assign(new Error("Thiếu userId hoặc vendorId"), { status: 400 });
    }

    if (String(userId) === String(vendorId)) {
        throw Object.assign(new Error("Không thể tự theo dõi chính mình"), { status: 400 });
    }

    const vendor = await userModel.findById(vendorId).select("role");
    if (!vendor || vendor.role !== "vendor") {
        throw Object.assign(new Error("Shop không tồn tại hoặc không phải vendor"), { status: 404 });
    }

    try {
        await shopFollowModel.create({ userId, vendorId });
        const followerCount = await shopFollowModel.countDocuments({ vendorId });
        return { followed: true, followerCount };
    } catch (err) {
        // Duplicate key: đã follow trước đó
        if (err?.code === 11000) {
            const followerCount = await shopFollowModel.countDocuments({ vendorId });
            return { followed: true, followerCount };
        }
        throw err;
    }
};

export const unfollowShopService = async (userId, vendorId) => {
    if (!userId || !vendorId) {
        throw Object.assign(new Error("Thiếu userId hoặc vendorId"), { status: 400 });
    }

    await shopFollowModel.deleteOne({ userId, vendorId });
    const followerCount = await shopFollowModel.countDocuments({ vendorId });
    return { followed: false, followerCount };
};

export const getFollowStatusService = async (userId, vendorId) => {
    if (!userId || !vendorId) {
        throw Object.assign(new Error("Thiếu userId hoặc vendorId"), { status: 400 });
    }

    const exists = await shopFollowModel.exists({ userId, vendorId });
    return { followed: !!exists };
};

export const getFollowerCountService = async (vendorId) => {
    if (!vendorId) {
        throw Object.assign(new Error("Thiếu vendorId"), { status: 400 });
    }

    const followerCount = await shopFollowModel.countDocuments({ vendorId });
    return { followerCount };
};