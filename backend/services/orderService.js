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

// Parse "Size: M, MÃƒÂ u sÃ¡ÂºÂ¯c: Ã„ÂÃ¡Â»Â" Ã¢â€ â€™ { "Size": "M", "MÃƒÂ u sÃ¡ÂºÂ¯c": "Ã„ÂÃ¡Â»Â" }
const PAYMENT_RESERVATION_TTL_MIN = Number(process.env.PAYMENT_RESERVATION_TTL_MIN || 15);
const PAYMENT_RESERVATION_TTL_MS = Math.max(1, PAYMENT_RESERVATION_TTL_MIN) * 60 * 1000;

const parseAttributeString = (attrStr) => {
    if (!attrStr) return {};
    const result = {};
    attrStr.split(', ').forEach((part) => {
        const colonIdx = part.indexOf(': ');
        if (colonIdx !== -1) {
            result[part.substring(0, colonIdx).trim()] = part.substring(colonIdx + 2).trim();
        }
    });
    return result;
};

const buildVariantKey = (combination = {}) => {
    const entries = Object.entries(combination || {})
        .map(([name, value]) => [String(name || '').trim(), String(value || '').trim()])
        .filter(([name, value]) => name && value)
        .sort(([a], [b]) => a.localeCompare(b));

    if (entries.length === 0) return '';
    return entries.map(([name, value]) => `${name}:${value}`).join('|');
};

const getItemCombination = (item) => {
    if (Array.isArray(item?.selectedAttributes) && item.selectedAttributes.length > 0) {
        const combination = {};
        for (const attr of item.selectedAttributes) {
            if (!attr?.name || attr?.value === undefined || attr?.value === null) continue;
            combination[String(attr.name).trim()] = String(attr.value).trim();
        }
        return combination;
    }

    if (item?.size) return parseAttributeString(item.size);
    return {};
};

const updateProductSold = async (items, deltaSign = 1) => {
    for (const item of items) {
        const quantity = Math.abs(Number(item.quantity) || 0) * deltaSign;
        if (quantity === 0) continue;
        await productModel.findByIdAndUpdate(item._id, { $inc: { sold: quantity } });
    }
};

const validateOrderItems = (items) => {
    if (!items?.length) {
        throw Object.assign(new Error('Invalid order data: Missing items'), { status: 400 });
    }

    for (const item of items) {
        if (!item?._id || !item?.name || !item?.price || !item?.quantity) {
            throw Object.assign(new Error('Invalid item data: Missing required fields'), { status: 400 });
        }
        if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
            throw Object.assign(new Error('Invalid item data: quantity must be greater than 0'), { status: 400 });
        }
    }
};

const ensureProductVariantKeys = async (products) => {
    for (const product of products) {
        if (!Array.isArray(product?.variants) || product.variants.length === 0) continue;

        let changed = false;
        const nextVariants = product.variants.map((variant) => {
            const combination = variant?.combination && typeof variant.combination === 'object'
                ? variant.combination
                : {};
            const variantKey = variant?.variantKey || buildVariantKey(combination);
            if (variant?.variantKey !== variantKey) changed = true;
            return { ...variant, combination, variantKey };
        });

        if (!changed) continue;

        await productModel.updateOne(
            { _id: product._id },
            { $set: { variants: nextVariants } }
        );
        product.variants = nextVariants;
    }
};

const buildOutOfStockError = ({ itemName, productId, variantKey, requested, available }) => {
    const error = Object.assign(new Error(`Product "${itemName || productId}" is out of stock`), { status: 409 });
    error.code = 'OUT_OF_STOCK';
    error.items = [{ productId, variantKey, requested, available }];
    return error;
};

