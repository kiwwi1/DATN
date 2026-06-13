import orderModel from "../models/orderModel.js";
import Stripe from "stripe";
import { createNotification } from "./notificationService.js";
import { trackInteractionService } from "./interactionService.js";
import { buildVNPayUrl, verifyVNPaySignature } from "../utils/vnpay.js";
import { claimVoucherUsage, releaseVoucherUsage } from "./voucherService.js";

import { PAYMENT_RESERVATION_TTL_MS } from "./order/orderConstants.js";
import {
    updateProductSold,
    releaseStockByItems,
    restoreStockAndSold,
    expirePendingReservationsService,
} from "./order/stockReservationService.js";
import {
    prepareItemsAndReserveStock,
    buildVendorsMap,
    clearOrderedItemsFromCart,
} from "./order/orderItemsService.js";
import {
    buildOrderPricingWithVouchers,
    previewOrderPricingService,
    listCheckoutVoucherSuggestionsService,
} from "./order/orderPricingService.js";
import {
    deleteOrderService,
    updateOrderStatusService,
    vendorOrdersService,
    updateVendorOrderStatusService,
} from "./order/orderStatusService.js";
import { vendorStatsService } from "./order/orderAnalyticsService.js";

export { deliveryFee } from "./order/orderConstants.js";
export {
    previewOrderPricingService,
    listCheckoutVoucherSuggestionsService,
    expirePendingReservationsService,
    deleteOrderService,
    updateOrderStatusService,
    vendorOrdersService,
    updateVendorOrderStatusService,
    vendorStatsService,
};

// ─── Stripe ───────────────────────────────────────────────────────────────────

const currency = "vnd";

let _stripe;
const getStripe = () => {
    if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    return _stripe;
};

// ─── Idempotency ──────────────────────────────────────────────────────────────

const sanitizeIdempotencyKey = (raw) => {
    const key = String(raw || "").trim();
    return key ? key.slice(0, 120) : "";
};

const findOrderByIdempotency = async (userId, idempotencyKey) => {
    if (!idempotencyKey) return null;
    return orderModel.findOne({ userId, idempotencyKey }).lean();
};

// ─── After-payment side-effects ───────────────────────────────────────────────

const markStripeOrderPaid = async (order) => {
    if (order.payment) return false;

    order.payment = true;
    await order.save();

    await updateProductSold(order.items, 1);
    await clearOrderedItemsFromCart(order.userId, order.items);

    for (const item of order.items) {
        trackInteractionService(order.userId, item._id, "purchased", item.quantity).catch(() => {});
    }

    const vendorsMap = buildVendorsMap(order.items);
    for (const vendor of vendorsMap) {
        const itemNames = vendor.items.map((i) => i.name).join(", ");
        await createNotification(
            vendor.vendorId,
            "order_placed",
            "Đơn hàng mới",
            `Bạn có đơn hàng mới (đã thanh toán): ${itemNames}`,
            order._id,
            null,
            { audience: "vendor" }
        );
    }

    return true;
};

// ─── Place Order — COD ────────────────────────────────────────────────────────

