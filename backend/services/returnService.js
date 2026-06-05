import Stripe from "stripe";
import orderModel from "../models/orderModel.js";
import returnRequestModel from "../models/returnRequestModel.js";
import productModel from "../models/productModel.js";
import { createNotification } from "./notificationService.js";

const RETURN_WINDOW_DAYS = Number(process.env.RETURN_WINDOW_DAYS || 7);
const RETURN_WINDOW_MS   = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const VALID_REASONS = new Set([
  "damaged",
  "not_as_described",
  "wrong_item",
  "changed_mind",
  "other",
]);

let _stripe;
const getStripe = () => {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
};

const err = (msg, status = 400) => Object.assign(new Error(msg), { status });

// ─── Helpers ────────────────────────────────────────────────────────────────

const assertReturnWindow = (order) => {
  const placedAt = Number(order.date) || 0;
  if (!placedAt) return;
  if (Date.now() - placedAt > RETURN_WINDOW_MS) {
    throw err(
      `Đã quá ${RETURN_WINDOW_DAYS} ngày kể từ khi đặt hàng, không thể yêu cầu trả hàng`
    );
  }
};

const releaseStock = async (order) => {
  const items = Array.isArray(order.items) ? order.items : [];
  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    if (!qty || !item._id) continue;
    try {
      if (item.variantKey) {
        await productModel.findOneAndUpdate(
          { _id: item._id, "variants.variantKey": item.variantKey },
          {
            $inc: {
              stock: qty,
              "variants.$.stock": qty,
            },
          }
        );
      } else {
        await productModel.findByIdAndUpdate(item._id, { $inc: { stock: qty } });
      }
    } catch {
      // non-fatal — log only
      console.warn(`[return] stock release failed for product ${item._id}`);
    }
  }
};

const processStripeRefund = async (order, refundAmount) => {
  if (!order.stripeSessionId) return { stripeRefundId: "", isManualRefund: true };
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
    const paymentIntentId = session.payment_intent;
    if (!paymentIntentId) return { stripeRefundId: "", isManualRefund: true };

    // amount in VND smallest unit (VND has no subunit, Stripe uses amount * 100 for VND? no — Stripe treats VND as 0-decimal)
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.round(refundAmount),
    });
    return { stripeRefundId: refund.id, isManualRefund: false };
  } catch (e) {
    console.error("[return] Stripe refund error:", e.message);
    return { stripeRefundId: "", isManualRefund: true };
  }
};

// ─── Public services ─────────────────────────────────────────────────────────

export const createReturnRequestService = async (userId, orderId, { reason, description, images }) => {
  if (!VALID_REASONS.has(reason)) throw err("Lý do không hợp lệ");

  const order = await orderModel.findById(orderId).lean();
  if (!order) throw err("Không tìm thấy đơn hàng", 404);
  if (String(order.userId) !== String(userId)) throw err("Không có quyền", 403);
  if (order.status !== "Delivered") throw err("Chỉ có thể yêu cầu trả hàng sau khi đã nhận hàng");

  assertReturnWindow(order);

  const existing = await returnRequestModel.findOne({ orderId }).lean();
  if (existing) throw err("Đơn hàng này đã có yêu cầu trả hàng");

  const returnReq = await returnRequestModel.create({
    orderId,
    userId,
    reason,
    description: String(description || "").trim().slice(0, 1000),
    images: Array.isArray(images) ? images.slice(0, 5) : [],
    refundAmount: Number(order.amount) || 0,
    paymentMethod: order.paymentMethod || "",
    status: "pending",
  });

  // Notify all vendors in this order
  const vendorIds = [
    ...new Set(
      (Array.isArray(order.vendors) ? order.vendors : [])
        .map((v) => String(v.vendorId))
        .filter(Boolean)
    ),
  ];
  for (const vendorId of vendorIds) {
    await createNotification(
      vendorId,
      "return_request",
      "Yêu cầu trả hàng mới",
      `Khách hàng đã yêu cầu trả hàng cho đơn #${String(orderId).slice(-6).toUpperCase()}`,
      orderId,
      null,
      { audience: "vendor" }
    ).catch(() => {});
  }

  return returnReq;
};

export const getReturnRequestByOrderService = async (userId, orderId) => {
  const order = await orderModel.findById(orderId).select("userId").lean();
  if (!order) throw err("Không tìm thấy đơn hàng", 404);
  if (String(order.userId) !== String(userId)) throw err("Không có quyền", 403);
  return returnRequestModel.findOne({ orderId }).lean();
};