const enrichItemsWithVariantKey = (items, productMap) => {
    return items.map((item) => {
        const productId = String(item._id);
        const product = productMap.get(productId);
        if (!product || product.isActive === false) {
            throw Object.assign(new Error(`Product unavailable: ${item.name || productId}`), { status: 404 });
        }

        if (!Array.isArray(product.variants) || product.variants.length === 0) {
            return { ...item, _id: productId, variantKey: '' };
        }

        const explicitVariantKey = String(item.variantKey || '').trim();
        if (explicitVariantKey) {
            const matched = product.variants.find((variant) => variant.variantKey === explicitVariantKey);
            if (!matched) {
                throw Object.assign(new Error(`Invalid variant for product: ${item.name || productId}`), { status: 400 });
            }
            return { ...item, _id: productId, variantKey: explicitVariantKey };
        }

        const inferredVariantKey = buildVariantKey(getItemCombination(item));
        if (!inferredVariantKey) {
            throw Object.assign(new Error(`Missing variant selection for product: ${item.name || productId}`), { status: 400 });
        }

        const matched = product.variants.find((variant) => variant.variantKey === inferredVariantKey);
        if (!matched) {
            throw Object.assign(new Error(`Variant not found for product: ${item.name || productId}`), { status: 409 });
        }

        return { ...item, _id: productId, variantKey: inferredVariantKey };
    });
};

const buildReservationUnits = (items) => {
    const reservationMap = new Map();

    for (const item of items) {
        const productId = String(item._id);
        const variantKey = String(item.variantKey || '');
        const key = `${productId}__${variantKey}`;
        const quantity = Number(item.quantity);

        if (!reservationMap.has(key)) {
            reservationMap.set(key, {
                key,
                productId,
                variantKey,
                quantity: 0,
                itemName: item.name,
            });
        }

        reservationMap.get(key).quantity += quantity;
    }

    return Array.from(reservationMap.values()).sort((a, b) => a.key.localeCompare(b.key));
};

const releaseStockByUnits = async (reservationUnits) => {
    for (const unit of reservationUnits) {
        const { productId, variantKey, quantity } = unit;

        if (!variantKey) {
            await productModel.updateOne(
                { _id: productId },
                { $inc: { stock: quantity } }
            );
            continue;
        }

        await productModel.updateOne(
            {
                _id: productId,
                variants: { $elemMatch: { variantKey } },
            },
            {
                $inc: {
                    stock: quantity,
                    'variants.$[variant].stock': quantity,
                },
            },
            {
                arrayFilters: [{ 'variant.variantKey': variantKey }],
            }
        );
    }
};

const reserveStockByUnits = async (reservationUnits) => {
    const reservedUnits = [];

    try {
        for (const unit of reservationUnits) {
            const { productId, variantKey, quantity, itemName } = unit;

            if (!variantKey) {
                const result = await productModel.updateOne(
                    { _id: productId, isActive: true, stock: { $gte: quantity } },
                    { $inc: { stock: -quantity } }
                );

                if (result.modifiedCount !== 1) {
                    const product = await productModel.findById(productId).select('stock').lean();
                    throw buildOutOfStockError({
                        itemName,
                        productId,
                        variantKey,
                        requested: quantity,
                        available: Number(product?.stock || 0),
                    });
                }

                reservedUnits.push(unit);
                continue;
            }

            const result = await productModel.updateOne(
                {
                    _id: productId,
                    isActive: true,
                    stock: { $gte: quantity },
                    variants: { $elemMatch: { variantKey, stock: { $gte: quantity } } },
                },
                {
                    $inc: {
                        stock: -quantity,
                        'variants.$[variant].stock': -quantity,
                    },
                },
                {
                    arrayFilters: [{ 'variant.variantKey': variantKey }],
                }
            );

            if (result.modifiedCount !== 1) {
                const currentProduct = await productModel.findById(productId).select('variants stock').lean();
                const currentVariant = (currentProduct?.variants || []).find((variant) => variant.variantKey === variantKey);
                throw buildOutOfStockError({
                    itemName,
                    productId,
                    variantKey,
                    requested: quantity,
                    available: Number(currentVariant?.stock ?? currentProduct?.stock ?? 0),
                });
            }

            reservedUnits.push(unit);
        }
    } catch (error) {
        if (reservedUnits.length > 0) {
            await releaseStockByUnits(reservedUnits).catch((rollbackError) => {
                console.warn('Rollback reserved stock failed:', rollbackError.message);
            });
        }
        throw error;
    }
};

const prepareItemsAndReserveStock = async (rawItems) => {
    validateOrderItems(rawItems);

    const productIds = [...new Set(rawItems.map((item) => String(item._id)))];
    const products = await productModel.find({ _id: { $in: productIds } })
        .select('_id name isActive stock variants')
        .lean();

    await ensureProductVariantKeys(products);
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    const normalizedItems = enrichItemsWithVariantKey(rawItems, productMap);
    const reservationUnits = buildReservationUnits(normalizedItems);
    await reserveStockByUnits(reservationUnits);

    return { normalizedItems, reservationUnits };
};

