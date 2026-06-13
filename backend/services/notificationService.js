import notificationModel from "../models/notificationModel.js";
import orderModel from "../models/orderModel.js";

/** userId (string) -> Map<clientId, { res, audience }> */
const sseClients = new Map();
let sseClientSeq = 0;

const MOJIBAKE_PATTERN = /[ÃÄÂ]|Ã¯Â¿Â½/;
const CORRUPTED_TEXT_PATTERN = /[\u0000-\u001F\u007FÃ¯Â¿Â½]/;

const ORDER_STATUS_LABEL = {
  Packing: "Đang đóng gói",
  Shipped: "Đang vận chuyển",
  "Out for delivery": "Đang giao hàng",
  Delivered: "Đã giao thành công",
  Cancelled: "Đã hủy",
};

const normalizeAudience = (value) => {
  const raw = String(value || "user").trim().toLowerCase();
  return raw === "vendor" ? "vendor" : "user";
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
  const orderCode = order?._id ? String(order._id).slice(-6).toUpperCase() : "";
  const codeStr = orderCode ? ` #${orderCode}` : "";
  const itemNames = Array.isArray(order?.items) && order.items.length > 0
    ? order.items.map((i) => i.name).join(", ")
    : "";
  const itemStr = itemNames ? ` [${itemNames}]` : "";

  if (type === "order_status") {
    const status = order?.status;
    const label = ORDER_STATUS_LABEL[status] || status || "Đang xử lý";
    return {
      title: `Cập nhật đơn hàng${codeStr}`,
      message: `Đơn hàng${codeStr}${itemStr} của bạn đã chuyển sang trạng thái: ${label}`,
    };
  }

  if (type === "order_placed") {
    return {
      title: `Đơn hàng mới${codeStr}`,
      message: `Bạn có đơn hàng mới${codeStr}${itemStr}.`,
    };
  }

  if (type === "order_cancelled") {
    const reason = order?.cancelReason ? ` Lý do: ${order.cancelReason}` : "";
    return {
      title: `Đơn hàng đã bị hủy${codeStr}`,
      message: `Đơn hàng${codeStr}${itemStr} của bạn đã bị hủy.${reason}`,
    };
  }

  if (type === "return_approved") {
    return {
      title: `Yêu cầu trả hàng được chấp nhận${codeStr}`,
      message: `Người bán đã chấp nhận yêu cầu trả hàng cho đơn hàng${codeStr}${itemStr}. Vui lòng gửi lại hàng theo hướng dẫn.`,
    };
  }

  if (type === "return_rejected") {
    return {
      title: `Yêu cầu trả hàng bị từ chối${codeStr}`,
      message: `Người bán đã từ chối yêu cầu trả hàng cho đơn hàng${codeStr}${itemStr}.`,
    };
  }

  if (type === "return_refunded") {
    return {
      title: `Hoàn tiền thành công${codeStr}`,
      message: `Đơn hàng${codeStr}${itemStr} của bạn đã được hoàn tiền thành công.`,
    };
  }

  if (type === "price_drop") {
    return {
      title: "Sản phẩm giảm giá",
      message: "Một sản phẩm trong danh sách theo dõi của bạn vừa giảm giá.",
    };
  }

  return {
    title: "Thông báo mới",
    message: "Bạn có một thông báo mới.",
  };
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

  return {
    ...item,
    title: fallback.title,
    message: fallback.message,
    __fixed: fallback.title !== item.title || fallback.message !== item.message,
  };
};

const pushSSE = (userId, payload) => {
  const audience = normalizeAudience(payload?.audience);
  const clients = sseClients.get(userId.toString());
  if (!clients || clients.size === 0) return;

  for (const client of clients.values()) {
    if (normalizeAudience(client.audience) !== audience) continue;
    client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
};

export const createNotification = async (
  userId,
  type,
  title,
  message,
  orderId,
  productId,
  options = {}
) => {
  try {
    const audience = normalizeAudience(typeof options === "string" ? options : options?.audience);
    const normalizedTitle = repairMojibake(title);
    const normalizedMessage = repairMojibake(message);
    const notification = await notificationModel.create({
      userId,
      audience,
      type,
      title: normalizedTitle,
      message: normalizedMessage,
      orderId: orderId ?? null,
      productId: productId ?? null,
    });
    const orderIdOut = notification.orderId != null ? notification.orderId.toString() : null;
    const productIdOut = notification.productId != null ? notification.productId.toString() : null;
    pushSSE(userId, {
      _id: notification._id,
      audience,
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

export const registerSSEClient = (userId, audience, res) => {
  const uid = userId.toString();
  if (!sseClients.has(uid)) {
    sseClients.set(uid, new Map());
  }
  const clientId = `${Date.now()}-${++sseClientSeq}`;
  sseClients.get(uid).set(clientId, { res, audience: normalizeAudience(audience) });
  return clientId;
};

export const removeSSEClient = (userId, clientId) => {
  const uid = userId.toString();
  const clients = sseClients.get(uid);
  if (!clients) return;
  clients.delete(clientId);
  if (clients.size === 0) {
    sseClients.delete(uid);
  }
};

export const getNotificationsService = async (userId, audience = "user") => {
  const normalizedAudience = normalizeAudience(audience);
  const notifications = await notificationModel
    .find({ userId, audience: normalizedAudience })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  const orderIds = [
    ...new Set(
      notifications
        .map((item) => item.orderId)
        .filter(Boolean)
        .map((id) => String(id))
    ),
  ];

  const orders =
    orderIds.length > 0
      ? await orderModel.find({ _id: { $in: orderIds } }).select("_id status cancelReason items").lean()
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

export const markAllReadService = async (userId, audience = "user") => {
  return notificationModel.updateMany(
    { userId, audience: normalizeAudience(audience), read: false },
    { $set: { read: true } }
  );
};

export const markOneReadService = async (notificationId, userId, audience = "user") => {
  const item = await notificationModel.findOneAndUpdate(
    { _id: notificationId, userId, audience: normalizeAudience(audience) },
    { $set: { read: true } },
    { new: true }
  );
  if (!item) return item;
  const obj = item.toObject();
  const orderMap = new Map();
  if (obj.orderId) {
    const order = await orderModel.findById(obj.orderId).select("_id status cancelReason items").lean();
    if (order?._id) orderMap.set(String(order._id), order);
  }

  const normalized = normalizeNotificationText({ item: obj, orderMap });
  if (normalized.__fixed) {
    notificationModel
      .updateOne(
        { _id: normalized._id },
        { $set: { title: normalized.title, message: normalized.message } }
      )
      .catch(() => {});
  }

  const { __fixed, ...rest } = normalized;
  return rest;
};
