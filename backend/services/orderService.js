import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import Stripe from "stripe";
import { createNotification } from "./notificationService.js";
import { trackInteractionService } from "./interactionService.js";
import { buildVNPayUrl, verifyVNPaySignature } from "../utils/vnpay.js";
import {
    claimVoucherUsage,
    computeOrderPricing,
    loadAndValidateVouchers,
    releaseVoucherUsage,
} from "./voucherService.js";
import {
    deleteOrderService,
    updateOrderStatusService,
    vendorOrdersService,
    updateVendorOrderStatusService,
} from "./order/orderStatusService.js";
import { vendorStatsService } from "./order/orderAnalyticsService.js";

const currency = "vnd";
export const deliveryFee = 30000;
const FREE_SHIPPING_THRESHOLD = Number(process.env.FREE_SHIPPING_THRESHOLD || 500000);

// Lazy Stripe initialization
let _stripe;
const getStripe = () => {
    if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    return _stripe;
};

const pickImageUrl = (imageLike, variant = "main") => {
    const pickFromObject = (obj) => {
        if (!obj || typeof obj !== "object") return "";
        const direct = typeof obj[variant] === "string" ? obj[variant].trim() : "";
        if (direct) return direct;
        const fallback = ["main", "url", "original", "thumb", "src"];
        for (const key of fallback) {
            const value = typeof obj[key] === "string" ? obj[key].trim() : "";
            if (value) return value;
        }
        return "";
    };

    if (Array.isArray(imageLike)) {
        for (const item of imageLike) {
            if (!item) continue;
            if (typeof item === "string" && item.trim()) return item.trim();
            const picked = pickFromObject(item);
            if (picked) return picked;
        }
        return "";
    }

    if (typeof imageLike === "string") return imageLike.trim();
    return pickFromObject(imageLike);
};

// Parse "Size: M, Màu sắc: Đỏ" -> { "Size": "M", "Màu sắc": "Đỏ" }
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
        if (!item?._id || !item?.quantity) {
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

const toSelectedAttributes = (combination = {}) =>
    Object.entries(combination || {})
        .map(([name, value]) => ({ name: String(name || '').trim(), value: String(value || '').trim() }))
        .filter((attr) => attr.name && attr.value);

const toSafePrice = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.round(parsed);
};

const sanitizeOrderAmount = (items) => {
    const itemsSubtotal = items.reduce(
        (sum, item) => sum + toSafePrice(item.price) * Number(item.quantity || 0),
        0
    );
    const shippingFee = itemsSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : deliveryFee;
    return {
        itemsSubtotal,
        shippingFee,
        totalAmount: itemsSubtotal + shippingFee,
    };
};

const buildVoucherError = (rejectedVouchers = []) => {
    const firstRejected = rejectedVouchers[0];
    const message = firstRejected?.reason || "Voucher khong hop le";
    const error = Object.assign(new Error(message), { status: 400 });
    error.code = "INVALID_VOUCHER";
    error.items = rejectedVouchers;
    return error;
};

const extractOrderVendorIds = (items = []) =>
    Array.from(new Set(items.map((item) => String(item.vendorId || "")).filter(Boolean)));

const buildOrderPricingWithVouchers = async ({
    items,
    voucherCodes = [],
    strict = true,
}) => {
    const { shippingFee } = sanitizeOrderAmount(items);
    const { vouchers, rejectedVouchers: rejectedOnLoad, normalizedCodes } = await loadAndValidateVouchers({
        voucherCodes,
        vendorIds: extractOrderVendorIds(items),
    });

    const pricingResult = computeOrderPricing({
        items,
        vouchers,
        shippingFee,
    });

    const rejectedMap = new Map();
    for (const rejected of [...rejectedOnLoad, ...pricingResult.rejectedVouchers]) {
        const code = String(rejected.code || "").trim().toUpperCase();
        if (!code || rejectedMap.has(code)) continue;
        rejectedMap.set(code, rejected);
    }
    const rejectedVouchers = Array.from(rejectedMap.values());

    if (strict && rejectedVouchers.length > 0) {
        throw buildVoucherError(rejectedVouchers);
    }

    return {
        pricing: {
            subtotal: pricingResult.subtotal,
            shopDiscount: pricingResult.shopDiscount,
            platformDiscount: pricingResult.platformDiscount,
            shippingFee: pricingResult.shippingFee,
            shippingDiscount: pricingResult.shippingDiscount,
            finalTotal: pricingResult.finalTotal,
        },
        appliedVouchers: pricingResult.appliedVouchers,
        rejectedVouchers,
        normalizedCodes,
        shopDiscountByVendor: pricingResult.shopDiscountByVendor,
    };
};

