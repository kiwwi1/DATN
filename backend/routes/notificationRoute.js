import express from "express";
import authUser from "../middleware/auth.js";
import {
    sseStream,
    getNotifications,
    markAllRead,
    markOneRead,
    getPriceAlertStatus,
    setPriceAlertSubscription,
} from "../controllers/notificationController.js";

const notificationRouter = express.Router();

// SSE — dùng GET, token qua query param (EventSource không hỗ trợ custom headers)
notificationRouter.get("/stream", sseStream);

// REST
notificationRouter.get("/list", authUser, getNotifications);
notificationRouter.post("/read-all", authUser, markAllRead);
notificationRouter.post("/read/:id", authUser, markOneRead);
notificationRouter.get("/price-alert/status", authUser, getPriceAlertStatus);
notificationRouter.post("/price-alert/subscribe", authUser, setPriceAlertSubscription);

export default notificationRouter;
