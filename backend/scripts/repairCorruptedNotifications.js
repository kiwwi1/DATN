import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import connectDB from "../config/mongodb.js";
import notificationModel from "../models/notificationModel.js";
import orderModel from "../models/orderModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const QUESTION_MARK_IN_WORD_PATTERN = /\p{L}\?\p{L}|\?\p{L}|\p{L}\?/u;
const CORRUPTED_PATTERN = /[\uFFFDÃ]|\u0000|\u0001|\u0002|\u0003|\u0004|\u0005|\u0006|\u0007/;
const ENGLISH_TEMPLATE_PATTERN = /\b(order update|your order|is now|new order|price drop|return request|refunded|in transit|out for delivery|buyer confirmed receipt|the buyer confirmed receipt|confirmed receipt)\b/i;
const BUYER_CONFIRMED_PATTERN = /\bbuyer confirmed receipt\b|\bthe buyer confirmed receipt\b|\bconfirmed receipt\b/i;
const TYPES = new Set([
  "order_placed",
  "order_status",
  "order_cancelled",
  "return_approved",
  "return_rejected",
  "return_refunded",
  "price_drop",
]);

const ORDER_STATUS_LABEL = {
  Packing: "Đang đóng gói",
  Shipped: "Đang vận chuyển",
  "Out for delivery": "Đang giao hàng",
  Delivered: "Đã giao thành công",
  Cancelled: "Đã hủy",
};

const shouldRepair = (value) => {
  if (typeof value !== "string" || !value) return false;
  return (
    CORRUPTED_PATTERN.test(value) ||
    QUESTION_MARK_IN_WORD_PATTERN.test(value) ||
    ENGLISH_TEMPLATE_PATTERN.test(value)
  );
};

const buildFallbackByType = ({ type, order, audience = "user", sourceTitle = "", sourceMessage = "" }) => {
  const orderCode = order?._id ? String(order._id).slice(-6).toUpperCase() : "";
  const codeStr = orderCode ? ` #${orderCode}` : "";
  const itemNames = Array.isArray(order?.items) && order.items.length > 0
    ? order.items.map((i) => i.name).join(", ")
    : "";
  const itemStr = itemNames ? ` [${itemNames}]` : "";
  const buyerConfirmed = BUYER_CONFIRMED_PATTERN.test(`${sourceTitle} ${sourceMessage}`);

  if (type === "order_status") {
    if (audience === "vendor" && buyerConfirmed) {
      return {
        title: `Khách đã xác nhận nhận hàng${codeStr}`,
        message: `Khách hàng đã xác nhận nhận hàng cho đơn${codeStr}.`,
      };
    }

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

await connectDB();

const notifications = await notificationModel
  .find({ type: { $in: [...TYPES] } })
  .select("_id type audience title message orderId")
  .lean();

const targetNotifications = notifications.filter(
  (item) => shouldRepair(item.title) || shouldRepair(item.message)
);

const orderIds = [...new Set(targetNotifications.map((item) => item.orderId).filter(Boolean).map((id) => String(id)))];
const orders = orderIds.length
  ? await orderModel.find({ _id: { $in: orderIds } }).select("_id status cancelReason items").lean()
  : [];
const orderMap = new Map(orders.map((order) => [String(order._id), order]));

const operations = targetNotifications.map((item) => {
  const order = item.orderId ? orderMap.get(String(item.orderId)) : null;
  const fallback = buildFallbackByType({
    type: item.type,
    order,
    audience: item.audience,
    sourceTitle: item.title,
    sourceMessage: item.message,
  });
  return {
    updateOne: {
      filter: { _id: item._id },
      update: {
        $set: {
          title: fallback.title,
          message: fallback.message,
        },
      },
    },
  };
});

if (operations.length > 0) {
  await notificationModel.bulkWrite(operations, { ordered: false });
}

console.log(JSON.stringify({ repaired: operations.length }, null, 2));
process.exit(0);
