import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import Stripe from "stripe";
import { createNotification } from "./notificationService.js";
import { trackInteractionService } from "./interactionService.js";
import { buildVNPayUrl, verifyVNPaySignature } from "../utils/vnpay.js";
import { ensureOrderDeletable } from "./deletionGuardService.js";

const currency = "vnd";
export const deliveryFee = 30000;

// Lazy Stripe initialization
let _stripe;
const getStripe = () => {
    if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    return _stripe;
};

// Parse "Size: M, Màu sắc: Đỏ" → { "Size": "M", "Màu sắc": "Đỏ" }
const parseAttributeString = (attrStr) => {
    if (!attrStr) return {};
    const result = {};
    attrStr.split(", ").forEach((part) => {
        const colonIdx = part.indexOf(": ");
        if (colonIdx !== -1) {
            result[part.substring(0, colonIdx).trim()] = part.substring(colonIdx + 2).trim();
        }
    });
    return result;
};

const updateProductSold = async (items) => {
    for (const item of items) {
        await productModel.findByIdAndUpdate(item._id, { $inc: { sold: item.quantity } });
    }
    console.log("✅ Product sold counts updated successfully");
};

const deductVariantStock = async (items) => {
    for (const item of items) {
        const product = await productModel.findById(item._id);
        if (!product?.variants?.length) continue;

        let combination = {};
        if (item.selectedAttributes?.length) {
            item.selectedAttributes.forEach((attr) => { combination[attr.name] = attr.value; });
        } else if (item.size) {
            combination = parseAttributeString(item.size);
        }
        if (!Object.keys(combination).length) continue;

        const variantIdx = product.variants.findIndex((v) =>
            Object.entries(combination).every(([k, val]) => (v.combination || {})[k] === val)
        );
        if (variantIdx === -1) continue;

        product.variants[variantIdx].stock = Math.max(0, (product.variants[variantIdx].stock || 0) - item.quantity);
        product.stock = product.variants.reduce((s, v) => s + (v.stock || 0), 0);
        product.markModified("variants");
        await product.save();
    }
    console.log("✅ Variant stocks deducted successfully");
};

const buildVendorsMap = (items) => {
    const vendorsMap = new Map();
    items.forEach((item) => {
        if (!item.vendorId) return;
        const key = item.vendorId.toString();
        if (!vendorsMap.has(key)) {
            vendorsMap.set(key, { vendorId: item.vendorId, vendorShopName: item.vendorShopName || "", items: [], subtotal: 0 });
        }
        const vendor = vendorsMap.get(key);
        vendor.items.push({
            productId: item._id,
            name: item.name,
            price: item.price,
            originalPrice: item.originalPrice,
            discount: item.discount || 0,
            quantity: item.quantity,
            image: item.image,
            brand: item.brand,
            selectedAttributes: item.selectedAttributes,
            size: item.size,
        });
        vendor.subtotal += item.price * item.quantity;
    });
    return Array.from(vendorsMap.values());
};

const clearOrderedItemsFromCart = async (userId, items) => {
    const user = await userModel.findById(userId);
    if (!user?.cartData) return;
    const updatedCart = { ...user.cartData };
    items.forEach((item) => {
        const pid = item._id;
        const sizeKey = item.size;
        if (updatedCart[pid]?.[sizeKey]) {
            delete updatedCart[pid][sizeKey];
            if (!Object.keys(updatedCart[pid]).length) delete updatedCart[pid];
        }
    });
    await userModel.findByIdAndUpdate(userId, { cartData: updatedCart });
    console.log("🛒 Cart updated: removed ordered items");
};

// ─── Place Order (COD) ───────────────────────────────────────────────────────

export const placeOrderService = async ({ userId, items, amount, address }) => {
    if (!userId || !items?.length) throw new Error("Invalid order data: Missing required fields");
    for (const item of items) {
        if (!item._id || !item.name || !item.price || !item.quantity) {
            throw new Error("Invalid item data: Missing required fields");
        }
    }

    const vendors = buildVendorsMap(items);
    const newOrder = await orderModel.create({
        userId,
        items,
        amount,
        address,
        paymentMethod: "COD",
        payment: false,
        date: Date.now(),
        vendors: vendors.length > 0 ? vendors : undefined,
    });

    await updateProductSold(items);
    await deductVariantStock(items);
    await clearOrderedItemsFromCart(userId, items);

    // Track purchased interaction (fire-and-forget)
    for (const item of items) {
        trackInteractionService(userId, item._id, 'purchased', item.quantity).catch(() => {});
    }

    // Thông báo tới từng vendor có sản phẩm trong đơn
    for (const vendor of vendors) {
        const itemNames = vendor.items.map((i) => i.name).join(", ");
        await createNotification(
            vendor.vendorId,
            "order_placed",
            "Đơn hàng mới",
            `Bạn có đơn hàng mới: ${itemNames}`,
            newOrder._id
        );
    }

    return newOrder;
};

