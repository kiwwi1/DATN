import productModel from "../../models/productModel.js";
import orderModel from "../../models/orderModel.js";
import { releaseVoucherUsage } from "../voucherService.js";

// ─── Sold count ──────────────────────────────────────────────────────────────

export const updateProductSold = async (items, deltaSign = 1) => {
    for (const item of items) {
        const quantity = Math.abs(Number(item.quantity) || 0) * deltaSign;
        if (quantity === 0) continue;
        await productModel.findByIdAndUpdate(item._id, { $inc: { sold: quantity } });
    }
};

// ─── Build units ─────────────────────────────────────────────────────────────

export const buildReservationUnits = (items) => {
    const reservationMap = new Map();

    for (const item of items) {
        const productId = String(item._id);
        const variantKey = String(item.variantKey || "");
        const key = `${productId}__${variantKey}`;
        const quantity = Number(item.quantity);

        if (!reservationMap.has(key)) {
            reservationMap.set(key, { key, productId, variantKey, quantity: 0, itemName: item.name });
        }
        reservationMap.get(key).quantity += quantity;
    }

    return Array.from(reservationMap.values()).sort((a, b) => a.key.localeCompare(b.key));
};

// ─── Reserve ─────────────────────────────────────────────────────────────────

const buildOutOfStockError = ({ itemName, productId, variantKey, requested, available }) => {
    const error = Object.assign(
        new Error(`Product "${itemName || productId}" is out of stock`),
        { status: 409 }
    );
    error.code = "OUT_OF_STOCK";
    error.items = [{ productId, variantKey, requested, available }];
    return error;
};

export const reserveStockByUnits = async (reservationUnits) => {
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
                    const product = await productModel.findById(productId).select("stock").lean();
                    throw buildOutOfStockError({
                        itemName, productId, variantKey,
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
                        "variants.$[variant].stock": -quantity,
                    },
                },
                { arrayFilters: [{ "variant.variantKey": variantKey }] }
            );

            if (result.modifiedCount !== 1) {
                const currentProduct = await productModel
                    .findById(productId)
                    .select("variants stock")
                    .lean();
                const currentVariant = (currentProduct?.variants || []).find(
                    (v) => v.variantKey === variantKey
                );
                throw buildOutOfStockError({
                    itemName, productId, variantKey,
                    requested: quantity,
                    available: Number(currentVariant?.stock ?? currentProduct?.stock ?? 0),
                });
            }

            reservedUnits.push(unit);
        }
    } catch (error) {
        if (reservedUnits.length > 0) {
            await releaseStockByUnits(reservedUnits).catch((e) => {
                console.warn("Rollback reserved stock failed:", e.message);
            });
        }
        throw error;
    }
};

// ─── Release ─────────────────────────────────────────────────────────────────

export const releaseStockByUnits = async (reservationUnits) => {
    for (const unit of reservationUnits) {
        const { productId, variantKey, quantity } = unit;

        if (!variantKey) {
            await productModel.updateOne({ _id: productId }, { $inc: { stock: quantity } });
            continue;
        }

        await productModel.updateOne(
            { _id: productId, variants: { $elemMatch: { variantKey } } },
            {
                $inc: {
                    stock: quantity,
                    "variants.$[variant].stock": quantity,
                },
            },
            { arrayFilters: [{ "variant.variantKey": variantKey }] }
        );
    }
};

export const releaseStockByItems = async (items) => {
    if (!Array.isArray(items) || items.length === 0) return;
    const normalizedItems = items.map((item) => ({
        ...item,
        _id: String(item._id),
        variantKey: String(item.variantKey || ""),
        quantity: Number(item.quantity || 0),
    }));
    await releaseStockByUnits(buildReservationUnits(normalizedItems));
};

export const restoreStockAndSold = async (items, { restoreSold = true } = {}) => {
    await releaseStockByItems(items);
    if (restoreSold) await updateProductSold(items, -1);
};

// ─── Expiry sweep (cron) ──────────────────────────────────────────────────────

export const expirePendingReservationsService = async () => {
    const now = Date.now();
    const candidates = await orderModel
        .find({
            payment: false,
            status: { $ne: "Cancelled" },
            stockReservedAt: { $exists: true },
            stockReleasedAt: { $exists: false },
            reservationExpiresAt: { $lte: now },
            paymentMethod: { $in: ["Stripe", "VNPay"] },
        })
        .select("_id items appliedVouchers");

    if (!candidates.length) return 0;

    let expiredCount = 0;
    for (const order of candidates) {
        const mark = await orderModel.updateOne(
            { _id: order._id, stockReleasedAt: { $exists: false } },
            {
                $set: {
                    status: "Cancelled",
                    cancelReason: "Payment timeout",
                    cancelledBy: "system",
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