export const placeOrderService = async ({
    userId, items, amount: _clientAmount, address, voucherCodes = [], idempotencyKey,
}) => {
    if (!userId) throw Object.assign(new Error("Missing userId"), { status: 400 });

    const normalizedIdempotencyKey = sanitizeIdempotencyKey(idempotencyKey);
    const existed = await findOrderByIdempotency(userId, normalizedIdempotencyKey);
    if (existed) return existed;

    const { normalizedItems } = await prepareItemsAndReserveStock(items);
    let pricingResult;
    try {
        pricingResult = await buildOrderPricingWithVouchers({ items: normalizedItems, voucherCodes, strict: true });
    } catch (error) {
        await releaseStockByItems(normalizedItems).catch(() => {});
        throw error;
    }

    try {
        await claimVoucherUsage(pricingResult.appliedVouchers);
    } catch (error) {
        await releaseStockByItems(normalizedItems).catch(() => {});
        throw error;
    }

    const now = Date.now();
    const vendors = buildVendorsMap(normalizedItems, pricingResult.shopDiscountByVendor);

    let newOrder;
    try {
        newOrder = await orderModel.create({
            userId,
            items: normalizedItems,
            amount: pricingResult.pricing.finalTotal,
            pricing: pricingResult.pricing,
            appliedVouchers: pricingResult.appliedVouchers,
            address,
            paymentMethod: "COD",
            payment: false,
            date: now,
            stockReservedAt: now,
            reservationExpiresAt: now + PAYMENT_RESERVATION_TTL_MS,
            idempotencyKey: normalizedIdempotencyKey || undefined,
            vendors: vendors.length > 0 ? vendors : undefined,
        });
    } catch (error) {
        await releaseStockByItems(normalizedItems);
        await releaseVoucherUsage(pricingResult.appliedVouchers).catch(() => {});
        if (error?.code === 11000 && normalizedIdempotencyKey) {
            const duplicate = await findOrderByIdempotency(userId, normalizedIdempotencyKey);
            if (duplicate) return duplicate;
        }
        throw error;
    }

    await updateProductSold(normalizedItems, 1);
    await clearOrderedItemsFromCart(userId, normalizedItems);

    for (const item of normalizedItems) {
        trackInteractionService(userId, item._id, "purchased", item.quantity).catch(() => {});
    }
    for (const vendor of vendors) {
        const itemNames = vendor.items.map((i) => i.name).join(", ");
        await createNotification(
            vendor.vendorId, "order_placed", "Đơn hàng mới",
            `Bạn có đơn hàng mới: ${itemNames}`,
            newOrder._id, null, { audience: "vendor" }
        );
    }

    return newOrder;
};

// ─── Place Order — Stripe ─────────────────────────────────────────────────────

export const placeOrderStripeService = async ({
    userId, items, amount: _clientAmount, address, origin, voucherCodes = [], idempotencyKey,
}) => {
    if (!userId) throw Object.assign(new Error("Missing userId"), { status: 400 });

    const safeOrigin = String(origin || process.env.FRONTEND_URL || "").trim();
    if (!safeOrigin) throw Object.assign(new Error("Missing frontend origin"), { status: 400 });

    const normalizedIdempotencyKey = sanitizeIdempotencyKey(idempotencyKey);
    const existed = await findOrderByIdempotency(userId, normalizedIdempotencyKey);
    if (existed?.stripeSessionUrl) return { orderId: existed._id, sessionUrl: existed.stripeSessionUrl };

    const { normalizedItems } = await prepareItemsAndReserveStock(items);
    let pricingResult;
    try {
        pricingResult = await buildOrderPricingWithVouchers({ items: normalizedItems, voucherCodes, strict: true });
        await claimVoucherUsage(pricingResult.appliedVouchers);
    } catch (error) {
        await releaseStockByItems(normalizedItems).catch(() => {});
        throw error;
    }

    const { finalTotal } = pricingResult.pricing;
    const STRIPE_VND_LIMIT = 999_000_000;
    if (currency === "vnd" && finalTotal > STRIPE_VND_LIMIT) {
        await releaseStockByItems(normalizedItems).catch(() => {});
        await releaseVoucherUsage(pricingResult.appliedVouchers).catch(() => {});
        throw new Error("Tổng đơn hàng vượt quá giới hạn thanh toán Stripe (₫999,000,000). Vui lòng thanh toán bằng COD hoặc chia nhỏ đơn hàng.");
    }

    const now = Date.now();
    const vendors = buildVendorsMap(normalizedItems, pricingResult.shopDiscountByVendor);

    let newOrder;
    try {
        newOrder = await orderModel.create({
            userId,
            items: normalizedItems,
            amount: finalTotal,
            pricing: pricingResult.pricing,
            appliedVouchers: pricingResult.appliedVouchers,
            address,
            paymentMethod: "Stripe",
            payment: false,
            date: now,
            stockReservedAt: now,
            reservationExpiresAt: now + PAYMENT_RESERVATION_TTL_MS,
            idempotencyKey: normalizedIdempotencyKey || undefined,
            vendors: vendors.length > 0 ? vendors : undefined,
        });
    } catch (error) {
        await releaseStockByItems(normalizedItems);
        await releaseVoucherUsage(pricingResult.appliedVouchers).catch(() => {});
        if (error?.code === 11000 && normalizedIdempotencyKey) {
            const duplicate = await findOrderByIdempotency(userId, normalizedIdempotencyKey);
            if (duplicate?.stripeSessionUrl) return { orderId: duplicate._id, sessionUrl: duplicate.stripeSessionUrl };
        }
        throw error;
    }

    try {
        const session = await getStripe().checkout.sessions.create({
            line_items: [{
                price_data: {
                    currency,
                    product_data: {
                        name: `Order #${String(newOrder._id).slice(-6).toUpperCase()}`,
                        description: `${normalizedItems.length} items`,
                    },
                    unit_amount: Math.round(finalTotal),
                },
                quantity: 1,
            }],
            mode: "payment",
            success_url: `${safeOrigin}/verify?success=true&orderId=${newOrder._id}`,
            cancel_url: `${safeOrigin}/verify?success=false&orderId=${newOrder._id}`,
            metadata: { orderId: String(newOrder._id) },
        });

        await orderModel.updateOne(
            { _id: newOrder._id },
            { $set: { stripeSessionId: session.id, stripeSessionUrl: session.url } }
        );

        return { orderId: newOrder._id, sessionUrl: session.url };
    } catch (error) {
        await releaseStockByItems(normalizedItems);
        await releaseVoucherUsage(pricingResult.appliedVouchers).catch(() => {});
        throw error;
    }
};

