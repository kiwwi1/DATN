import orderModel from "../../models/orderModel.js";
import { createNotification } from "../notificationService.js";
import { ensureOrderDeletable } from "../deletionGuardService.js";

const STATUS_LABEL = {
  "Order Placed": "Đã đặt hàng",
  Packing: "Đang đóng gói",
  Shipped: "Đang vận chuyển",
  "Out for delivery": "Đang giao hàng",
  Delivered: "Đã giao thành công",
  Cancelled: "Đã hủy",
  Refunded: "Đã hoàn tiền",
};

const TRACKING_REQUIRED_STATUSES = new Set(["Shipped", "Out for delivery", "Delivered"]);
const TRACKING_REQUIRED_VENDOR_STATUSES = new Set(["shipped"]);
const ALLOWED_VENDOR_STATUSES = new Set([
  "pending",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
]);

const ORDER_STATUS_TO_VENDOR_STATUS = {
  "Order Placed": "pending",
  Packing: "preparing",
  Shipped: "shipped",
  "Out for delivery": "shipped",
  Delivered: "delivered",
  Cancelled: "cancelled",
};

const deriveVendorStatus = (orderStatus, vendorEntry) =>
  String(
    vendorEntry?.vendorStatus ||
    ORDER_STATUS_TO_VENDOR_STATUS[String(orderStatus || "").trim()] ||
    "pending"
  );

const deriveOrderStatusFromVendors = (vendors = [], fallbackStatus = "Order Placed") => {
  const statuses = vendors.map((vendor) => String(vendor.vendorStatus || "pending"));
  if (statuses.length === 0) return fallbackStatus;
  if (statuses.every((status) => status === "cancelled")) return "Cancelled";
  if (statuses.every((status) => status === "delivered")) return "Delivered";
  if (statuses.some((status) => status === "shipped" || status === "delivered")) return "Shipped";
  if (statuses.some((status) => status === "confirmed" || status === "preparing")) return "Packing";
  return "Order Placed";
};

const normalizeTrackingNumber = (trackingNumber) => {
  if (trackingNumber === undefined || trackingNumber === null) return undefined;
  return String(trackingNumber).trim();
};

const buildTrackingNumber = ({ orderId, vendorId }) => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const orderPart = String(orderId || "").slice(-6).toUpperCase();
  const vendorPart = String(vendorId || "").slice(-4).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DATN-${orderPart}-${vendorPart}-${timestamp}-${randomPart}`;
};

const syncCashOnDeliveryPayment = (order) => {
  if (order.paymentMethod === "COD" && order.status === "Delivered" && !order.payment) {
    order.payment = true;
  }
};

const notifyUserOrderStatus = async (order) => {
  const label = STATUS_LABEL[order.status] || order.status;
  const orderCode = String(order._id).slice(-6).toUpperCase();
  const itemNames = (order.items || []).map((i) => i.name).join(", ");
  const itemStr = itemNames ? ` [${itemNames}]` : "";
  await createNotification(
    order.userId,
    "order_status",
    `Cập nhật đơn hàng #${orderCode}`,
    `Đơn hàng #${orderCode}${itemStr} của bạn đã chuyển sang trạng thái: ${label}`,
    order._id,
    null,
    { audience: "user" }
  );
};

export const deleteOrderService = async (orderId) => {
  const order = await orderModel.findById(orderId);
  await ensureOrderDeletable(order);
  await orderModel.findByIdAndDelete(orderId);
};

export const updateOrderStatusService = async (orderId, status, trackingNumber) => {
  const order = await orderModel.findById(orderId);
  if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });

  const normalizedTracking = normalizeTrackingNumber(trackingNumber);
  if (TRACKING_REQUIRED_STATUSES.has(status) && !normalizedTracking && !order.trackingNumber) {
    throw Object.assign(new Error("Tracking number is required for shipped/delivery statuses"), { status: 400 });
  }
  if (normalizedTracking !== undefined) {
    order.trackingNumber = normalizedTracking;
    order.trackingUpdatedAt = Date.now();
  }

  order.status = status;
  syncCashOnDeliveryPayment(order);
  await order.save();
  await notifyUserOrderStatus(order);

  return order;
};

export const vendorOrdersService = async (vendorId, query = {}) => {
  const { page = 1, limit = 8, status = "all" } = query;
  const normalizedVendorId = vendorId.toString();

  const filter = { "items.vendorId": vendorId };
  if (status && status !== "all") {
    filter.status = status;
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, parseInt(limit) || 8);
  const skip = (pageNum - 1) * limitNum;

  const totalOrders = await orderModel.countDocuments(filter);
  const orders = await orderModel.find(filter).sort({ date: -1 }).skip(skip).limit(limitNum);

  const processedOrders = orders.map((order) => {
    const vendorItems = order.items.filter((item) => item.vendorId?.toString() === normalizedVendorId);
    const vendorAmount = vendorItems.reduce((total, item) => total + item.price * item.quantity, 0);
    const vendorEntry = Array.isArray(order.vendors)
      ? order.vendors.find((vendor) => vendor.vendorId?.toString() === normalizedVendorId)
      : null;
    return {
      ...order.toObject(),
      items: vendorItems,
      vendorAmount,
      vendorStatus: deriveVendorStatus(order.status, vendorEntry),
      trackingNumber: vendorEntry?.trackingNumber || order.trackingNumber || "",
    };
  });

  return {
    orders: processedOrders,
    totalOrders,
    page: pageNum,
    totalPages: Math.ceil(totalOrders / limitNum)
  };
};

