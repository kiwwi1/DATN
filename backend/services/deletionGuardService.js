import orderModel from "../models/orderModel.js";
import productModel from "../models/productModel.js";
import reviewModel from "../models/reviewModel.js";
import notificationModel from "../models/notificationModel.js";
import shopFollowModel from "../models/shopFollowModel.js";
import userInteractionModel from "../models/userInteractionModel.js";

const asConflict = (message) =>
    Object.assign(new Error(message), { status: 409 });

export const getProductDeleteImpact = async (productId) => {
    const [hasOrders, hasReviews, hasInteractions] = await Promise.all([
        orderModel.exists({
            $or: [{ "items._id": productId }, { "vendors.items.productId": productId }],
        }),
        reviewModel.exists({ product: productId }),
        userInteractionModel.exists({ productId }),
    ]);

    return {
        hasOrders: Boolean(hasOrders),
        hasReviews: Boolean(hasReviews),
        hasInteractions: Boolean(hasInteractions),
    };
};

export const ensureUserDeletable = async (userId) => {
    const [
        hasOrdersAsBuyer,
        hasOrdersAsVendor,
        hasProducts,
        hasReviews,
        hasNotifications,
        hasFollows,
        hasInteractions,
    ] = await Promise.all([
        orderModel.exists({ userId }),
        orderModel.exists({
            $or: [{ "items.vendorId": userId }, { "vendors.vendorId": userId }],
        }),
        productModel.exists({ vendorId: userId }),
        reviewModel.exists({ user: userId }),
        notificationModel.exists({ userId }),
        shopFollowModel.exists({ $or: [{ userId }, { vendorId: userId }] }),
        userInteractionModel.exists({ userId }),
    ]);

    if (
        hasOrdersAsBuyer ||
        hasOrdersAsVendor ||
        hasProducts ||
        hasReviews ||
        hasNotifications ||
        hasFollows ||
        hasInteractions
    ) {
        throw asConflict(
            "Cannot delete user: user still has related orders/products/reviews/notifications/follows/interactions"
        );
    }
};

export const ensureOrderDeletable = async (order) => {
    if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });

    const [hasReviews, hasNotifications] = await Promise.all([
        reviewModel.exists({ orderId: order._id }),
        notificationModel.exists({ orderId: order._id }),
    ]);

    if (hasReviews || hasNotifications) {
        throw asConflict(
            "Cannot delete order: order still has related reviews/notifications"
        );
    }
};
