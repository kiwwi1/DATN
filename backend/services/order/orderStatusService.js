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
const TRACKING_REQUIRED_VENDOR_STATUSES = new Set(["shipped", "delivered"]);
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
  await order.save();

  const label = STATUS_LABEL[status] || status;
  await createNotification(
    order.userId,
    "order_status",
    "Cập nhật đơn hàng",
    `Đơn hàng của bạn đã chuyển sang trạng thái: ${label}`,
    order._id,
    null,
    { audience: "user" }
  );

  return order;
};

export const vendorOrdersService = async (vendorId) => {
  const normalizedVendorId = vendorId.toString();
  const orders = await orderModel.find({ "items.vendorId": vendorId }).sort({ date: -1 });
  return orders
    .filter((order) => order.items.some((item) => item.vendorId?.toString() === normalizedVendorId))
    .map((order) => {
      const vendorItems = order.items.filter((item) => item.vendorId?.toString() === normalizedVendorId);
      const vendorAmount = vendorItems.reduce((total, item) => total + item.price * item.quantity, 0);
      const vendorEntry = Array.isArray(order.vendors)
        ? order.vendors.find((vendor) => vendor.vendorId?.toString() === normalizedVendorId)
        : null;
      return {
        ...order.toObject(),
        items: vendorItems,
        vendorAmount,
        trackingNumber: vendorEntry?.trackingNumber || order.trackingNumber || "",
      };
    });
};

export const updateVendorOrderStatusService = async (orderId, status, vendorId, trackingNumber, autoGenerateTracking = false) => {
  const order = await orderModel.findById(orderId);
  if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });

  const vendorEntry = Array.isArray(order.vendors)
    ? order.vendors.find((vendor) => vendor.vendorId?.toString() === vendorId.toString())
    : null;
  if (!vendorEntry) {
    throw Object.assign(new Error("Unauthorized - This order does not contain your products"), { status: 403 });
  }

  const nextVendorStatus =
    ORDER_STATUS_TO_VENDOR_STATUS[String(status || "").trim()] ||
    String(status || "").trim().toLowerCase();
  if (!ALLOWED_VENDOR_STATUSES.has(nextVendorStatus)) {
    throw Object.assign(new Error("Invalid vendor status"), { status: 400 });
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
    throw Object.assign(new Error("Please provide tracking number before marking order as shipped"), { status: 400 });
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
  await order.save();

  const label = STATUS_LABEL[order.status] || order.status;
  await createNotification(
    order.userId,
    "order_status",
    "Cập nhật đơn hàng",
    `Đơn hàng của bạn đã chuyển sang trạng thái: ${label}`,
    order._id,
    null,
    { audience: "user" }
  );

  return order;
};