// ─── Place Order (Stripe) ────────────────────────────────────────────────────

export const placeOrderStripeService = async ({ userId, items, amount, address, origin }) => {
    if (!userId || !items?.length) throw new Error("Invalid order data: Missing required fields");
    for (const item of items) {
        if (!item._id || !item.name || !item.price || !item.quantity) {
            throw new Error("Invalid item data: Missing required fields");
        }
    }

    const STRIPE_VND_LIMIT = 99_999_999;
    if (currency === "vnd" && amount > STRIPE_VND_LIMIT) {
        throw new Error("Tổng đơn hàng vượt quá giới hạn thanh toán Stripe (₫99,999,999). Vui lòng thanh toán bằng COD hoặc chia nhỏ đơn hàng.");
    }

    const vendors = buildVendorsMap(items);
    const newOrder = await orderModel.create({
        userId,
        items,
        amount,
        address,
        paymentMethod: "Stripe",
        payment: false,
        date: Date.now(),
        vendors: vendors.length > 0 ? vendors : undefined,
    });

    const line_items = items.map((item) => ({
        price_data: {
            currency,
            product_data: {
                name: item.name,
                description: item.brand ? `Brand: ${item.brand}` : undefined,
                images: item.image?.length ? [item.image[0]] : undefined,
            },
            unit_amount: Math.round(item.price),
        },
        quantity: item.quantity,
    }));
    line_items.push({
        price_data: {
            currency,
            product_data: { name: "Shipping fee" },
            unit_amount: Math.round(deliveryFee),
        },
        quantity: 1,
    });

    const session = await getStripe().checkout.sessions.create({
        line_items,
        mode: "payment",
        success_url: `${origin}/verify?success=true&orderId=${newOrder._id}`,
        cancel_url: `${origin}/verify?success=false&orderId=${newOrder._id}`,
    });

    return { orderId: newOrder._id, sessionUrl: session.url };
};

// ─── Verify Stripe Payment ───────────────────────────────────────────────────

export const verifyStripePaymentService = async (orderId, success) => {
    const order = await orderModel.findById(orderId);
    if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });

    if (String(success).toLowerCase() === "true") {
        order.payment = true;
        await order.save();
        await updateProductSold(order.items);
        await deductVariantStock(order.items);
        await clearOrderedItemsFromCart(order.userId, order.items);

        // Track purchased interaction (fire-and-forget)
        for (const item of order.items) {
            trackInteractionService(order.userId, item._id, 'purchased', item.quantity).catch(() => {});
        }

        // Thông báo tới từng vendor
        const vendorsMap = buildVendorsMap(order.items);
        for (const vendor of vendorsMap) {
            const itemNames = vendor.items.map((i) => i.name).join(", ");
            await createNotification(
                vendor.vendorId,
                "order_placed",
                "Đơn hàng mới",
                `Bạn có đơn hàng mới (đã thanh toán): ${itemNames}`,
                order._id
            );
        }
        return true;
    }
    return false;
};

// ─── Cancel Order ────────────────────────────────────────────────────────────

const CANCELLABLE_STATUSES = ["Order Placed", "Packing"];

/** Hoàn lại tồn kho và số lượng đã bán khi hủy đơn. */
const restoreStockAndSold = async (items) => {
    for (const item of items) {
        // Hoàn lại sold
        await productModel.findByIdAndUpdate(item._id, { $inc: { sold: -item.quantity } });

        // Hoàn lại variant stock
        const product = await productModel.findById(item._id);
        if (!product?.variants?.length) continue;

        let combination = {};
        if (item.selectedAttributes?.length) {
            item.selectedAttributes.forEach((attr) => { combination[attr.name] = attr.value; });
        } else if (item.size) {
            combination = parseAttributeString(item.size);
        }
        if (!Object.keys(combination).length) continue;

        const variantIdx = product.variants.findIndex((v) =>
            Object.entries(combination).every(([k, val]) => (v.combination || {})[k] === val)
        );
        if (variantIdx === -1) continue;

        product.variants[variantIdx].stock = (product.variants[variantIdx].stock || 0) + item.quantity;
        product.stock = product.variants.reduce((s, v) => s + (v.stock || 0), 0);
        product.markModified("variants");
        await product.save();
    }
    console.log("✅ Stock and sold counts restored after cancellation");
};

