import productModel from "../../models/productModel.js";
import userModel from "../../models/userModel.js";
import {
    buildReservationUnits,
    reserveStockByUnits,
} from "./stockReservationService.js";

const DEFAULT_CART_OPTION_KEY = "__default__";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const toSafePrice = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.round(parsed);
};

const pickImageUrl = (imageLike, variant = "main") => {
    const pickFromObject = (obj) => {
        if (!obj || typeof obj !== "object") return "";
        const direct = typeof obj[variant] === "string" ? obj[variant].trim() : "";
        if (direct) return direct;
        for (const key of ["main", "url", "original", "thumb", "src"]) {
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

const buildVariantKey = (combination = {}) => {
    const entries = Object.entries(combination || {})
        .map(([name, value]) => [String(name || "").trim(), String(value || "").trim()])
        .filter(([name, value]) => name && value)
        .sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) return "";
    return entries.map(([name, value]) => `${name}:${value}`).join("|");
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

export const toSelectedAttributes = (combination = {}) =>
    Object.entries(combination || {})
        .map(([name, value]) => ({
            name: String(name || "").trim(),
            value: String(value || "").trim(),
        }))
        .filter((attr) => attr.name && attr.value);

// ─── Validation ───────────────────────────────────────────────────────────────

const validateOrderItems = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        throw Object.assign(new Error("Items cannot be empty"), { status: 400 });
    }
    for (const item of items) {
        if (!item._id) throw Object.assign(new Error("Item missing _id"), { status: 400 });
        if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 1) {
            throw Object.assign(new Error(`Invalid quantity for item ${item._id}`), { status: 400 });
        }
    }
};

// ─── Variant key sync ─────────────────────────────────────────────────────────

const ensureProductVariantKeys = async (products) => {
    for (const product of products) {
        if (!Array.isArray(product.variants) || product.variants.length === 0) continue;

        const needsUpdate = product.variants.some((v) => !v.variantKey && v.combination);
        if (!needsUpdate) continue;

        const nextVariants = product.variants.map((v) => ({
            ...v,
            variantKey: v.variantKey || buildVariantKey(v.combination || {}),
        }));

        await productModel.updateOne(
            { _id: product._id },
            { $set: { variants: nextVariants } }
        );
        product.variants = nextVariants;
    }
};

// ─── Enrichment ───────────────────────────────────────────────────────────────

const enrichItemsWithVariantKey = (items, productMap) =>
    items.map((item) => {
        const product = productMap.get(String(item._id));
        if (!product) throw Object.assign(new Error(`Product ${item._id} not found`), { status: 404 });
        if (!product.isActive) throw Object.assign(new Error(`Product "${product.name}" is unavailable`), { status: 410 });

        const combination = getItemCombination(item);
        const inferredVariantKey = buildVariantKey(combination);
        let matched = null;

        if (inferredVariantKey && Array.isArray(product.variants)) {
            matched = product.variants.find((v) => v.variantKey === inferredVariantKey) || null;
        }

        return {
            _id: String(product._id),
            name: product.name,
            price: toSafePrice(matched ? matched.price : product.price),
            originalPrice: toSafePrice(product.originalPrice || matched?.price || product.price),
            discount: Number(product.discount || 0),
            quantity: Number(item.quantity),
            image: product.image || [],
            brand: product.brand || "",
            selectedAttributes: toSelectedAttributes(matched?.combination || combination),
            size: String(item.size || inferredVariantKey),
            variantKey: inferredVariantKey,
            vendorId: product.vendorId,
            vendorShopName: product.vendorShopName || "",
        };
    });

// ─── Normalize ────────────────────────────────────────────────────────────────

export const normalizeOrderItems = async (rawItems) => {
    validateOrderItems(rawItems);

    const productIds = [...new Set(rawItems.map((item) => String(item._id)))];
    const products = await productModel
        .find({ _id: { $in: productIds } })
        .select("_id name isActive stock variants price originalPrice discount image brand vendorId vendorShopName")
        .lean();

    await ensureProductVariantKeys(products);
    const productMap = new Map(products.map((p) => [String(p._id), p]));
    return enrichItemsWithVariantKey(rawItems, productMap);
};

export const prepareItemsAndReserveStock = async (rawItems) => {
    const normalizedItems = await normalizeOrderItems(rawItems);
    const reservationUnits = buildReservationUnits(normalizedItems);
    await reserveStockByUnits(reservationUnits);
    return { normalizedItems, reservationUnits };
};

// ─── Vendor map ───────────────────────────────────────────────────────────────

export const buildVendorsMap = (items, shopDiscountByVendor = new Map()) => {
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
        const found = vendorsMap.get(String(vendorId));
        if (found) found.voucherDiscount = Math.round(Number(discount || 0));
    }

    return Array.from(vendorsMap.values());
};

// ─── Cart cleanup ─────────────────────────────────────────────────────────────

export const clearOrderedItemsFromCart = async (userId, items) => {
    const user = await userModel.findById(userId);
    if (!user?.cartData) return;
    const updatedCart = { ...user.cartData };
    items.forEach((item) => {
        const pid = item._id;
        const sizeKey = item.size || item.variantKey || DEFAULT_CART_OPTION_KEY;
        if (!sizeKey) return;
        if (updatedCart[pid]?.[sizeKey]) {
            delete updatedCart[pid][sizeKey];
            if (!Object.keys(updatedCart[pid]).length) delete updatedCart[pid];
        }
    });
    await userModel.findByIdAndUpdate(userId, { cartData: updatedCart });
};