const releaseStockByItems = async (items) => {
    if (!Array.isArray(items) || items.length === 0) return;
    const normalizedItems = items.map((item) => ({
        ...item,
        _id: String(item._id),
        variantKey: String(item.variantKey || ''),
        quantity: Number(item.quantity || 0),
    }));

    const reservationUnits = buildReservationUnits(normalizedItems);
    await releaseStockByUnits(reservationUnits);
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
            variantKey: item.variantKey || "",
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
        const sizeKey = item.size || item.variantKey;
        if (!sizeKey) return;
        if (updatedCart[pid]?.[sizeKey]) {
            delete updatedCart[pid][sizeKey];
            if (!Object.keys(updatedCart[pid]).length) delete updatedCart[pid];
        }
    });
    await userModel.findByIdAndUpdate(userId, { cartData: updatedCart });
    console.log("Ã°Å¸â€ºâ€™ Cart updated: removed ordered items");
};

const sanitizeIdempotencyKey = (raw) => {
    const key = String(raw || "").trim();
    return key ? key.slice(0, 120) : "";
};

const findOrderByIdempotency = async (userId, idempotencyKey) => {
    if (!idempotencyKey) return null;
    return orderModel.findOne({ userId, idempotencyKey }).lean();
};

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Place Order (COD) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export const placeOrderService = async ({ userId, items, amount, address, idempotencyKey }) => {
    if (!userId) throw Object.assign(new Error('Missing userId'), { status: 400 });

    const normalizedIdempotencyKey = sanitizeIdempotencyKey(idempotencyKey);
    const existed = await findOrderByIdempotency(userId, normalizedIdempotencyKey);
    if (existed) return existed;

    const { normalizedItems } = await prepareItemsAndReserveStock(items);

    const now = Date.now();
    const vendors = buildVendorsMap(normalizedItems);

    let newOrder;
    try {
        newOrder = await orderModel.create({
            userId,
            items: normalizedItems,
            amount,
            address,
            paymentMethod: 'COD',
            payment: false,
            date: now,
            stockReservedAt: now,
            reservationExpiresAt: now + PAYMENT_RESERVATION_TTL_MS,
            idempotencyKey: normalizedIdempotencyKey || undefined,
            vendors: vendors.length > 0 ? vendors : undefined,
        });
    } catch (error) {
        await releaseStockByItems(normalizedItems);
        if (error?.code === 11000 && normalizedIdempotencyKey) {
            const duplicate = await findOrderByIdempotency(userId, normalizedIdempotencyKey);
            if (duplicate) return duplicate;
        }
        throw error;
    }

    try {
        await updateProductSold(normalizedItems, 1);
        await clearOrderedItemsFromCart(userId, normalizedItems);

        for (const item of normalizedItems) {
            trackInteractionService(userId, item._id, 'purchased', item.quantity).catch(() => {});
        }

        for (const vendor of vendors) {
            const itemNames = vendor.items.map((i) => i.name).join(', ');
            await createNotification(
                vendor.vendorId,
                'order_placed',
                'ÄÆ¡n hÃ ng má»›i',
                `Báº¡n cÃ³ Ä‘Æ¡n hÃ ng má»›i: ${itemNames}`,
                newOrder._id
            );
        }

        return newOrder;
    } catch (error) {
        await releaseStockByItems(normalizedItems);
        await updateProductSold(normalizedItems, -1).catch(() => {});
        throw error;
    }
};

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Place Order (Stripe) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export const placeOrderStripeService = async ({ userId, items, amount, address, origin, idempotencyKey }) => {
    if (!userId) throw Object.assign(new Error('Missing userId'), { status: 400 });

    const STRIPE_VND_LIMIT = 99_999_999;
    if (currency === 'vnd' && amount > STRIPE_VND_LIMIT) {
        throw new Error('Tá»•ng Ä‘Æ¡n hÃ ng vÆ°á»£t quÃ¡ giá»›i háº¡n thanh toÃ¡n Stripe (â‚«99,999,999). Vui lÃ²ng thanh toÃ¡n báº±ng COD hoáº·c chia nhá» Ä‘Æ¡n hÃ ng.');
    }

    const normalizedIdempotencyKey = sanitizeIdempotencyKey(idempotencyKey);
    const existed = await findOrderByIdempotency(userId, normalizedIdempotencyKey);
    if (existed?.stripeSessionUrl) {
        return { orderId: existed._id, sessionUrl: existed.stripeSessionUrl };
    }

    const { normalizedItems } = await prepareItemsAndReserveStock(items);
    const now = Date.now();
    const vendors = buildVendorsMap(normalizedItems);

    let newOrder;
    try {
        newOrder = await orderModel.create({
            userId,
            items: normalizedItems,
            amount,
            address,
            paymentMethod: 'Stripe',
            payment: false,
            date: now,
            stockReservedAt: now,
            reservationExpiresAt: now + PAYMENT_RESERVATION_TTL_MS,
            idempotencyKey: normalizedIdempotencyKey || undefined,
            vendors: vendors.length > 0 ? vendors : undefined,
        });
    } catch (error) {
        await releaseStockByItems(normalizedItems);
        if (error?.code === 11000 && normalizedIdempotencyKey) {
            const duplicate = await findOrderByIdempotency(userId, normalizedIdempotencyKey);
            if (duplicate?.stripeSessionUrl) {
                return { orderId: duplicate._id, sessionUrl: duplicate.stripeSessionUrl };
            }
        }
        throw error;
    }

    try {
        const line_items = normalizedItems.map((item) => ({
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
                product_data: { name: 'Shipping fee' },
                unit_amount: Math.round(deliveryFee),
            },
            quantity: 1,
        });

        const session = await getStripe().checkout.sessions.create({
            line_items,
            mode: 'payment',
            success_url: `${origin}/verify?success=true&orderId=${newOrder._id}`,
            cancel_url: `${origin}/verify?success=false&orderId=${newOrder._id}`,
            metadata: { orderId: String(newOrder._id) },
        });

        await orderModel.updateOne(
            { _id: newOrder._id },
            {
                $set: {
                    stripeSessionId: session.id,
                    stripeSessionUrl: session.url,
                },
            }
        );

        return { orderId: newOrder._id, sessionUrl: session.url };
    } catch (error) {
        await releaseStockByItems(normalizedItems);
        throw error;
    }
};

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Verify Stripe Payment Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const markStripeOrderPaid = async (order) => {
    if (order.payment) return false;

    order.payment = true;
    await order.save();

    await updateProductSold(order.items, 1);
    await clearOrderedItemsFromCart(order.userId, order.items);

    for (const item of order.items) {
        trackInteractionService(order.userId, item._id, 'purchased', item.quantity).catch(() => {});
    }

    const vendorsMap = buildVendorsMap(order.items);
    for (const vendor of vendorsMap) {
        const itemNames = vendor.items.map((i) => i.name).join(', ');
        await createNotification(
            vendor.vendorId,
            'order_placed',
            'Don hang moi',
            `Ban co don hang moi (da thanh toan): ${itemNames}`,
            order._id
        );
    }

    return true;
};

