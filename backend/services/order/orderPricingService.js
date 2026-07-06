import voucherModel from "../../models/voucherModel.js";
import {
    calcVoucherDiscount,
    computeOrderPricing,
    loadAndValidateVouchers,
} from "../voucherService.js";
import { toSafePrice, normalizeOrderItems } from "./orderItemsService.js";
import { deliveryFee, FREE_SHIPPING_THRESHOLD } from "./orderConstants.js";

// ─── Shared helpers ───────────────────────────────────────────────────────────

export const sanitizeOrderAmount = (items) => {
    const itemsSubtotal = items.reduce(
        (sum, item) => sum + toSafePrice(item.price) * Number(item.quantity || 0),
        0
    );
    const shippingFee = itemsSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : deliveryFee;
    return { itemsSubtotal, shippingFee, totalAmount: itemsSubtotal + shippingFee };
};

export const extractOrderVendorIds = (items = []) =>
    Array.from(new Set(items.map((item) => String(item.vendorId || "")).filter(Boolean)));

// ─── Pricing with vouchers ────────────────────────────────────────────────────

const buildVoucherError = (rejectedVouchers = []) => {
    const firstRejected = rejectedVouchers[0];
    const message = firstRejected?.reason || "Voucher khong hop le";
    const error = Object.assign(new Error(message), { status: 400 });
    error.code = "INVALID_VOUCHER";
    error.items = rejectedVouchers;
    return error;
};

export const buildOrderPricingWithVouchers = async ({ items, voucherCodes = [], strict = true }) => {
    const { shippingFee } = sanitizeOrderAmount(items);
    const { vouchers, rejectedVouchers: rejectedOnLoad, normalizedCodes } =
        await loadAndValidateVouchers({
            voucherCodes,
            vendorIds: extractOrderVendorIds(items),
        });

    const pricingResult = computeOrderPricing({ items, vouchers, shippingFee });

    const rejectedMap = new Map();
    for (const rejected of [...rejectedOnLoad, ...pricingResult.rejectedVouchers]) {
        const code = String(rejected.code || "").trim().toUpperCase();
        if (!code || rejectedMap.has(code)) continue;
        rejectedMap.set(code, rejected);
    }
    const rejectedVouchers = Array.from(rejectedMap.values());

    if (strict && rejectedVouchers.length > 0) throw buildVoucherError(rejectedVouchers);

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

// ─── Preview ──────────────────────────────────────────────────────────────────

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

// ─── Voucher suggestions ──────────────────────────────────────────────────────

const buildVoucherSuggestionDto = (voucher, estimatedDiscount) => ({
    voucherId: voucher._id,
    code: String(voucher.code || "").trim().toUpperCase(),
    type: voucher.type,
    discountType: voucher.discountType,
    discountValue: Number(voucher.discountValue || 0),
    maxDiscount: Number(voucher.maxDiscount || 0),
    minOrderValue: Number(voucher.minOrderValue || 0),
    startAt: Number(voucher.startAt || 0),
    endAt: Number(voucher.endAt || 0),
    description: String(voucher.description || ""),
    estimatedDiscount: Math.max(0, Math.round(Number(estimatedDiscount || 0))),
    usageLimit: Number(voucher.usageLimit || 0),
    usedCount: Number(voucher.usedCount || 0),
});

const buildVendorSuggestionMap = (items = []) => {
    const vendorsMap = new Map();
    for (const item of items) {
        const vendorId = String(item.vendorId || "");
        if (!vendorId) continue;
        if (!vendorsMap.has(vendorId)) {
            vendorsMap.set(vendorId, {
                vendorId,
                vendorShopName: String(item.vendorShopName || ""),
                subtotal: 0,
                vouchers: [],
            });
        }
        const vendor = vendorsMap.get(vendorId);
        vendor.subtotal += toSafePrice(item.price) * Number(item.quantity || 0);
        if (!vendor.vendorShopName && item.vendorShopName) {
            vendor.vendorShopName = String(item.vendorShopName);
        }
    }
    return vendorsMap;
};

const isVoucherUsageAvailable = (voucher) => {
    const usageLimit = Number(voucher?.usageLimit || 0);
    const usedCount = Number(voucher?.usedCount || 0);
    return usageLimit <= 0 || usedCount < usageLimit;
};

export const listCheckoutVoucherSuggestionsService = async ({ items }) => {
    const normalizedItems = await normalizeOrderItems(items);
    const vendorsMap = buildVendorSuggestionMap(normalizedItems);
    const subtotal = normalizedItems.reduce(
        (sum, item) => sum + toSafePrice(item.price) * Number(item.quantity || 0),
        0
    );
    const { shippingFee } = sanitizeOrderAmount(normalizedItems);

    const now = Date.now();
    const vouchers = await voucherModel
        .find({ isActive: true, startAt: { $lte: now }, endAt: { $gte: now } })
        .lean();

    const platformSuggestions = [];
    for (const voucher of vouchers) {
        if (!isVoucherUsageAvailable(voucher)) continue;

        if (voucher.type === "SHOP") {
            const vendorId = String(voucher.vendorId || "");
            const vendorGroup = vendorsMap.get(vendorId);
            if (!vendorGroup) continue;
            const discount = calcVoucherDiscount(vendorGroup.subtotal, voucher);
            if (discount <= 0) continue;
            vendorGroup.vouchers.push(buildVoucherSuggestionDto(voucher, discount));
            continue;
        }

        const baseAmount = voucher.type === "SHIPPING" ? shippingFee : subtotal;
        const discount = calcVoucherDiscount(baseAmount, voucher);
        if (discount <= 0) continue;
        platformSuggestions.push(buildVoucherSuggestionDto(voucher, discount));
    }

    const byDiscountThenExpiry = (a, b) =>
        Number(b.estimatedDiscount || 0) - Number(a.estimatedDiscount || 0) ||
        Number(a.endAt || 0) - Number(b.endAt || 0);

    const shopSuggestions = Array.from(vendorsMap.values()).map((vendor) => ({
        ...vendor,
        subtotal: Math.round(Number(vendor.subtotal || 0)),
        vouchers: vendor.vouchers.sort(byDiscountThenExpiry),
    }));

    shopSuggestions.sort((a, b) => a.vendorShopName.localeCompare(b.vendorShopName));
    platformSuggestions.sort(byDiscountThenExpiry);

    return { shopSuggestions, platformSuggestions };
};
