import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import Stripe from "stripe";

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

export const updateOrderStatusService = async (orderId, status) => {
    const order = await orderModel.findById(orderId);
    if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });
    order.status = status;
    await order.save();
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
    return order;
};