const enrichItemsWithVariantKey = (items, productMap) => {
    return items.map((item) => {
        const productId = String(item._id);
        const product = productMap.get(productId);
        if (!product || product.isActive === false) {
            throw Object.assign(new Error(`Product unavailable: ${item.name || productId}`), { status: 404 });
        }

        if (!Array.isArray(product.variants) || product.variants.length === 0) {
            return {
                _id: productId,
                name: product.name,
                price: toSafePrice(product.price),
                originalPrice: toSafePrice(product.originalPrice || product.price),
                discount: Number(product.discount || 0),
                quantity: Number(item.quantity),
                image: product.image || [],
                brand: product.brand || "",
                selectedAttributes: [],
                size: String(item.size || ""),
                variantKey: '',
                vendorId: product.vendorId,
                vendorShopName: product.vendorShopName || "",
            };
        }

        const explicitVariantKey = String(item.variantKey || '').trim();
        const fallbackCombination = getItemCombination(item);
        if (explicitVariantKey) {
            const matched = product.variants.find((variant) => variant.variantKey === explicitVariantKey);
            if (!matched) {
                throw Object.assign(new Error(`Invalid variant for product: ${item.name || productId}`), { status: 400 });
            }
            const selectedAttributes = toSelectedAttributes(matched.combination || fallbackCombination);
            return {
                _id: productId,
                name: product.name,
                price: toSafePrice(matched.price),
                originalPrice: toSafePrice(product.originalPrice || matched.price),
                discount: Number(product.discount || 0),
                quantity: Number(item.quantity),
                image: product.image || [],
                brand: product.brand || "",
                selectedAttributes,
                size: String(item.size || explicitVariantKey),
                variantKey: explicitVariantKey,
                vendorId: product.vendorId,
                vendorShopName: product.vendorShopName || "",
            };
        }

        const inferredVariantKey = buildVariantKey(fallbackCombination);
        if (!inferredVariantKey) {
            throw Object.assign(new Error(`Missing variant selection for product: ${item.name || productId}`), { status: 400 });
        }

        const matched = product.variants.find((variant) => variant.variantKey === inferredVariantKey);
        if (!matched) {
            throw Object.assign(new Error(`Variant not found for product: ${item.name || productId}`), { status: 409 });
        }

        return {
            _id: productId,
            name: product.name,
            price: toSafePrice(matched.price),
            originalPrice: toSafePrice(product.originalPrice || matched.price),
            discount: Number(product.discount || 0),
            quantity: Number(item.quantity),
            image: product.image || [],
            brand: product.brand || "",
            selectedAttributes: toSelectedAttributes(matched.combination || fallbackCombination),
            size: String(item.size || inferredVariantKey),
            variantKey: inferredVariantKey,
            vendorId: product.vendorId,
            vendorShopName: product.vendorShopName || "",
        };
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

const normalizeOrderItems = async (rawItems) => {
    validateOrderItems(rawItems);

    const productIds = [...new Set(rawItems.map((item) => String(item._id)))];
    const products = await productModel.find({ _id: { $in: productIds } })
        .select('_id name isActive stock variants price originalPrice discount image brand vendorId vendorShopName')
        .lean();

    await ensureProductVariantKeys(products);
    const productMap = new Map(products.map((product) => [String(product._id), product]));
    return enrichItemsWithVariantKey(rawItems, productMap);
};

const prepareItemsAndReserveStock = async (rawItems) => {
    const normalizedItems = await normalizeOrderItems(rawItems);
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

const buildVendorsMap = (items, shopDiscountByVendor = new Map()) => {
    const vendorsMap = new Map();
    items.forEach((item) => {
        if (!item.vendorId) return;
        const key = item.vendorId.toString();
        if (!vendorsMap.has(key)) {
            vendorsMap.set(key, {
                vendorId: item.vendorId,
                vendorShopName: item.vendorShopName || "",
                items: [],
                subtotal: 0,
                voucherDiscount: 0,
            });
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
    for (const [vendorId, discount] of shopDiscountByVendor.entries()) {
        const foundVendor = vendorsMap.get(String(vendorId));
        if (foundVendor) {
            foundVendor.voucherDiscount = Math.round(Number(discount || 0));
        }
    }
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
    console.log("ðŸ›’ Cart updated: removed ordered items");
};

const sanitizeIdempotencyKey = (raw) => {
    const key = String(raw || "").trim();
    return key ? key.slice(0, 120) : "";
};

const findOrderByIdempotency = async (userId, idempotencyKey) => {
    if (!idempotencyKey) return null;
    return orderModel.findOne({ userId, idempotencyKey }).lean();
};

export const previewOrderPricingService = async ({ items, voucherCodes = [] }) => {
    const normalizedItems = await normalizeOrderItems(items);
    const pricingResult = await buildOrderPricingWithVouchers({
        items: normalizedItems,
        voucherCodes,
        strict: false,
    });

    return {
        pricing: pricingResult.pricing,
        appliedVouchers: pricingResult.appliedVouchers,
        rejectedVouchers: pricingResult.rejectedVouchers,
    };
};

// â”€â”€â”€ Place Order (COD) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const placeOrderService = async ({
    userId,
    items,
    amount: _clientAmount,
    address,
    voucherCodes = [],
    idempotencyKey,
}) => {
    if (!userId) throw Object.assign(new Error('Missing userId'), { status: 400 });

    const normalizedIdempotencyKey = sanitizeIdempotencyKey(idempotencyKey);
    const existed = await findOrderByIdempotency(userId, normalizedIdempotencyKey);
    if (existed) return existed;

    const { normalizedItems } = await prepareItemsAndReserveStock(items);
    let pricingResult;
    try {
        pricingResult = await buildOrderPricingWithVouchers({
            items: normalizedItems,
            voucherCodes,
            strict: true,
        });
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
        await releaseVoucherUsage(pricingResult.appliedVouchers).catch(() => {});
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
                'Đơn hàng mới',
                `Bạn có đơn hàng mới: ${itemNames}`,
                newOrder._id
            );
        }

        return newOrder;
    } catch (error) {
        await releaseStockByItems(normalizedItems);
        await releaseVoucherUsage(pricingResult.appliedVouchers).catch(() => {});
        await updateProductSold(normalizedItems, -1).catch(() => {});
        throw error;
    }
};

// â”€â”€â”€ Place Order (Stripe) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const placeOrderStripeService = async ({
    userId,
    items,
    amount: _clientAmount,
    address,
    origin,
    voucherCodes = [],
    idempotencyKey,
}) => {
    if (!userId) throw Object.assign(new Error('Missing userId'), { status: 400 });

    const safeOrigin = String(origin || process.env.FRONTEND_URL || '').trim();
    if (!safeOrigin) {
        throw Object.assign(new Error('Missing frontend origin'), { status: 400 });
    }

    const normalizedIdempotencyKey = sanitizeIdempotencyKey(idempotencyKey);
    const existed = await findOrderByIdempotency(userId, normalizedIdempotencyKey);
    if (existed?.stripeSessionUrl) {
        return { orderId: existed._id, sessionUrl: existed.stripeSessionUrl };
    }

    const { normalizedItems } = await prepareItemsAndReserveStock(items);
    let pricingResult;
    try {
        pricingResult = await buildOrderPricingWithVouchers({
            items: normalizedItems,
            voucherCodes,
            strict: true,
        });
        await claimVoucherUsage(pricingResult.appliedVouchers);
    } catch (error) {
        await releaseStockByItems(normalizedItems).catch(() => {});
        throw error;
    }
    const { finalTotal } = pricingResult.pricing;

    const STRIPE_VND_LIMIT = 99_999_999;
    if (currency === 'vnd' && finalTotal > STRIPE_VND_LIMIT) {
        await releaseStockByItems(normalizedItems).catch(() => {});
        await releaseVoucherUsage(pricingResult.appliedVouchers).catch(() => {});
        throw new Error('Tổng đơn hàng vượt quá giới hạn thanh toán Stripe (₫99,999,999). Vui lòng thanh toán bằng COD hoặc chia nhỏ đơn hàng.');
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
        await releaseVoucherUsage(pricingResult.appliedVouchers).catch(() => {});
        if (error?.code === 11000 && normalizedIdempotencyKey) {
            const duplicate = await findOrderByIdempotency(userId, normalizedIdempotencyKey);
            if (duplicate?.stripeSessionUrl) {
                return { orderId: duplicate._id, sessionUrl: duplicate.stripeSessionUrl };
            }
        }
        throw error;
    }

    try {
        const line_items = [
            {
                price_data: {
                    currency,
                    product_data: {
                        name: `Order #${String(newOrder._id).slice(-6).toUpperCase()}`,
                        description: `${normalizedItems.length} items`,
                    },
                    unit_amount: Math.round(finalTotal),
                },
                quantity: 1,
            },
        ];

        const session = await getStripe().checkout.sessions.create({
            line_items,
            mode: 'payment',
            success_url: `${safeOrigin}/verify?success=true&orderId=${newOrder._id}`,
            cancel_url: `${safeOrigin}/verify?success=false&orderId=${newOrder._id}`,
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
        await releaseVoucherUsage(pricingResult.appliedVouchers).catch(() => {});
        throw error;
    }
};

// â”€â”€â”€ Verify Stripe Payment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            'Đơn hàng mới',
            `Bạn có đơn hàng mới (đã thanh toán): ${itemNames}`,
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

// â”€â”€â”€ Cancel Order â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CANCELLABLE_STATUSES = ["Order Placed", "Packing"];

/** Hoàn lại tồn kho và số lượng đã bán khi hủy đơn. */
const restoreStockAndSold = async (items, { restoreSold = true } = {}) => {
    await releaseStockByItems(items);
    if (restoreSold) {
        await updateProductSold(items, -1);
    }
};

export const cancelOrderService = async ({ orderId, userId, cancelReason, cancelledBy = "user" }) => {
    const order = await orderModel.findById(orderId);
    if (!order) throw Object.assign(new Error("Đơn hàng không tồn tại"), { status: 404 });

    // Chỉ user sở hữu đơn mới được hủy (trừ admin).
    if (cancelledBy === "user" && order.userId.toString() !== userId.toString()) {
        throw Object.assign(new Error("Bạn không có quyền hủy đơn hàng này"), { status: 403 });
    }

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

    // Cập nhật vendorStatus cho tất cả vendor trong đơn.
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
                vendor.vendorId,
                "order_cancelled",
                "Đơn hàng bị hủy",
                `Khách hàng đã hủy đơn hàng. Lý do: ${cancelReason || "Không có lý do"}`,
                order._id
            );
        }
    } else {
        await createNotification(
            order.userId,
            "order_cancelled",
            "Đơn hàng đã bị hủy",
            `Đơn hàng của bạn đã bị hủy. Lý do: ${cancelReason || "Không có lý do"}`,
            order._id
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

// â”€â”€â”€ Queries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const allOrdersService = async () => orderModel.find({}).sort({ date: -1 });

export const userOrdersService = async (userId) => orderModel.find({ userId }).sort({ date: -1 });

// â”€â”€â”€ Place Order (VNPay) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const placeOrderVNPayService = async ({
    userId,
    items,
    amount: _clientAmount,
    address,
    ipAddr,
    voucherCodes = [],
    idempotencyKey,
}) => {
    if (!userId) throw Object.assign(new Error('Missing userId'), { status: 400 });

    const normalizedIdempotencyKey = sanitizeIdempotencyKey(idempotencyKey);
    const existed = await findOrderByIdempotency(userId, normalizedIdempotencyKey);
    if (existed?.vnpPaymentUrl) {
        return { orderId: existed._id, paymentUrl: existed.vnpPaymentUrl };
    }

    const { normalizedItems } = await prepareItemsAndReserveStock(items);
    let pricingResult;
    try {
        pricingResult = await buildOrderPricingWithVouchers({
            items: normalizedItems,
            voucherCodes,
            strict: true,
        });
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
        await releaseVoucherUsage(pricingResult.appliedVouchers).catch(() => {});
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
            amount: finalTotal,
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
        await releaseVoucherUsage(pricingResult.appliedVouchers).catch(() => {});
        throw error;
    }
};

// â”€â”€â”€ Verify VNPay Return â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const verifyVNPayReturnService = async (query) => {
    const isValid = verifyVNPaySignature(query);
    if (!isValid) throw new Error('Chữ ký không hợp lệ');

    const txnRef = query.vnp_TxnRef;
    const responseCode = query.vnp_ResponseCode;
    const transactionNo = query.vnp_TransactionNo;

    const orderId = txnRef?.split('_')[0];
    if (!orderId) throw new Error('Không tìm thấy mã đơn hàng trong TxnRef');

    const order = await orderModel.findById(orderId);
    if (!order) throw new Error('Đơn hàng không tồn tại');

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
                'Đơn hàng mới',
                `Bạn có đơn hàng mới (đã thanh toán VNPay): ${itemNames}`,
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
    }).select("_id items appliedVouchers");

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
        if (Array.isArray(order.appliedVouchers) && order.appliedVouchers.length > 0) {
            await releaseVoucherUsage(order.appliedVouchers).catch(() => {});
            await orderModel.updateOne(
                { _id: order._id, voucherUsageReleasedAt: { $exists: false } },
                { $set: { voucherUsageReleasedAt: now } }
            );
        }
        expiredCount += 1;
    }

    return expiredCount;
};

export {
    deleteOrderService,
    updateOrderStatusService,
    vendorOrdersService,
    updateVendorOrderStatusService,
    vendorStatsService,
};
