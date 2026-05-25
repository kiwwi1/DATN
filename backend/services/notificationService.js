import notificationModel from "../models/notificationModel.js";
import orderModel from "../models/orderModel.js";

/** userId (string) -> SSE response object */
const sseClients = new Map();

const MOJIBAKE_PATTERN = /[ÃÂâ€]|�/;
const CORRUPTED_TEXT_PATTERN = /[\u0000-\u001F\u007F�]/;

const ORDER_STATUS_LABEL = {
    Packing: "Đang đóng gói",
    Shipped: "Đang vận chuyển",
    "Out for delivery": "Đang giao hàng",
    Delivered: "Đã giao thành công",
    Cancelled: "Đã hủy",
};

const repairMojibake = (value) => {
    if (typeof value !== "string" || value.length === 0) return value;
    let fixed = value;
    for (let i = 0; i < 2; i += 1) {
        if (!MOJIBAKE_PATTERN.test(fixed)) break;
        const next = Buffer.from(fixed, "latin1").toString("utf8");
        if (!next || next === fixed) break;
        fixed = next;
    }
    return fixed;
};

const isCorruptedText = (value) => {
    if (typeof value !== "string" || value.length === 0) return false;
    return CORRUPTED_TEXT_PATTERN.test(value);
};

const buildFallbackByType = ({ type, order }) => {
    if (type === "order_status") {
        const status = order?.status;
        const label = ORDER_STATUS_LABEL[status] || status || "Đang xử lý";
        return {
            title: "Cập nhật đơn hàng",
            message: `Đơn hàng của bạn đã chuyển sang trạng thái: ${label}`,
        };
    }

    if (type === "order_placed") {
        return {
            title: "Đơn hàng mới",
            message: "Bạn có đơn hàng mới.",
        };
    }

    if (type === "order_cancelled") {
        const reason = order?.cancelReason ? ` Lý do: ${order.cancelReason}` : "";
        return {
            title: "Đơn hàng đã bị hủy",
            message: `Đơn hàng của bạn đã bị hủy.${reason}`,
        };
    }

    return null;
};

const normalizeNotificationText = ({ item, orderMap }) => {
    const normalizedTitle = repairMojibake(item.title);
    const normalizedMessage = repairMojibake(item.message);
    const needFallback = isCorruptedText(normalizedTitle) || isCorruptedText(normalizedMessage);

    if (!needFallback) {
        return {
            ...item,
            title: normalizedTitle,
            message: normalizedMessage,
            __fixed: normalizedTitle !== item.title || normalizedMessage !== item.message,
        };
    }

    const order = item.orderId ? orderMap.get(String(item.orderId)) : null;
    const fallback = buildFallbackByType({ type: item.type, order });
    if (!fallback) {
        return {
            ...item,
            title: normalizedTitle,
            message: normalizedMessage,
            __fixed: normalizedTitle !== item.title || normalizedMessage !== item.message,
        };
    }

    return {
        ...item,
        title: fallback.title,
        message: fallback.message,
        __fixed: fallback.title !== item.title || fallback.message !== item.message,
    };
};

/** Gửi event SSE tới client đang kết nối (nếu có). */
const pushSSE = (userId, payload) => {
    const res = sseClients.get(userId.toString());
    if (res) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
};

/**
 * Tạo thông báo trong DB và đẩy SSE ngay lập tức nếu client đang online.
 * @param {string|ObjectId} userId  - người nhận
 * @param {"order_placed"|"order_status"|"order_cancelled"|"price_drop"} type
 * @param {string} title
 * @param {string} message
 * @param {string|Object} [orderId] - id đơn hàng (ObjectId hoặc chuỗi hex hợp lệ)
 * @param {string|Object} [productId] - id sản phẩm
 */
export const createNotification = async (userId, type, title, message, orderId, productId) => {
    try {
        const normalizedTitle = repairMojibake(title);
        const normalizedMessage = repairMojibake(message);
        const notification = await notificationModel.create({
            userId,
            type,
            title: normalizedTitle,
            message: normalizedMessage,
            orderId: orderId ?? null,
            productId: productId ?? null,
        });
        const orderIdOut =
            notification.orderId != null ? notification.orderId.toString() : null;
        const productIdOut =
            notification.productId != null ? notification.productId.toString() : null;
        pushSSE(userId, {
            _id: notification._id,
            type,
            title: normalizedTitle,
            message: normalizedMessage,
            orderId: orderIdOut,
            productId: productIdOut,
            read: false,
            createdAt: notification.createdAt,
        });
        return notification;
    } catch (err) {
        console.error("createNotification error:", err.message);
    }
};

/** Đăng ký SSE connection cho một user. */
export const registerSSEClient = (userId, res) => {
    sseClients.set(userId.toString(), res);
};

/** Xóa SSE connection khi client ngắt kết nối. */
export const removeSSEClient = (userId) => {
    sseClients.delete(userId.toString());
};

/** Lấy danh sách thông báo của user (mới nhất trước, tối đa 50). */
export const getNotificationsService = async (userId) => {
    const notifications = await notificationModel.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
    const orderIds = [
        ...new Set(
            notifications
                .map((item) => item.orderId)
                .filter(Boolean)
                .map((id) => String(id))
        ),
    ];

    const orders = orderIds.length > 0
        ? await orderModel.find({ _id: { $in: orderIds } }).select("_id status cancelReason").lean()
        : [];
    const orderMap = new Map(orders.map((order) => [String(order._id), order]));

    const normalized = notifications.map((item) => normalizeNotificationText({ item, orderMap }));
    const bulkUpdates = normalized
        .filter((item) => item.__fixed)
        .map((item) => ({
            updateOne: {
                filter: { _id: item._id },
                update: { $set: { title: item.title, message: item.message } },
            },
        }));

    if (bulkUpdates.length > 0) {
        notificationModel.bulkWrite(bulkUpdates, { ordered: false }).catch(() => {});
    }

    return normalized.map(({ __fixed, ...rest }) => rest);
};

/** Đánh dấu tất cả thông báo là đã đọc. */
export const markAllReadService = async (userId) => {
    return notificationModel.updateMany({ userId, read: false }, { $set: { read: true } });
};

/** Đánh dấu một thông báo là đã đọc. */
export const markOneReadService = async (notificationId, userId) => {
    const item = await notificationModel.findOneAndUpdate(
        { _id: notificationId, userId },
        { $set: { read: true } },
        { new: true }
    );
    if (!item) return item;
    const obj = item.toObject();
    const orderMap = new Map();
    if (obj.orderId) {
        const order = await orderModel.findById(obj.orderId).select("_id status cancelReason").lean();
        if (order?._id) orderMap.set(String(order._id), order);
    }

    const normalized = normalizeNotificationText({ item: obj, orderMap });
    if (normalized.__fixed) {
        notificationModel.updateOne(
            { _id: normalized._id },
            { $set: { title: normalized.title, message: normalized.message } }
        ).catch(() => {});
    }

    const { __fixed, ...rest } = normalized;
    return rest;
};
