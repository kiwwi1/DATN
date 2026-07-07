import "dotenv/config";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";
import orderModel from "../models/orderModel.js";
import reviewModel from "../models/reviewModel.js";
import userModel from "../models/userModel.js";

const BUYER_PREFIX = "seed.activity.buyer";
const BUYER_DOMAIN = "seed.activity.local";
const DEFAULT_PASSWORD = "SeedBuyer@123";
const BUYER_POOL_SIZE = Number(process.env.SEED_ACTIVITY_BUYER_COUNT || 24);
const REVIEW_RATINGS = [4, 5, 5, 4, 5, 3];
const DAY_MS = 24 * 60 * 60 * 1000;

const pick = (items) => items[Math.floor(Math.random() * items.length)];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const buildBuyerProfiles = (count) =>
  Array.from({ length: count }, (_, index) => ({
    name: `Seed Buyer ${String(index + 1).padStart(2, "0")}`,
    email: `${BUYER_PREFIX}.${String(index + 1).padStart(3, "0")}@${BUYER_DOMAIN}`,
  }));

const buildVariantKey = (combination = {}) => {
  const entries = Object.entries(combination || {})
    .map(([name, value]) => [String(name || "").trim(), String(value || "").trim()])
    .filter(([name, value]) => name && value)
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) return "";
  return entries.map(([name, value]) => `${name}:${value}`).join("|");
};

const toSelectedAttributes = (combination = {}) =>
  Object.entries(combination || {})
    .map(([name, value]) => ({ name: String(name || "").trim(), value: String(value || "").trim() }))
    .filter((entry) => entry.name && entry.value);

const buildSizeLabel = (selectedAttributes = [], fallback = "") => {
  if (selectedAttributes.length > 0) {
    return selectedAttributes.map((attr) => `${attr.name}: ${attr.value}`).join(", ");
  }
  return fallback;
};

const selectOrderOption = (product) => {
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const preferred = product.variants.find((variant) => Number(variant.stock || 0) > 0) || product.variants[0];
    const combination = preferred?.combination || {};
    const selectedAttributes = toSelectedAttributes(combination);
    const variantKey = preferred?.variantKey || buildVariantKey(combination);
    return {
      price: Number(preferred?.price || product.price || 0),
      originalPrice: Number(product.originalPrice || preferred?.price || product.price || 0),
      discount: Number(product.discount || 0),
      selectedAttributes,
      size: buildSizeLabel(selectedAttributes, variantKey),
      variantKey,
    };
  }

  if (Array.isArray(product.sizes) && product.sizes.length > 0) {
    const size = String(product.sizes[0] || "").trim();
    return {
      price: Number(product.price || 0),
      originalPrice: Number(product.originalPrice || product.price || 0),
      discount: Number(product.discount || 0),
      selectedAttributes: size ? [{ name: "Size", value: size }] : [],
      size,
      variantKey: "",
    };
  }

  return {
    price: Number(product.price || 0),
    originalPrice: Number(product.originalPrice || product.price || 0),
    discount: Number(product.discount || 0),
    selectedAttributes: [],
    size: "",
    variantKey: "",
  };
};

const buildAddress = (buyerName) => ({
  receiverName: buyerName,
  firstName: buyerName,
  lastName: "",
  email: `${String(buyerName || "buyer").replace(/\s+/g, "").toLowerCase()}@${BUYER_DOMAIN}`,
  phone: `09${String(randomInt(10000000, 99999999))}`,
  city: "Ho Chi Minh City",
  ward: "Ben Nghe Ward",
  state: "Ben Nghe Ward",
  street: "1 Nguyen Hue",
  addressLine: "1 Nguyen Hue",
  fullAddress: "1 Nguyen Hue, Ben Nghe Ward, Ho Chi Minh City",
  addressType: "home",
});

const buildReviewComment = (productName, rating) => {
  const name = String(productName || "San pham").trim();
  if (rating >= 5) {
    return `${name} dung on, dung mo ta va trai nghiem kha tot. Minh hai long voi lan mua nay.`;
  }
  if (rating === 4) {
    return `${name} nhin chung on, chat luong tot trong tam gia va giao hang dung nhu mong doi.`;
  }
  return `${name} o muc kha, dung duoc va phu hop cho nhu cau co ban.`;
};

