import jwt from "jsonwebtoken";
import {
    registerSSEClient,
    removeSSEClient,
    getNotificationsService,
    markAllReadService,
    markOneReadService,
} from "../services/notificationService.js";
import {
    getPriceAlertStatusService,
    setPriceAlertSubscriptionService,
} from "../services/priceDropNotificationService.js";

/**
 * GET /api/notification/stream
 * SSE endpoint — client kết nối một lần, server push events liên tục.
 * Ưu tiên đọc token từ HttpOnly cookie, fallback query param để tương thích cũ.
 */
export const sseStream = (req, res) => {
    const token = req.cookies?.accessToken || req.query.token;
    if (!token) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    let userId;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
    } catch {
        return res.status(401).json({ success: false, message: "Invalid token" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Gửi comment giữ kết nối mỗi 25 giây (tránh proxy timeout)
    const heartbeat = setInterval(() => {
        res.write(": heartbeat\n\n");
    }, 25000);

    registerSSEClient(userId, res);

    req.on("close", () => {
        clearInterval(heartbeat);
        removeSSEClient(userId);
    });
};

/** GET /api/notification/list */
export const getNotifications = async (req, res) => {
    try {
        const notifications = await getNotificationsService(req.body.userId);
        res.json({ success: true, notifications });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/** POST /api/notification/read-all */
export const markAllRead = async (req, res) => {
    try {
        await markAllReadService(req.body.userId);
        res.json({ success: true });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/** POST /api/notification/read/:id */
export const markOneRead = async (req, res) => {
    try {
        const notification = await markOneReadService(req.params.id, req.body.userId);
        res.json({ success: true, notification });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/** GET /api/notification/price-alert/status?productId=... */
export const getPriceAlertStatus = async (req, res) => {
    try {
        const { productId } = req.query;
        const enabled = await getPriceAlertStatusService(req.body.userId, productId);
        res.json({ success: true, enabled });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/** POST /api/notification/price-alert/subscribe */
export const setPriceAlertSubscription = async (req, res) => {
    try {
        const { productId, enabled } = req.body;
        const alert = await setPriceAlertSubscriptionService(
            req.body.userId,
            productId,
            enabled
        );
        res.json({ success: true, enabled: !!alert.enabled });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};
