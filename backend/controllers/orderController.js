import {
    placeOrderService,
    placeOrderStripeService,
    getStripePaymentStatusService,
    processStripeWebhookService,
    placeOrderVNPayService,
    verifyVNPayReturnService,
    previewOrderPricingService,
    listCheckoutVoucherSuggestionsService,
    allOrdersService,
    userOrdersService,
    updateOrderStatusService,
    vendorOrdersService,
    updateVendorOrderStatusService,
    cancelOrderService,
    vendorStatsService,
    deleteOrderService,
} from "../services/orderService.js";
import { markAddressUsedService } from "../services/addressService.js";

const buildOrderErrorResponse = (res, error, fallbackMessage) => {
    return res.status(error.status || 500).json({
        success: false,
        message: error.message || fallbackMessage,
        code: error.code,
        items: error.items,
    });
};

const placeOrder = async (req, res) => {
    try {
        const { items, amount, address, addressId, voucherCodes } = req.body;
        const userId = req.userId;
        if (addressId) {
            await markAddressUsedService(userId, addressId);
        }
        const idempotencyKey = req.headers["x-idempotency-key"] || req.body?.idempotencyKey;
        const newOrder = await placeOrderService({ userId, items, amount, address, voucherCodes, idempotencyKey });
        res.json({ success: true, message: "Order placed successfully", orderId: newOrder._id });
    } catch (error) {
        console.error("Error placing order:", error);
        return buildOrderErrorResponse(res, error, "Failed to place order");
    }
};

const placeOrderStripe = async (req, res) => {
    try {
        const { items, amount, address, addressId, voucherCodes } = req.body;
        const userId = req.userId;
        if (addressId) {
            await markAddressUsedService(userId, addressId);
        }
        const { origin } = req.headers;
        const idempotencyKey = req.headers["x-idempotency-key"] || req.body?.idempotencyKey;
        const result = await placeOrderStripeService({ userId, items, amount, address, origin, voucherCodes, idempotencyKey });
        res.json({ success: true, message: "Order placed successfully", ...result });
    } catch (error) {
        console.error("Error placing Stripe order:", error);
        return buildOrderErrorResponse(res, error, "Failed to place Stripe order");
    }
};

const verifyStripePayment = async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) return res.status(400).json({ success: false, message: "Order ID is required" });
        const result = await getStripePaymentStatusService(orderId, req.userId);
        return res.json({ success: true, ...result });
    } catch (error) {
        return buildOrderErrorResponse(res, error, "Failed to fetch Stripe payment status");
    }
};

const stripeWebhook = async (req, res) => {
    try {
        const signature = req.headers["stripe-signature"];
        const result = await processStripeWebhookService({ rawBody: req.body, signature });
        return res.json({ received: true, ...result });
    } catch (error) {
        const status = error.status || 500;
        if (status >= 500) {
            console.error("Stripe webhook processing failed:", error);
        } else {
            console.warn("Stripe webhook rejected:", error.message);
        }
        return res.status(status).json({ success: false, message: error.message });
    }
};

const placeOrderVNPay = async (req, res) => {
    try {
        const { items, amount, address, addressId, voucherCodes } = req.body;
        const userId = req.userId;
        if (addressId) {
            await markAddressUsedService(userId, addressId);
        }
        const idempotencyKey = req.headers["x-idempotency-key"] || req.body?.idempotencyKey;
        const ipAddr =
            req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
            req.socket?.remoteAddress ||
            "127.0.0.1";
        const result = await placeOrderVNPayService({ userId, items, amount, address, ipAddr, voucherCodes, idempotencyKey });
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("Error placing VNPay order:", error);
        return buildOrderErrorResponse(res, error, "Failed to place VNPay order");
    }
};

const verifyVNPayReturn = async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, "") || "http://localhost:5173";
    try {
        const { success, orderId } = await verifyVNPayReturnService(req.query);
        const redirectUrl = `${frontendUrl}/verify?vnpay=1&success=${success}&orderId=${orderId}`;
        return res.redirect(redirectUrl);
    } catch (error) {
        console.error("VNPay return error:", error.message);
        return res.redirect(`${frontendUrl}/verify?vnpay=1&success=false`);
    }
};

const previewOrder = async (req, res) => {
    try {
        const { items, voucherCodes } = req.body;
        const result = await previewOrderPricingService({ items, voucherCodes });
        res.json({ success: true, ...result });
    } catch (error) {
        return buildOrderErrorResponse(res, error, "Failed to preview order pricing");
    }
};

const listCheckoutVoucherSuggestions = async (req, res) => {
    try {
        const { items } = req.body;
        const result = await listCheckoutVoucherSuggestionsService({ items });
        res.json({ success: true, ...result });
    } catch (error) {
        return buildOrderErrorResponse(res, error, "Failed to list voucher suggestions");
    }
};

const allOrders = async (req, res) => {
    try {
        const orders = await allOrdersService();
        res.json({ success: true, orders });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const userOrders = async (req, res) => {
    try {
        const orders = await userOrdersService(req.userId);
        res.json({ success: true, orders });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status, trackingNumber } = req.body;
        const order = await updateOrderStatusService(orderId, status, trackingNumber);
        res.json({ success: true, message: "Order status updated successfully", order });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const vendorOrders = async (req, res) => {
    try {
        const query = { ...req.query, ...req.body };
        const result = await vendorOrdersService(req.vendorId, query);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const updateVendorOrderStatus = async (req, res) => {
    try {
        const { orderId, status, trackingNumber, autoGenerateTracking } = req.body;
        const order = await updateVendorOrderStatusService(
            orderId,
            status,
            req.vendorId,
            trackingNumber,
            autoGenerateTracking
        );
        res.json({ success: true, message: "Order status updated successfully", order });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const cancelOrder = async (req, res) => {
    try {
        const { orderId, cancelReason } = req.body;
        const userId = req.userId;
        if (!orderId) return res.status(400).json({ success: false, message: "Order ID is required" });
        const order = await cancelOrderService({ orderId, userId, cancelReason, cancelledBy: "user" });
        res.json({ success: true, message: "Đơn hàng đã được hủy thành công", order });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};
const vendorStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const stats = await vendorStatsService(req.vendorId, { startDate, endDate });
        res.json({ success: true, stats });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const deleteOrder = async (req, res) => {
    try {
        await deleteOrderService(req.params.id);
        res.json({ success: true, message: "Order deleted successfully" });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

export {
    placeOrder,
    allOrders,
    userOrders,
    updateOrderStatus,
    placeOrderStripe,
    verifyStripePayment,
    placeOrderVNPay,
    previewOrder,
    listCheckoutVoucherSuggestions,
    verifyVNPayReturn,
    vendorOrders,
    updateVendorOrderStatus,
    cancelOrder,
    vendorStats,
    deleteOrder,
    stripeWebhook,
};