const ensureSeedBuyers = async () => {
  const profiles = buildBuyerProfiles(BUYER_POOL_SIZE);
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  await userModel.bulkWrite(
    profiles.map((profile) => ({
      updateOne: {
        filter: { email: profile.email },
        update: {
          $set: {
            name: profile.name,
            emailVerified: true,
            role: "user",
          },
          $setOnInsert: {
            email: profile.email,
            password: hashedPassword,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  return userModel.find({ email: { $in: profiles.map((profile) => profile.email) } }).select("_id name email").lean();
};

const syncReviewStats = async (productIds) => {
  if (productIds.length === 0) return;

  const stats = await reviewModel.aggregate([
    { $match: { product: { $in: productIds } } },
    { $group: { _id: "$product", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  const statsMap = new Map(
    stats.map((entry) => [String(entry._id), { rating: Math.round((entry.avg || 0) * 10) / 10, reviewCount: entry.count || 0 }])
  );

  await productModel.bulkWrite(
    productIds.map((productId) => ({
      updateOne: {
        filter: { _id: productId },
        update: {
          $set: {
            rating: statsMap.get(String(productId))?.rating || 0,
            reviewCount: statsMap.get(String(productId))?.reviewCount || 0,
          },
        },
      },
    })),
    { ordered: false }
  );
};

const run = async () => {
  await connectDB();

  const [products, orderedProductIds, reviewedProductIds, buyers] = await Promise.all([
    productModel.find({}).select("_id name image brand price originalPrice discount vendorId vendorShopName stock sizes variants sold").lean(),
    orderModel.distinct("items._id"),
    reviewModel.distinct("product"),
    ensureSeedBuyers(),
  ]);

  const orderedSet = new Set(orderedProductIds.map((id) => String(id)));
  const reviewedSet = new Set(reviewedProductIds.map((id) => String(id)));
  const targets = products.filter((product) => {
    const id = String(product._id);
    return !orderedSet.has(id) && !reviewedSet.has(id);
  });

  console.log(`Total products: ${products.length}`);
  console.log(`Products without order and review: ${targets.length}`);

  if (targets.length === 0) {
    console.log("Nothing to seed.");
    await mongoose.disconnect();
    return;
  }

  const createdOrderIds = [];
  const touchedProductIds = [];

  for (let index = 0; index < targets.length; index += 1) {
    const product = targets[index];
    const buyer = buyers[index % buyers.length];
    const option = selectOrderOption(product);
    const quantity = 1;
    const subtotal = Number(option.price || 0) * quantity;
    const orderDate = Date.now() - randomInt(5, 120) * DAY_MS;

    const order = await orderModel.create({
      userId: buyer._id,
      items: [
        {
          _id: String(product._id),
          name: product.name,
          price: Number(option.price || 0),
          originalPrice: Number(option.originalPrice || option.price || 0),
          discount: Number(option.discount || 0),
          quantity,
          image: product.image || [],
          brand: product.brand || "",
          selectedAttributes: option.selectedAttributes,
          size: option.size,
          variantKey: option.variantKey,
          vendorId: product.vendorId,
          vendorShopName: product.vendorShopName || "",
        },
      ],
      amount: subtotal,
      pricing: {
        subtotal,
        shopDiscount: 0,
        platformDiscount: 0,
        shippingFee: 0,
        shippingDiscount: 0,
        finalTotal: subtotal,
      },
      appliedVouchers: [],
      address: buildAddress(buyer.name),
      status: "Delivered",
      paymentMethod: "COD",
      payment: true,
      date: orderDate,
      trackingNumber: `SEED-${String(product._id).slice(-6).toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
      trackingUpdatedAt: orderDate,
      vendors: [
        {
          vendorId: product.vendorId,
          vendorShopName: product.vendorShopName || "",
          items: [
            {
              productId: String(product._id),
              name: product.name,
              price: Number(option.price || 0),
              originalPrice: Number(option.originalPrice || option.price || 0),
              discount: Number(option.discount || 0),
              quantity,
              image: product.image || [],
              brand: product.brand || "",
              selectedAttributes: option.selectedAttributes,
              size: option.size,
              variantKey: option.variantKey,
            },
          ],
          subtotal,
          vendorStatus: "delivered",
          trackingNumber: `SEED-${String(product._id).slice(-6).toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
          trackingUpdatedAt: orderDate,
          voucherDiscount: 0,
          commission: 10,
        },
      ],
    });

    createdOrderIds.push(order._id);
    touchedProductIds.push(product._id);

    const rating = pick(REVIEW_RATINGS);
    const reviewCreatedAt = new Date(orderDate + randomInt(1, 4) * DAY_MS);

    await reviewModel.create({
      user: buyer._id,
      product: product._id,
      orderId: order._id,
      rating,
      comment: buildReviewComment(product.name, rating),
      images: [],
      createdAt: reviewCreatedAt,
      updatedAt: reviewCreatedAt,
    });
  }

  if (touchedProductIds.length > 0) {
    await productModel.bulkWrite(
      touchedProductIds.map((productId) => ({
        updateOne: {
          filter: { _id: productId },
          update: { $inc: { sold: 1 } },
        },
      })),
      { ordered: false }
    );
    await syncReviewStats(touchedProductIds);
  }

  console.log(`Created orders: ${createdOrderIds.length}`);
  console.log(`Created reviews: ${touchedProductIds.length}`);
  console.log("Seed completed successfully.");

  await mongoose.disconnect();
};

run()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error("Seed failed:", error);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  });

