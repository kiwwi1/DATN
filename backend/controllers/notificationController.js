import jwt from "jsonwebtoken";
import {
    registerSSEClient,
    removeSSEClient,
    getNotificationsService,
    markAllReadService,
    markOneReadService,
} from "../services/notificationService.js";

/**
 * GET /api/notification/stream
 * SSE endpoint — client kết nối một lần, server push events liên tục.
 * Token truyền qua query param vì EventSource không hỗ trợ custom headers.
 */
export const sseStream = (req, res) => {
    const token = req.query.token;
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
        res.json({ success: false, message: error.message });
    }
};

/** POST /api/notification/read-all */
export const markAllRead = async (req, res) => {
    try {
        await markAllReadService(req.body.userId);
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

/** POST /api/notification/read/:id */
export const markOneRead = async (req, res) => {
    try {
        const notification = await markOneReadService(req.params.id, req.body.userId);
        res.json({ success: true, notification });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};