// ─── Place Order — VNPay ──────────────────────────────────────────────────────

export const placeOrderVNPayService = async ({
    userId, items, amount: _clientAmount, address, ipAddr, voucherCodes = [], idempotencyKey,
}) => {
    if (!userId) throw Object.assign(new Error("Missing userId"), { status: 400 });

    const normalizedIdempotencyKey = sanitizeIdempotencyKey(idempotencyKey);
    const existed = await findOrderByIdempotency(userId, normalizedIdempotencyKey);
    if (existed?.vnpPaymentUrl) return { orderId: existed._id, paymentUrl: existed.vnpPaymentUrl };

    const { normalizedItems } = await prepareItemsAndReserveStock(items);
    let pricingResult;
    try {
        pricingResult = await buildOrderPricingWithVouchers({ items: normalizedItems, voucherCodes, strict: true });
        await claimVoucherUsage(pricingResult.appliedVouchers);
    } catch (error) {
        await releaseStockByItems(normalizedItems).catch(() => {});
        throw error;
    }

    const { finalTotal } = pricingResult.pricing;
    const now = Date.now();
    const vendors = buildVendorsMap(normalizedItems, pricingResult.shopDiscountByVendor);

    let newOrder;
    try {
        newOrder = await orderModel.create({
            userId,
            items: normalizedItems,
            amount: finalTotal,
            pricing: pricingResult.pricing,
            appliedVouchers: pricingResult.appliedVouchers,
            address,
            paymentMethod: "VNPay",
            payment: false,
            date: now,
            stockReservedAt: now,
            reservationExpiresAt: now + PAYMENT_RESERVATION_TTL_MS,
            idempotencyKey: normalizedIdempotencyKey || undefined,
            vendors: vendors.length > 0 ? vendors : undefined,
        });
    } catch (error) {
        await releaseStockByItems(normalizedItems);
        await releaseVoucherUsage(pricingResult.appliedVouchers).catch(() => {});
        if (error?.code === 11000 && normalizedIdempotencyKey) {
            const duplicate = await findOrderByIdempotency(userId, normalizedIdempotencyKey);
            if (duplicate?.vnpPaymentUrl) return { orderId: duplicate._id, paymentUrl: duplicate.vnpPaymentUrl };
        }
        throw error;
    }

    try {
        const { paymentUrl, txnRef } = buildVNPayUrl({
            amount: finalTotal,
            orderId: newOrder._id.toString(),
            ipAddr,
            orderInfo: `Thanh toan don hang ${newOrder._id}`,
        });

        await orderModel.updateOne(
            { _id: newOrder._id },
            { $set: { vnpTxnRef: txnRef, vnpPaymentUrl: paymentUrl } }
        );

        return { orderId: newOrder._id, paymentUrl };
    } catch (error) {
        await releaseStockByItems(normalizedItems);
        await releaseVoucherUsage(pricingResult.appliedVouchers).catch(() => {});
        throw error;
    }
};