export const getUserReturnRequestsService = async (userId) => {
  return returnRequestModel
    .find({ userId })
    .sort({ createdAt: -1 })
    .populate("orderId", "amount date paymentMethod items")
    .lean();
};

export const getVendorReturnRequestsService = async (vendorId) => {
  // Find orders that belong to this vendor
  const vendorOrders = await orderModel
    .find({ "vendors.vendorId": vendorId })
    .select("_id")
    .lean();
  const orderIds = vendorOrders.map((o) => o._id);
  return returnRequestModel
    .find({ orderId: { $in: orderIds } })
    .sort({ createdAt: -1 })
    .populate("orderId", "amount date paymentMethod items address")
    .populate("userId", "name email")
    .lean();
};

export const reviewReturnRequestService = async (vendorId, returnId, { approved, vendorNote }) => {
  const returnReq = await returnRequestModel.findById(returnId);
  if (!returnReq) throw err("Không tìm thấy yêu cầu trả hàng", 404);
  if (returnReq.status !== "pending") throw err("Yêu cầu này đã được xử lý");

  const order = await orderModel.findById(returnReq.orderId).select("vendors userId").lean();
  if (!order) throw err("Không tìm thấy đơn hàng", 404);

  const isVendorOfOrder = (order.vendors || []).some(
    (v) => String(v.vendorId) === String(vendorId)
  );
  if (!isVendorOfOrder) throw err("Không có quyền xử lý yêu cầu này", 403);

  returnReq.status = approved ? "approved" : "rejected";
  returnReq.vendorNote = String(vendorNote || "").trim().slice(0, 500);
  returnReq.reviewedAt = new Date();
  await returnReq.save();

  const title = approved ? "Yêu cầu trả hàng được chấp nhận" : "Yêu cầu trả hàng bị từ chối";
  const msg = approved
    ? "Người bán đã chấp nhận yêu cầu trả hàng. Vui lòng gửi hàng lại theo hướng dẫn."
    : `Người bán đã từ chối yêu cầu trả hàng${vendorNote ? `: ${vendorNote}` : ""}`;

  await createNotification(
    returnReq.userId,
    approved ? "return_approved" : "return_rejected",
    title,
    msg,
    returnReq.orderId,
    null,
    { audience: "user" }
  ).catch(() => {});

  return returnReq;
};

export const confirmReturnReceivedService = async (vendorId, returnId) => {
  const returnReq = await returnRequestModel.findById(returnId);
  if (!returnReq) throw err("Không tìm thấy yêu cầu trả hàng", 404);
  if (returnReq.status !== "approved") throw err("Chỉ có thể xác nhận nhận hàng sau khi đã duyệt yêu cầu");

  const order = await orderModel.findById(returnReq.orderId);
  if (!order) throw err("Không tìm thấy đơn hàng", 404);

  const isVendorOfOrder = (order.vendors || []).some(
    (v) => String(v.vendorId) === String(vendorId)
  );
  if (!isVendorOfOrder) throw err("Không có quyền xử lý yêu cầu này", 403);

  returnReq.status = "received";
  returnReq.receivedAt = new Date();
  await returnReq.save();

  // Process refund
  let refundMeta = { stripeRefundId: "", isManualRefund: true };
  if (order.paymentMethod === "Stripe" && order.stripeSessionId) {
    refundMeta = await processStripeRefund(order, returnReq.refundAmount);
  }

  returnReq.stripeRefundId = refundMeta.stripeRefundId;
  returnReq.isManualRefund  = refundMeta.isManualRefund;
  returnReq.status          = "refunded";
  returnReq.refundedAt      = new Date();
  await returnReq.save();

  // Re-increment stock
  await releaseStock(order);

  // Update order status
  order.status = "Refunded";
  await order.save();

  const refundMsg = refundMeta.isManualRefund
    ? "Hoàn tiền sẽ được xử lý thủ công trong 3–5 ngày làm việc."
    : "Số tiền đã được hoàn về phương thức thanh toán của bạn.";

  await createNotification(
    returnReq.userId,
    "return_refunded",
    "Hoàn tiền thành công",
    `Đơn hàng đã được hoàn tiền ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(returnReq.refundAmount)}. ${refundMsg}`,
    order._id,
    null,
    { audience: "user" }
  ).catch(() => {});

  return returnReq;
};