export const getStripePaymentStatusService = async (orderId, userId) => {
    const order = await orderModel.findById(orderId);
    if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
    if (order.userId.toString() !== userId.toString()) {
        throw Object.assign(new Error('Unauthorized to access this order'), { status: 403 });
    }
    if (order.paymentMethod !== 'Stripe') {
        throw Object.assign(new Error('Order is not a Stripe payment'), { status: 400 });
    }

    return {
        paid: !!order.payment,
        orderId: order._id,
        paymentMethod: order.paymentMethod,
        status: order.status,
    };
};

export const processStripeWebhookService = async ({ rawBody, signature }) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        throw Object.assign(new Error('STRIPE_WEBHOOK_SECRET is not configured'), { status: 500 });
    }
    if (!signature) {
        throw Object.assign(new Error('Missing Stripe signature'), { status: 400 });
    }

    let event;
    try {
        event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
        throw Object.assign(new Error(`Invalid Stripe signature: ${error.message}`), { status: 400 });
    }

    if (event.type !== 'checkout.session.completed') {
        return { processed: false, reason: `ignored_event:${event.type}` };
    }

    const session = event.data.object;
    if (session?.payment_status !== 'paid') {
        return { processed: false, reason: `session_not_paid:${session?.payment_status || 'unknown'}` };
    }

    const orderId = session?.metadata?.orderId;
    if (!orderId) {
        return { processed: false, reason: 'missing_order_id_metadata' };
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
        return { processed: false, reason: 'order_not_found' };
    }

    if (order.paymentMethod !== 'Stripe') {
        return { processed: false, reason: 'order_payment_method_mismatch' };
    }

    if (order.stripeSessionId && order.stripeSessionId !== session.id) {
        throw Object.assign(new Error('Stripe session mismatch for this order'), { status: 409 });
    }
    if (!order.stripeSessionId) {
        order.stripeSessionId = session.id;
    }

    const changed = await markStripeOrderPaid(order);
    return { processed: true, paid: true, changed };
};

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Cancel Order Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const CANCELLABLE_STATUSES = ["Order Placed", "Packing"];

