import {
    placeOrderService,
    placeOrderStripeService,
    verifyStripePaymentService,
    allOrdersService,
    userOrdersService,
    updateOrderStatusService,
    vendorOrdersService,
    updateVendorOrderStatusService,
    cancelOrderService,
    vendorStatsService,
} from "../services/orderService.js";

const placeOrder = async (req, res) => {
    try {
        const { userId, items, amount, address } = req.body;
        const newOrder = await placeOrderService({ userId, items, amount, address });
        res.json({ success: true, message: "Order placed successfully", orderId: newOrder._id });
    } catch (error) {
        console.error("❌ Error placing order:", error);
        res.json({ success: false, message: error.message });
    }
};

const placeOrderStripe = async (req, res) => {
    try {
        const { userId, items, amount, address } = req.body;
        const { origin } = req.headers;
        const result = await placeOrderStripeService({ userId, items, amount, address, origin });
        res.json({ success: true, message: "Order placed successfully", ...result });
    } catch (error) {
        console.error("❌ Error placing Stripe order:", error);
        res.json({ success: false, message: error.message });
    }
};

const verifyStripePayment = async (req, res) => {
    try {
        const { orderId, success } = req.body;
        if (!orderId) return res.status(400).json({ success: false, message: "Order ID is required" });
        const paid = await verifyStripePaymentService(orderId, success);
        if (paid) {
            return res.json({ success: true, message: "Payment verified successfully" });
        }
        return res.status(400).json({ success: false, message: "Payment verification failed" });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const allOrders = async (req, res) => {
    try {
        const orders = await allOrdersService();
        res.json({ success: true, orders });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const userOrders = async (req, res) => {
    try {
        const orders = await userOrdersService(req.body.userId);
        res.json({ success: true, orders });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const order = await updateOrderStatusService(orderId, status);
        res.json({ success: true, message: "Order status updated successfully", order });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const vendorOrders = async (req, res) => {
    try {
        const orders = await vendorOrdersService(req.vendorId);
        res.json({ success: true, orders });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const updateVendorOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const order = await updateVendorOrderStatusService(orderId, status, req.vendorId);
        res.json({ success: true, message: "Order status updated successfully", order });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const cancelOrder = async (req, res) => {
    try {
        const { orderId, cancelReason } = req.body;
        const userId = req.body.userId;
        if (!orderId) return res.status(400).json({ success: false, message: "Order ID is required" });
        const order = await cancelOrderService({ orderId, userId, cancelReason, cancelledBy: "user" });
        res.json({ success: true, message: "Đơn hàng đã được hủy thành công", order });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const cancelOrderAdmin = async (req, res) => {
    try {
        const { orderId, cancelReason } = req.body;
        if (!orderId) return res.status(400).json({ success: false, message: "Order ID is required" });
        const order = await cancelOrderService({ orderId, cancelReason, cancelledBy: "admin" });
        res.json({ success: true, message: "Đơn hàng đã được hủy", order });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const vendorStats = async (req, res) => {
    try {
        const stats = await vendorStatsService(req.vendorId);
        res.json({ success: true, stats });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

export { placeOrder, allOrders, userOrders, updateOrderStatus, placeOrderStripe, verifyStripePayment, vendorOrders, updateVendorOrderStatus, cancelOrder, cancelOrderAdmin, vendorStats };