export const cancelOrderService = async ({ orderId, userId, cancelReason, cancelledBy = "user" }) => {
    const order = await orderModel.findById(orderId);
    if (!order) throw Object.assign(new Error("Đơn hàng không tồn tại"), { status: 404 });

    // Chỉ user sở hữu đơn mới được hủy (trừ admin)
    if (cancelledBy === "user" && order.userId.toString() !== userId.toString()) {
        throw Object.assign(new Error("Bạn không có quyền hủy đơn hàng này"), { status: 403 });
    }

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
        throw Object.assign(
            new Error(`Không thể hủy đơn ở trạng thái "${order.status}". Chỉ hủy được khi đơn đang "Chờ xác nhận" hoặc "Đang đóng gói".`),
            { status: 400 }
        );
    }

    // Cập nhật trạng thái đơn hàng
    order.status = "Cancelled";
    order.cancelReason = cancelReason || "";
    order.cancelledBy = cancelledBy;
    order.cancelledAt = Date.now();

    // Cập nhật vendorStatus cho tất cả vendor trong đơn
    if (order.vendors?.length) {
        order.vendors.forEach((v) => { v.vendorStatus = "cancelled"; });
        order.markModified("vendors");
    }

    await order.save();

    // Hoàn lại stock và sold (chỉ nếu đơn đã được xác nhận thanh toán hoặc là COD)
    const shouldRestore = order.paymentMethod === "COD" || order.payment === true;
    if (shouldRestore) {
        await restoreStockAndSold(order.items);
    }

    // Thông báo
    if (cancelledBy === "user") {
        // User hủy → thông báo vendor(s)
        const vendorMap = buildVendorsMap(order.items);
        for (const vendor of vendorMap) {
            await createNotification(
                vendor.vendorId,
                "order_cancelled",
                "Đơn hàng bị hủy",
                `Khách hàng đã hủy đơn hàng. Lý do: ${cancelReason || "Không có lý do"}`,
                order._id
            );
        }
    } else {
        // Admin/vendor hủy → thông báo user
        await createNotification(
            order.userId,
            "order_cancelled",
            "Đơn hàng đã bị hủy",
            `Đơn hàng của bạn đã bị hủy. Lý do: ${cancelReason || "Không có lý do"}`,
            order._id
        );
    }

    // Stripe refund nếu đã thanh toán
    if (order.paymentMethod === "Stripe" && order.payment === true) {
        try {
            const stripe = getStripe();
            const sessions = await stripe.checkout.sessions.list({ limit: 10 });
            const session = sessions.data.find((s) => s.metadata?.orderId === orderId || s.success_url?.includes(orderId));
            if (session?.payment_intent) {
                await stripe.refunds.create({ payment_intent: session.payment_intent });
                console.log(`💰 Stripe refund created for order ${orderId}`);
            }
        } catch (err) {
            console.warn("⚠️ Stripe refund failed:", err.message);
        }
    }

    return order;
};

// ─── Queries ─────────────────────────────────────────────────────────────────

export const allOrdersService = async () => orderModel.find({}).sort({ date: -1 });

export const userOrdersService = async (userId) => orderModel.find({ userId }).sort({ date: -1 });

export const deleteOrderService = async (orderId) => {
    const order = await orderModel.findById(orderId);
    await ensureOrderDeletable(order);
    await orderModel.findByIdAndDelete(orderId);
};

const STATUS_LABEL = {
    "Packing": "Đang đóng gói",
    "Shipped": "Đang vận chuyển",
    "Out for delivery": "Đang giao hàng",
    "Delivered": "Đã giao thành công",
    "Cancelled": "Đã hủy",
};

export const updateOrderStatusService = async (orderId, status) => {
    const order = await orderModel.findById(orderId);
    if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });
    order.status = status;
    await order.save();

    const label = STATUS_LABEL[status] || status;
    await createNotification(
        order.userId,
        "order_status",
        "Cập nhật đơn hàng",
        `Đơn hàng của bạn đã chuyển sang trạng thái: ${label}`,
        order._id
    );

    return order;
};

