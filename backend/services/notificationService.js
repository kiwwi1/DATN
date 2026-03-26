import notificationModel from "../models/notificationModel.js";

/** userId (string) -> SSE response object */
const sseClients = new Map();

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
 * @param {"order_placed"|"order_status"|"order_cancelled"} type
 * @param {string} title
 * @param {string} message
 * @param {string} [orderId]
 */
export const createNotification = async (userId, type, title, message, orderId) => {
    try {
        const notification = await notificationModel.create({
            userId,
            type,
            title,
            message,
            orderId: orderId || null,
        });
        pushSSE(userId, {
            _id: notification._id,
            type,
            title,
            message,
            orderId: orderId || null,
            read: false,
            createdAt: notification.createdAt,
        });
        return notification;
    } catch (err) {
        console.error("⚠️ createNotification error:", err.message);
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
    return notificationModel.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
};

/** Đánh dấu tất cả thông báo là đã đọc. */
export const markAllReadService = async (userId) => {
    return notificationModel.updateMany({ userId, read: false }, { $set: { read: true } });
};

/** Đánh dấu một thông báo là đã đọc. */
export const markOneReadService = async (notificationId, userId) => {
    return notificationModel.findOneAndUpdate(
        { _id: notificationId, userId },
        { $set: { read: true } },
        { new: true }
    );
};