// ─── Stripe verification ──────────────────────────────────────────────────────

export const getStripePaymentStatusService = async (orderId, userId) => {
    const order = await orderModel.findById(orderId);
    if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });
    if (order.userId.toString() !== userId.toString())
        throw Object.assign(new Error("Unauthorized to access this order"), { status: 403 });
    if (order.paymentMethod !== "Stripe")
        throw Object.assign(new Error("Order is not a Stripe payment"), { status: 400 });

    let verifiedVia = "database";
    if (!order.payment && order.stripeSessionId) {
        try {
            const session = await getStripe().checkout.sessions.retrieve(order.stripeSessionId);
            if (session?.payment_status === "paid") {
                const metadataOrderId = String(session?.metadata?.orderId || "");
                if (metadataOrderId && metadataOrderId !== String(order._id)) {
                    throw Object.assign(new Error("Stripe session metadata mismatch"), { status: 409 });
                }
                await markStripeOrderPaid(order);
                verifiedVia = "stripe_api_paid";
            } else {
                verifiedVia = `stripe_api_${session?.payment_status || "unpaid"}`;
            }
        } catch (error) {
            console.warn("[stripe] verify-stripe fallback failed:", error.message);
            verifiedVia = "stripe_api_error";
        }
    }

    return { paid: !!order.payment, orderId: order._id, paymentMethod: order.paymentMethod, status: order.status, verifiedVia };
};

export const processStripeWebhookService = async ({ rawBody, signature }) => {
    const webhookSecrets = String(process.env.STRIPE_WEBHOOK_SECRET || "")
        .split(",").map((s) => s.trim()).filter(Boolean);
    if (webhookSecrets.length === 0)
        throw Object.assign(new Error("STRIPE_WEBHOOK_SECRET is not configured"), { status: 500 });
    if (!signature)
        throw Object.assign(new Error("Missing Stripe signature"), { status: 400 });

    let event, verifyError;
    for (const secret of webhookSecrets) {
        try {
            event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
            verifyError = null;
            break;
        } catch (error) {
            verifyError = error;
        }
    }
    if (!event) throw Object.assign(new Error(`Invalid Stripe signature: ${verifyError?.message || "unknown"}`), { status: 400 });

    if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type))
        return { processed: false, reason: `ignored_event:${event.type}` };

    const session = event.data.object;
    if (session?.payment_status !== "paid")
        return { processed: false, reason: `session_not_paid:${session?.payment_status || "unknown"}` };

    const orderId = session?.metadata?.orderId;
    if (!orderId) return { processed: false, reason: "missing_order_id_metadata" };

    const order = await orderModel.findById(orderId);
    if (!order) return { processed: false, reason: "order_not_found" };
    if (order.paymentMethod !== "Stripe") return { processed: false, reason: "order_payment_method_mismatch" };

    if (order.stripeSessionId && order.stripeSessionId !== session.id)
        throw Object.assign(new Error("Stripe session mismatch for this order"), { status: 409 });
    if (!order.stripeSessionId) order.stripeSessionId = session.id;

    const changed = await markStripeOrderPaid(order);
    return { processed: true, paid: true, changed };
};

// ─── VNPay verification ───────────────────────────────────────────────────────

export const verifyVNPayReturnService = async (query) => {
    const isValid = verifyVNPaySignature(query);
    if (!isValid) throw new Error("Chữ ký không hợp lệ");

    const txnRef = query.vnp_TxnRef;
    const responseCode = query.vnp_ResponseCode;
    const transactionNo = query.vnp_TransactionNo;

    const orderId = txnRef?.split("_")[0];
    if (!orderId) throw new Error("Không tìm thấy mã đơn hàng trong TxnRef");

    const order = await orderModel.findById(orderId);
    if (!order) throw new Error("Đơn hàng không tồn tại");

    if (responseCode !== "00") return { success: false, orderId };

    if (!order.payment) {
        order.payment = true;
        order.vnp_TransactionNo = transactionNo;
        await order.save();

        await updateProductSold(order.items, 1);
        await clearOrderedItemsFromCart(order.userId, order.items);

        for (const item of order.items) {
            trackInteractionService(order.userId, item._id, "purchased", item.quantity).catch(() => {});
        }

        const vendorsMap = buildVendorsMap(order.items);
        for (const vendor of vendorsMap) {
            const itemNames = vendor.items.map((i) => i.name).join(", ");
            await createNotification(
                vendor.vendorId, "order_placed", "Đơn hàng mới",
                `Bạn có đơn hàng mới (đã thanh toán VNPay): ${itemNames}`,
                order._id, null, { audience: "vendor" }
            );
        }
    }

    return { success: true, orderId };
};