/** HoÃƒÂ n lÃ¡ÂºÂ¡i tÃ¡Â»â€œn kho vÃƒÂ  sÃ¡Â»â€˜ lÃ†Â°Ã¡Â»Â£ng Ã„â€˜ÃƒÂ£ bÃƒÂ¡n khi hÃ¡Â»Â§y Ã„â€˜Ã†Â¡n. */
const restoreStockAndSold = async (items, { restoreSold = true } = {}) => {
    await releaseStockByItems(items);
    if (restoreSold) {
        await updateProductSold(items, -1);
    }
};

export const cancelOrderService = async ({ orderId, userId, cancelReason, cancelledBy = "user" }) => {
    const order = await orderModel.findById(orderId);
    if (!order) throw Object.assign(new Error("Ã„ÂÃ†Â¡n hÃƒÂ ng khÃƒÂ´ng tÃ¡Â»â€œn tÃ¡ÂºÂ¡i"), { status: 404 });

    // ChÃ¡Â»â€° user sÃ¡Â»Å¸ hÃ¡Â»Â¯u Ã„â€˜Ã†Â¡n mÃ¡Â»â€ºi Ã„â€˜Ã†Â°Ã¡Â»Â£c hÃ¡Â»Â§y (trÃ¡Â»Â« admin)
    if (cancelledBy === "user" && order.userId.toString() !== userId.toString()) {
        throw Object.assign(new Error("BÃ¡ÂºÂ¡n khÃƒÂ´ng cÃƒÂ³ quyÃ¡Â»Ân hÃ¡Â»Â§y Ã„â€˜Ã†Â¡n hÃƒÂ ng nÃƒÂ y"), { status: 403 });
    }

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
        throw Object.assign(
            new Error(`KhÃƒÂ´ng thÃ¡Â»Æ’ hÃ¡Â»Â§y Ã„â€˜Ã†Â¡n Ã¡Â»Å¸ trÃ¡ÂºÂ¡ng thÃƒÂ¡i "${order.status}". ChÃ¡Â»â€° hÃ¡Â»Â§y Ã„â€˜Ã†Â°Ã¡Â»Â£c khi Ã„â€˜Ã†Â¡n Ã„â€˜ang "ChÃ¡Â»Â xÃƒÂ¡c nhÃ¡ÂºÂ­n" hoÃ¡ÂºÂ·c "Ã„Âang Ã„â€˜ÃƒÂ³ng gÃƒÂ³i".`),
            { status: 400 }
        );
    }

    // CÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t trÃ¡ÂºÂ¡ng thÃƒÂ¡i Ã„â€˜Ã†Â¡n hÃƒÂ ng
    order.status = "Cancelled";
    order.cancelReason = cancelReason || "";
    order.cancelledBy = cancelledBy;
    order.cancelledAt = Date.now();

    // CÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t vendorStatus cho tÃ¡ÂºÂ¥t cÃ¡ÂºÂ£ vendor trong Ã„â€˜Ã†Â¡n
    if (order.vendors?.length) {
        order.vendors.forEach((v) => { v.vendorStatus = "cancelled"; });
        order.markModified("vendors");
    }

    await order.save();

    // Release reserved stock once; only restore sold when it was previously counted.
    const shouldReleaseStock = !!order.stockReservedAt && !order.stockReleasedAt;
    const shouldRestoreSold = order.paymentMethod === "COD" || order.payment === true;
    if (shouldReleaseStock) {
        await restoreStockAndSold(order.items, { restoreSold: shouldRestoreSold });
        order.stockReleasedAt = Date.now();
        await order.save();
    }

    // ThÃƒÂ´ng bÃƒÂ¡o
    if (cancelledBy === "user") {
        // User hÃ¡Â»Â§y Ã¢â€ â€™ thÃƒÂ´ng bÃƒÂ¡o vendor(s)
        const vendorMap = buildVendorsMap(order.items);
        for (const vendor of vendorMap) {
            await createNotification(
                vendor.vendorId,
                "order_cancelled",
                "Ã„ÂÃ†Â¡n hÃƒÂ ng bÃ¡Â»â€¹ hÃ¡Â»Â§y",
                `KhÃƒÂ¡ch hÃƒÂ ng Ã„â€˜ÃƒÂ£ hÃ¡Â»Â§y Ã„â€˜Ã†Â¡n hÃƒÂ ng. LÃƒÂ½ do: ${cancelReason || "KhÃƒÂ´ng cÃƒÂ³ lÃƒÂ½ do"}`,
                order._id
            );
        }
    } else {
        // Admin/vendor hÃ¡Â»Â§y Ã¢â€ â€™ thÃƒÂ´ng bÃƒÂ¡o user
        await createNotification(
            order.userId,
            "order_cancelled",
            "Ã„ÂÃ†Â¡n hÃƒÂ ng Ã„â€˜ÃƒÂ£ bÃ¡Â»â€¹ hÃ¡Â»Â§y",
            `Ã„ÂÃ†Â¡n hÃƒÂ ng cÃ¡Â»Â§a bÃ¡ÂºÂ¡n Ã„â€˜ÃƒÂ£ bÃ¡Â»â€¹ hÃ¡Â»Â§y. LÃƒÂ½ do: ${cancelReason || "KhÃƒÂ´ng cÃƒÂ³ lÃƒÂ½ do"}`,
            order._id
        );
    }

    // Stripe refund nÃ¡ÂºÂ¿u Ã„â€˜ÃƒÂ£ thanh toÃƒÂ¡n
    if (order.paymentMethod === "Stripe" && order.payment === true) {
        try {
            const stripe = getStripe();
            const session = order.stripeSessionId
                ? await stripe.checkout.sessions.retrieve(order.stripeSessionId)
                : null;
            if (session?.payment_intent) {
                await stripe.refunds.create({ payment_intent: session.payment_intent });
                console.log(`Ã°Å¸â€™Â° Stripe refund created for order ${orderId}`);
            }
        } catch (err) {
            console.warn("Ã¢Å¡Â Ã¯Â¸Â Stripe refund failed:", err.message);
        }
    }

    return order;
};

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Queries Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export const allOrdersService = async () => orderModel.find({}).sort({ date: -1 });

