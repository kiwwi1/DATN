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
 * SSE endpoint authenticated by authUser middleware.
 */
export const sseStream = (req, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const audience = String(req.query?.audience || "user").trim().toLowerCase() === "vendor"
    ? "vendor"
    : "user";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Send heartbeat every 25 seconds to keep proxies from timing out.
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 25000);

  const clientId = registerSSEClient(userId, audience, res);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeSSEClient(userId, clientId);
  });
};

/** GET /api/notification/list */
export const getNotifications = async (req, res) => {
  try {
    const audience = req.query?.audience || req.body?.audience || "user";
    const userId = req.userId;
    const notifications = await getNotificationsService(userId, audience);
    res.json({ success: true, notifications });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/** POST /api/notification/read-all */
export const markAllRead = async (req, res) => {
  try {
    const audience = req.query?.audience || req.body?.audience || "user";
    const userId = req.userId;
    await markAllReadService(userId, audience);
    res.json({ success: true });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/** POST /api/notification/read/:id */
export const markOneRead = async (req, res) => {
  try {
    const audience = req.query?.audience || req.body?.audience || "user";
    const userId = req.userId;
    const notification = await markOneReadService(req.params.id, userId, audience);
    res.json({ success: true, notification });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/** GET /api/notification/price-alert/status?productId=... */
export const getPriceAlertStatus = async (req, res) => {
  try {
    const { productId } = req.query;
    const userId = req.userId;
    const enabled = await getPriceAlertStatusService(userId, productId);
    res.json({ success: true, enabled });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/** POST /api/notification/price-alert/subscribe */
export const setPriceAlertSubscription = async (req, res) => {
  try {
    const { productId, enabled } = req.body;
    const userId = req.userId;
    const alert = await setPriceAlertSubscriptionService(userId, productId, enabled);
    res.json({ success: true, enabled: !!alert.enabled });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};