export const updateVendorOrderStatusService = async (orderId, status, vendorId, trackingNumber, autoGenerateTracking = false) => {
  const order = await orderModel.findById(orderId);
  if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });

  const vendorEntry = Array.isArray(order.vendors)
    ? order.vendors.find((vendor) => vendor.vendorId?.toString() === vendorId.toString())
    : null;
  if (!vendorEntry) {
    throw Object.assign(new Error("Unauthorized - this order does not contain your products"), { status: 403 });
  }

  const nextVendorStatus =
    ORDER_STATUS_TO_VENDOR_STATUS[String(status || "").trim()] ||
    String(status || "").trim().toLowerCase();
  if (!ALLOWED_VENDOR_STATUSES.has(nextVendorStatus)) {
    throw Object.assign(new Error("Invalid vendor status"), { status: 400 });
  }
  if (nextVendorStatus === "delivered") {
    throw Object.assign(
      new Error("Khách hàng phải tự xác nhận đã nhận hàng trước khi đơn chuyển sang hoàn thành"),
      { status: 400, code: "CUSTOMER_CONFIRMATION_REQUIRED" }
    );
  }

  let normalizedTracking = normalizeTrackingNumber(trackingNumber);
  if (
    !normalizedTracking &&
    !(vendorEntry?.trackingNumber || order.trackingNumber) &&
    (TRACKING_REQUIRED_VENDOR_STATUSES.has(nextVendorStatus) || autoGenerateTracking)
  ) {
    normalizedTracking = buildTrackingNumber({ orderId: order._id, vendorId });
  }
  if (
    TRACKING_REQUIRED_VENDOR_STATUSES.has(nextVendorStatus) &&
    !normalizedTracking &&
    !(vendorEntry?.trackingNumber || order.trackingNumber)
  ) {
    throw Object.assign(new Error("Please provide tracking number before marking order as shipped"), { status: 400, code: "TRACKING_REQUIRED" });
  }
  if (normalizedTracking !== undefined) {
    const now = Date.now();
    vendorEntry.trackingNumber = normalizedTracking;
    vendorEntry.trackingUpdatedAt = now;
    if (!order.trackingNumber || order.vendors?.length === 1) {
      order.trackingNumber = normalizedTracking;
      order.trackingUpdatedAt = now;
    }
  }

  vendorEntry.vendorStatus = nextVendorStatus;
  order.markModified("vendors");
  order.status = deriveOrderStatusFromVendors(order.vendors, order.status);
  syncCashOnDeliveryPayment(order);
  await order.save();
  await notifyUserOrderStatus(order);

  return order;
};

export const confirmOrderReceivedService = async ({ orderId, userId, vendorId }) => {
  const order = await orderModel.findById(orderId);
  if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });
  if (String(order.userId) !== String(userId)) {
    throw Object.assign(new Error("Unauthorized to confirm this order"), { status: 403 });
  }

  const vendors = Array.isArray(order.vendors) ? order.vendors : [];
  if (vendors.length === 0) {
    throw Object.assign(new Error("Order has no vendor shipment information"), { status: 400 });
  }

  let vendorEntry = null;
  if (vendorId) {
    vendorEntry = vendors.find((vendor) => vendor.vendorId?.toString() === String(vendorId)) || null;
  } else if (vendors.length === 1) {
    vendorEntry = vendors[0];
  }

  if (!vendorEntry) {
    throw Object.assign(new Error("Vendor shipment not found for this order"), { status: 404 });
  }
  if (String(vendorEntry.vendorStatus || "") !== "shipped") {
    throw Object.assign(
      new Error("Chỉ có thể xác nhận khi shop đang ở trạng thái vận chuyển"),
      { status: 400 }
    );
  }

  vendorEntry.vendorStatus = "delivered";
  order.markModified("vendors");
  order.status = deriveOrderStatusFromVendors(order.vendors, order.status);
  syncCashOnDeliveryPayment(order);
  await order.save();
  await notifyUserOrderStatus(order);

  const orderCode = String(order._id).slice(-6).toUpperCase();
  await createNotification(
    vendorEntry.vendorId,
    "order_status",
    `Khách đã xác nhận nhận hàng #${orderCode}`,
    `Khách hàng đã xác nhận nhận hàng cho đơn #${orderCode}.`,
    order._id,
    null,
    { audience: "vendor" }
  );

  return order;
};