export const userOrdersService = async (userId) => orderModel.find({ userId }).sort({ date: -1 });

export const deleteOrderService = async (orderId) => {
    const order = await orderModel.findById(orderId);
    await ensureOrderDeletable(order);
    await orderModel.findByIdAndDelete(orderId);
};

const STATUS_LABEL = {
    "Packing": "Ã„Âang Ã„â€˜ÃƒÂ³ng gÃƒÂ³i",
    "Shipped": "Ã„Âang vÃ¡ÂºÂ­n chuyÃ¡Â»Æ’n",
    "Out for delivery": "Ã„Âang giao hÃƒÂ ng",
    "Delivered": "Ã„ÂÃƒÂ£ giao thÃƒÂ nh cÃƒÂ´ng",
    "Cancelled": "Ã„ÂÃƒÂ£ hÃ¡Â»Â§y",
};

const TRACKING_REQUIRED_STATUSES = new Set(["Shipped", "Out for delivery", "Delivered"]);

const normalizeTrackingNumber = (trackingNumber) => {
    if (trackingNumber === undefined || trackingNumber === null) return undefined;
    return String(trackingNumber).trim();
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
        "CÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t Ã„â€˜Ã†Â¡n hÃƒÂ ng",
        `Ã„ÂÃ†Â¡n hÃƒÂ ng cÃ¡Â»Â§a bÃ¡ÂºÂ¡n Ã„â€˜ÃƒÂ£ chuyÃ¡Â»Æ’n sang trÃ¡ÂºÂ¡ng thÃƒÂ¡i: ${label}`,
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

export const updateVendorOrderStatusService = async (orderId, status, vendorId, trackingNumber) => {
    const order = await orderModel.findById(orderId);
    if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });
    const hasVendorProducts = order.items.some((item) => item.vendorId?.toString() === vendorId.toString());
    if (!hasVendorProducts) {
        throw Object.assign(new Error("Unauthorized - This order does not contain your products"), { status: 403 });
    }

    const normalizedTracking = normalizeTrackingNumber(trackingNumber);
    if (TRACKING_REQUIRED_STATUSES.has(status) && !normalizedTracking && !order.trackingNumber) {
        throw Object.assign(new Error("Please provide tracking number before marking order as shipped"), { status: 400 });
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
        "CÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t Ã„â€˜Ã†Â¡n hÃƒÂ ng",
        `Ã„ÂÃ†Â¡n hÃƒÂ ng cÃ¡Â»Â§a bÃ¡ÂºÂ¡n Ã„â€˜ÃƒÂ£ chuyÃ¡Â»Æ’n sang trÃ¡ÂºÂ¡ng thÃƒÂ¡i: ${label}`,
        order._id
    );

    return order;
};

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Place Order (VNPay) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export const placeOrderVNPayService = async ({ userId, items, amount, address, ipAddr, idempotencyKey }) => {
    if (!userId) throw Object.assign(new Error('Missing userId'), { status: 400 });

    const normalizedIdempotencyKey = sanitizeIdempotencyKey(idempotencyKey);
    const existed = await findOrderByIdempotency(userId, normalizedIdempotencyKey);
    if (existed?.vnpPaymentUrl) {
        return { orderId: existed._id, paymentUrl: existed.vnpPaymentUrl };
    }

    const { normalizedItems } = await prepareItemsAndReserveStock(items);
    const now = Date.now();
    const vendors = buildVendorsMap(normalizedItems);

    let newOrder;
    try {
        newOrder = await orderModel.create({
            userId,
            items: normalizedItems,
            amount,
            address,
            paymentMethod: 'VNPay',
            payment: false,
            date: now,
            stockReservedAt: now,
            reservationExpiresAt: now + PAYMENT_RESERVATION_TTL_MS,
            idempotencyKey: normalizedIdempotencyKey || undefined,
            vendors: vendors.length > 0 ? vendors : undefined,
        });
    } catch (error) {
        await releaseStockByItems(normalizedItems);
        if (error?.code === 11000 && normalizedIdempotencyKey) {
            const duplicate = await findOrderByIdempotency(userId, normalizedIdempotencyKey);
            if (duplicate?.vnpPaymentUrl) {
                return { orderId: duplicate._id, paymentUrl: duplicate.vnpPaymentUrl };
            }
        }
        throw error;
    }

    try {
        const { paymentUrl, txnRef } = buildVNPayUrl({
            amount,
            orderId: newOrder._id.toString(),
            ipAddr,
            orderInfo: `Thanh toan don hang ${newOrder._id}`,
        });

        await orderModel.updateOne(
            { _id: newOrder._id },
            {
                $set: {
                    vnpTxnRef: txnRef,
                    vnpPaymentUrl: paymentUrl,
                },
            }
        );

        return { orderId: newOrder._id, paymentUrl };
    } catch (error) {
        await releaseStockByItems(normalizedItems);
        throw error;
    }
};

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Verify VNPay Return Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export const verifyVNPayReturnService = async (query) => {
    const isValid = verifyVNPaySignature(query);
    if (!isValid) throw new Error('Chá»¯ kÃ½ khÃ´ng há»£p lá»‡');

    const txnRef = query.vnp_TxnRef;
    const responseCode = query.vnp_ResponseCode;
    const transactionNo = query.vnp_TransactionNo;

    const orderId = txnRef?.split('_')[0];
    if (!orderId) throw new Error('KhÃ´ng tÃ¬m tháº¥y mÃ£ Ä‘Æ¡n hÃ ng trong TxnRef');

    const order = await orderModel.findById(orderId);
    if (!order) throw new Error('ÄÆ¡n hÃ ng khÃ´ng tá»“n táº¡i');

    if (responseCode !== '00') {
        return { success: false, orderId };
    }

    if (!order.payment) {
        order.payment = true;
        order.vnp_TransactionNo = transactionNo;
        await order.save();

        await updateProductSold(order.items, 1);
        await clearOrderedItemsFromCart(order.userId, order.items);

        for (const item of order.items) {
            trackInteractionService(order.userId, item._id, 'purchased', item.quantity).catch(() => {});
        }

        const vendorsMap = buildVendorsMap(order.items);
        for (const vendor of vendorsMap) {
            const itemNames = vendor.items.map((i) => i.name).join(', ');
            await createNotification(
                vendor.vendorId,
                'order_placed',
                'ÄÆ¡n hÃ ng má»›i',
                `Báº¡n cÃ³ Ä‘Æ¡n hÃ ng má»›i (Ä‘Ã£ thanh toÃ¡n VNPay): ${itemNames}`,
                order._id
            );
        }
    }

    return { success: true, orderId };
};