export const vendorOrdersService = async (vendorId) => {
    const allOrders = await orderModel.find({}).sort({ date: -1 });
    return allOrders
        .filter((order) => order.items.some((item) => item.vendorId?.toString() === vendorId.toString()))
        .map((order) => {
            const vendorItems = order.items.filter((item) => item.vendorId?.toString() === vendorId.toString());
            const vendorAmount = vendorItems.reduce((total, item) => total + item.price * item.quantity, 0);
            return { ...order.toObject(), items: vendorItems, vendorAmount };
        });
};

export const updateVendorOrderStatusService = async (orderId, status, vendorId) => {
    const order = await orderModel.findById(orderId);
    if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });
    const hasVendorProducts = order.items.some((item) => item.vendorId?.toString() === vendorId.toString());
    if (!hasVendorProducts) {
        throw Object.assign(new Error("Unauthorized - This order does not contain your products"), { status: 403 });
    }
    order.status = status;
    await order.save();

    const label = STATUS_LABEL[status] || status;
    await createNotification(
        order.userId,
        "order_status",
        "Cập nhật đơn hàng",
        `Đơn hàng của bạn đã chuyển sang trạng thái: ${label}`,
        order._id
    );

    return order;
};

// ─── Place Order (VNPay) ─────────────────────────────────────────────────────

export const placeOrderVNPayService = async ({ userId, items, amount, address, ipAddr }) => {
    if (!userId || !items?.length) throw new Error("Invalid order data: Missing required fields");
    for (const item of items) {
        if (!item._id || !item.name || !item.price || !item.quantity) {
            throw new Error("Invalid item data: Missing required fields");
        }
    }

    const vendors = buildVendorsMap(items);
    const newOrder = await orderModel.create({
        userId,
        items,
        amount,
        address,
        paymentMethod: "VNPay",
        payment: false,
        date: Date.now(),
        vendors: vendors.length > 0 ? vendors : undefined,
    });

    const { paymentUrl, txnRef } = buildVNPayUrl({
        amount,
        orderId: newOrder._id.toString(),
        ipAddr,
        orderInfo: `Thanh toan don hang ${newOrder._id}`,
    });

    // Lưu txnRef để tra cứu khi VNPay callback
    await orderModel.updateOne({ _id: newOrder._id }, { vnpTxnRef: txnRef });

    return { orderId: newOrder._id, paymentUrl };
};

// ─── Verify VNPay Return ─────────────────────────────────────────────────────

export const verifyVNPayReturnService = async (query) => {
    const isValid = verifyVNPaySignature(query);
    if (!isValid) throw new Error("Chữ ký không hợp lệ");

    const txnRef = query.vnp_TxnRef;
    const responseCode = query.vnp_ResponseCode;
    const transactionNo = query.vnp_TransactionNo;

    // txnRef = "{orderId}_{timestamp}"
    const orderId = txnRef?.split("_")[0];
    if (!orderId) throw new Error("Không tìm thấy mã đơn hàng trong TxnRef");

    const order = await orderModel.findById(orderId);
    if (!order) throw new Error("Đơn hàng không tồn tại");

    if (responseCode === "00") {
        // Thành công
        if (!order.payment) {
            order.payment = true;
            order.vnp_TransactionNo = transactionNo;
            await order.save();

            await updateProductSold(order.items);
            await deductVariantStock(order.items);
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
                    `Bạn có đơn hàng mới (đã thanh toán VNPay): ${itemNames}`,
                    order._id
                );
            }
        }
        return { success: true, orderId };
    } else {
        // Thất bại hoặc người dùng huỷ
        return { success: false, orderId };
    }
};