// ─── Cancel ───────────────────────────────────────────────────────────────────

const CANCELLABLE_STATUSES = ["Order Placed", "Packing"];

export const cancelOrderService = async ({ orderId, userId, cancelReason, cancelledBy = "user" }) => {
    const order = await orderModel.findById(orderId);
    if (!order) throw Object.assign(new Error("Đơn hàng không tồn tại"), { status: 404 });

    if (cancelledBy === "user" && order.userId.toString() !== userId.toString())
        throw Object.assign(new Error("Bạn không có quyền hủy đơn hàng này"), { status: 403 });

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
        throw Object.assign(
            new Error(`Không thể hủy đơn ở trạng thái "${order.status}". Chỉ hủy được khi đơn đang "Chờ xác nhận" hoặc "Đang đóng gói".`),
            { status: 400 }
        );
    }

    order.status = "Cancelled";
    order.cancelReason = cancelReason || "";
    order.cancelledBy = cancelledBy;
    order.cancelledAt = Date.now();

    if (order.vendors?.length) {
        order.vendors.forEach((v) => { v.vendorStatus = "cancelled"; });
        order.markModified("vendors");
    }

    await order.save();

    const shouldReleaseStock = !!order.stockReservedAt && !order.stockReleasedAt;
    const shouldRestoreSold = order.paymentMethod === "COD" || order.payment === true;
    if (shouldReleaseStock) {
        await restoreStockAndSold(order.items, { restoreSold: shouldRestoreSold });
        order.stockReleasedAt = Date.now();
        await order.save();
    }

    const shouldReleaseVoucherUsage =
        Array.isArray(order.appliedVouchers) &&
        order.appliedVouchers.length > 0 &&
        !order.voucherUsageReleasedAt;
    if (shouldReleaseVoucherUsage) {
        await releaseVoucherUsage(order.appliedVouchers);
        order.voucherUsageReleasedAt = Date.now();
        await order.save();
    }

    if (cancelledBy === "user") {
        const vendorMap = buildVendorsMap(order.items);
        for (const vendor of vendorMap) {
            await createNotification(
                vendor.vendorId, "order_cancelled", "Đơn hàng bị hủy",
                `Khách hàng đã hủy đơn hàng. Lý do: ${cancelReason || "Không có lý do"}`,
                order._id, null, { audience: "vendor" }
            );
        }
    } else {
        const orderCode = String(order._id).slice(-6).toUpperCase();
        const itemNames = (order.items || []).map((i) => i.name).join(", ");
        const itemStr = itemNames ? ` [${itemNames}]` : "";
        await createNotification(
            order.userId, "order_cancelled", `Đơn hàng đã bị hủy #${orderCode}`,
            `Đơn hàng #${orderCode}${itemStr} của bạn đã bị hủy. Lý do: ${cancelReason || "Không có lý do"}`,
            order._id, null, { audience: "user" }
        );
    }

    if (order.paymentMethod === "Stripe" && order.payment === true) {
        try {
            const stripe = getStripe();
            const session = order.stripeSessionId
                ? await stripe.checkout.sessions.retrieve(order.stripeSessionId)
                : null;
            if (session?.payment_intent) {
                await stripe.refunds.create({ payment_intent: session.payment_intent });
                console.log(`Stripe refund created for order ${orderId}`);
            }
        } catch (err) {
            console.warn("Stripe refund failed:", err.message);
        }
    }

    return order;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export const allOrdersService = async () => orderModel.find({}).sort({ date: -1 });

export const userOrdersService = async (userId) => orderModel.find({ userId }).sort({ date: -1 });