export const expirePendingReservationsService = async () => {
    const now = Date.now();
    const candidates = await orderModel.find({
        payment: false,
        status: { $ne: "Cancelled" },
        stockReservedAt: { $exists: true },
        stockReleasedAt: { $exists: false },
        reservationExpiresAt: { $lte: now },
        paymentMethod: { $in: ["Stripe", "VNPay"] },
    }).select("_id items");

    if (!candidates.length) return 0;

    let expiredCount = 0;
    for (const order of candidates) {
        const mark = await orderModel.updateOne(
            { _id: order._id, stockReleasedAt: { $exists: false } },
            {
                $set: {
                    status: "Cancelled",
                    cancelReason: "Payment timeout",
                    cancelledBy: "admin",
                    cancelledAt: now,
                    stockReleasedAt: now,
                },
            }
        );
        if (mark.modifiedCount !== 1) continue;
        await restoreStockAndSold(order.items, { restoreSold: false });
        expiredCount += 1;
    }

    return expiredCount;
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
        productModel
            .find({ vendorId })
            .select("stock name category image sold isActive")
            .populate("category", "name")
            .lean(),
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
        const catName = p.category?.name || "KhÃƒÂ¡c";
        categoryCount[catName] = (categoryCount[catName] || 0) + 1;
    }
    const categoryChart = Object.entries(categoryCount)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const topSelling = Object.values(productSalesMap).sort((a, b) => b.sold - a.sold).slice(0, 5);

    const slowSelling = products
        .filter((p) => p.isActive !== false)
        .sort((a, b) => {
            const sa = a.sold ?? 0;
            const sb = b.sold ?? 0;
            if (sa !== sb) return sa - sb;
            return (b.stock ?? 0) - (a.stock ?? 0);
        })
        .slice(0, 5)
        .map((p) => {
            const pid = p._id?.toString();
            const fromOrders = pid ? productSalesMap[pid] : null;
            const img = Array.isArray(p.image) ? p.image[0] : p.image;
            return {
                _id: p._id,
                name: p.name,
                image: img || null,
                sold: fromOrders?.sold ?? p.sold ?? 0,
                revenue: fromOrders?.revenue ?? 0,
                stock: p.stock ?? 0,
            };
        });

    const LOW_STOCK_THRESHOLD = 5;

    const totalProducts = products.length;
    const totalStock    = products.reduce((s, p) => s + (p.stock || 0), 0);
    const lowStock      = products.filter((p) => (p.stock ?? 0) <= LOW_STOCK_THRESHOLD).length;
    const lowStockItems = products
        .filter((p) => (p.stock ?? 0) <= LOW_STOCK_THRESHOLD)
        .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
        .slice(0, 20)
        .map((p) => {
            const img = Array.isArray(p.image) ? p.image[0] : p.image;
            return {
                _id: p._id,
                name: p.name,
                image: img || null,
                stock: p.stock ?? 0,
                isActive: p.isActive !== false,
            };
        });

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
        products: { total: totalProducts, totalStock, lowStock, lowStockItems, topSelling, slowSelling, categoryChart },
    };
};