export const vendorStatsService = async (vendorId) => {
    const MONTH_NAMES = ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];

    // --- Time boundaries ---
    const now = new Date();
    const startOfToday   = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek    = new Date(now); startOfWeek.setDate(now.getDate() - 6);   startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth   = new Date(now); startOfMonth.setDate(1);                  startOfMonth.setHours(0, 0, 0, 0);
    const thirtyDaysAgo  = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 29); thirtyDaysAgo.setHours(0, 0, 0, 0);
    const twelveMonthsAgo = new Date(now); twelveMonthsAgo.setMonth(now.getMonth() - 11); twelveMonthsAgo.setDate(1); twelveMonthsAgo.setHours(0, 0, 0, 0);

    // --- Fetch all orders & vendor products in parallel ---
    const [allOrders, products] = await Promise.all([
        orderModel.find({ "items.vendorId": vendorId }).sort({ date: -1 }).lean(),
        productModel.find({ vendorId }).select("stock name category").populate("category", "name").lean(),
    ]);

    let totalRevenue = 0, todayRevenue = 0, weekRevenue = 0, monthRevenue = 0;
    const ordersByStatus   = {};
    const revenueByDay     = {};   // last 30 days
    const ordersByMonth    = {};   // last 12 months  { "2025-01": { orders, revenue } }
    const productSalesMap  = {};

    for (const order of allOrders) {
        const isCancelled = order.status === "Cancelled";
        const vendorItems = order.items.filter(
            (item) => item.vendorId?.toString() === vendorId.toString()
        );
        const vendorRevenue = vendorItems.reduce((s, i) => s + i.price * i.quantity, 0);
        const orderDate = new Date(order.date);

        // Status counts (all orders)
        ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;

        // Monthly bar chart (last 12 months, all non-cancelled)
        if (!isCancelled && orderDate >= twelveMonthsAgo) {
            const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}`;
            if (!ordersByMonth[monthKey]) ordersByMonth[monthKey] = { orders: 0, revenue: 0 };
            ordersByMonth[monthKey].orders  += 1;
            ordersByMonth[monthKey].revenue += vendorRevenue;
        }

        if (!isCancelled) {
            totalRevenue += vendorRevenue;
            if (orderDate >= startOfToday) todayRevenue += vendorRevenue;
            if (orderDate >= startOfWeek)  weekRevenue  += vendorRevenue;
            if (orderDate >= startOfMonth) monthRevenue += vendorRevenue;

            // Daily revenue (last 30 days)
            if (orderDate >= thirtyDaysAgo) {
                const key = orderDate.toISOString().split("T")[0];
                revenueByDay[key] = (revenueByDay[key] || 0) + vendorRevenue;
            }

            // Product sales
            for (const item of vendorItems) {
                const pid = item._id?.toString();
                if (!productSalesMap[pid]) {
                    productSalesMap[pid] = { name: item.name, image: item.image?.[0] || null, sold: 0, revenue: 0 };
                }
                productSalesMap[pid].sold    += item.quantity;
                productSalesMap[pid].revenue += item.price * item.quantity;
            }
        }
    }

    // Build 30-day line chart
    const revenueChart = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = d.toISOString().split("T")[0];
        revenueChart.push({ date: key, revenue: revenueByDay[key] || 0 });
    }

    // Build 12-month bar chart
    const ordersChart = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(now.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        ordersChart.push({
            month:   MONTH_NAMES[d.getMonth()],
            orders:  ordersByMonth[key]?.orders  || 0,
            revenue: ordersByMonth[key]?.revenue || 0,
        });
    }

    // Build category pie chart data from vendor's product list
    const categoryCount = {};
    for (const p of products) {
        const catName = p.category?.name || "Khác";
        categoryCount[catName] = (categoryCount[catName] || 0) + 1;
    }
    const categoryChart = Object.entries(categoryCount)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const topSelling = Object.values(productSalesMap).sort((a, b) => b.sold - a.sold).slice(0, 5);

    const totalProducts = products.length;
    const totalStock    = products.reduce((s, p) => s + (p.stock || 0), 0);
    const lowStock      = products.filter((p) => p.stock <= 5).length;

    const recentOrders = allOrders.slice(0, 10).map((o) => ({
        _id:      o._id,
        date:     o.date,
        status:   o.status,
        amount:   o.items.filter((i) => i.vendorId?.toString() === vendorId.toString()).reduce((s, i) => s + i.price * i.quantity, 0),
        itemCount: o.items.filter((i) => i.vendorId?.toString() === vendorId.toString()).length,
    }));

    return {
        revenue:  { total: totalRevenue, today: todayRevenue, week: weekRevenue, month: monthRevenue, chart: revenueChart },
        orders:   { total: allOrders.length, byStatus: ordersByStatus, monthlyChart: ordersChart, recent: recentOrders },
        products: { total: totalProducts, totalStock, lowStock, topSelling, categoryChart },
    };
};
