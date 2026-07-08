import dotenv from "dotenv";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { join } from "path";

import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";
import reviewModel from "../models/reviewModel.js";
import userModel from "../models/userModel.js";

dotenv.config({ path: join(process.cwd(), ".env") });

const SOURCE_VENDOR_EMAIL = "vendor.apple@shop.com";
const TARGET_VENDOR_EMAILS = [
  "vendor1@shop.com",
  "vendor3@shop.com",
  "vietnam@local.shop",
  "huy12345@gmail.com",
  "dquanghuy221@gmail.com",
  "huy1233333@gmail.com",
];

const SHOP_CONFIG = {
  "Shop Dien Thoai ABC": { soldMultiplier: 1.35, ratingBase: 4.9 },
  "Shop Cong Nghe 24/7": { soldMultiplier: 1.18, ratingBase: 4.8 },
  "Gian Hang Viet Nam": { soldMultiplier: 1.0, ratingBase: 4.7 },
  "huy shop": { soldMultiplier: 0.9, ratingBase: 4.6 },
  "huy shop1": { soldMultiplier: 0.8, ratingBase: 4.5 },
  "123": { soldMultiplier: 0.68, ratingBase: 4.4 },
};

const FAKE_DOMAIN = "seed.review.local";
const FAKE_PREFIX = "seed.reviewer";
const FAKE_USER_COUNT = 220;
const DAY_MS = 24 * 60 * 60 * 1000;

const FIRST_NAMES = ["An", "Binh", "Chau", "Dung", "Giang", "Ha", "Hieu", "Khanh", "Linh", "Minh", "Nam", "Ngoc", "Phuc", "Quan", "Trang", "Vy"];
const LAST_NAMES = ["Nguyen", "Tran", "Le", "Pham", "Hoang", "Phan", "Vu", "Do", "Bui", "Ngo"];

const POSITIVE_OPENERS = [
  "San pham dung nhu mo ta.",
  "Nhan hang xong trai nghiem rat on.",
  "Chat luong thuc te kha tot so voi ky vong.",
  "Dong goi can than va giao dung mau.",
];
const MID_OPENERS = [
  "San pham o muc on trong tam gia.",
  "Dung thuc te thay kha hop ly.",
  "Trai nghiem tong the kha on.",
];
const POSITIVE_CLOSERS = [
  "Se can nhac mua lai neu can.",
  "Dung hang ngay thay kha tien.",
  "Tong the minh danh gia cao lan mua nay.",
];
const MID_CLOSERS = [
  "Tam thoi van dung tot cho nhu cau co ban.",
  "Neu shop giu on chat luong thi rat ok.",
  "Muc gia va trai nghiem kha can bang.",
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (items) => items[Math.floor(Math.random() * items.length)];
const shuffle = (items) => {
  const cloned = [...items];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
  }
  return cloned;
};

const normalizeAscii = (text = "") =>
  String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/d/g, "d")
    .replace(/Ð/g, "D")
    .trim();

const buildFakeUserProfiles = (count) => {
  const profiles = [];
  for (let index = 0; index < count; index += 1) {
    profiles.push({
      name: `${LAST_NAMES[index % LAST_NAMES.length]} ${FIRST_NAMES[index % FIRST_NAMES.length]}`,
      email: `${FAKE_PREFIX}.${String(index + 1).padStart(4, "0")}@${FAKE_DOMAIN}`,
    });
  }
  return profiles;
};

const ensureFakeUsers = async () => {
  const profiles = buildFakeUserProfiles(FAKE_USER_COUNT);
  const hashedPassword = await bcrypt.hash("Reviewer@123", 10);

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

  return userModel.find({ email: { $in: profiles.map((profile) => profile.email) } }).select("_id email").lean();
};

const soldRangeByPrice = (price) => {
  const amount = Number(price) || 0;
  if (amount < 1000000) return [90, 220];
  if (amount < 5000000) return [45, 140];
  if (amount < 20000000) return [18, 75];
  if (amount < 50000000) return [8, 30];
  return [3, 12];
};

const deriveSold = (price, shopName) => {
  const [minBase, maxBase] = soldRangeByPrice(price);
  const config = SHOP_CONFIG[normalizeAscii(shopName)] || { soldMultiplier: 1, ratingBase: 4.6 };
  return Math.max(1, Math.round(randInt(minBase, maxBase) * config.soldMultiplier));
};

const deriveTargetReviewCount = (sold) => {
  if (sold >= 150) return randInt(16, 24);
  if (sold >= 80) return randInt(11, 18);
  if (sold >= 35) return randInt(7, 13);
  return randInt(5, 9);
};

const generateRating = (targetRating) => {
  const target = clamp(Number(targetRating || 4.7), 1, 5);
  const roll = Math.random();

  if (target >= 4.85) {
    if (roll < 0.68) return 5;
    if (roll < 0.95) return 4;
    return 3;
  }

  if (target >= 4.65) {
    if (roll < 0.58) return 5;
    if (roll < 0.92) return 4;
    if (roll < 0.99) return 3;
    return 2;
  }

  if (roll < 0.48) return 5;
  if (roll < 0.88) return 4;
  if (roll < 0.98) return 3;
  return 2;
};

const buildComment = (product, rating) => {
  const productLabel = [product.brand, product.name].filter(Boolean).join(" ").trim() || "San pham";
  const opener = rating >= 4 ? pick(POSITIVE_OPENERS) : pick(MID_OPENERS);
  const closer = rating >= 4 ? pick(POSITIVE_CLOSERS) : pick(MID_CLOSERS);
  return `${opener} ${productLabel} dung on, shop giao nhanh. ${closer}`.trim();
};

const buildCreatedAt = () => {
  const daysAgo = randInt(3, 180);
  const hourOffset = randInt(0, 23);
  const minuteOffset = randInt(0, 59);
  return new Date(Date.now() - daysAgo * DAY_MS - hourOffset * 60 * 60 * 1000 - minuteOffset * 60 * 1000);
};

const loadReviewStats = async (productIds) => {
  const stats = await reviewModel.aggregate([
    { $match: { product: { $in: productIds } } },
    { $group: { _id: "$product", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  return new Map(
    stats.map((entry) => [
      String(entry._id),
      {
        count: Number(entry.count || 0),
        avg: Number(entry.avg || 0),
      },
    ])
  );
};

const main = async () => {
  await connectDB();

  const sourceVendor = await userModel.findOne({ email: SOURCE_VENDOR_EMAIL, role: "vendor" }).select("_id shopName").lean();
  if (!sourceVendor) throw new Error("Source vendor not found");

  const matchedVendors = await userModel
    .find({ role: "vendor", email: { $in: TARGET_VENDOR_EMAILS } })
    .select("_id shopName email")
    .lean();
  if (matchedVendors.length !== TARGET_VENDOR_EMAILS.length) {
    throw new Error(`Expected ${TARGET_VENDOR_EMAILS.length} target vendors, found ${matchedVendors.length}`);
  }

  const targetVendorIds = matchedVendors.map((vendor) => vendor._id);
  const clonedProducts = await productModel
    .find({
      vendorId: { $in: targetVendorIds },
      tags: `cloned-source-vendor:${sourceVendor._id}`,
      isActive: true,
    })
    .select("_id name brand price vendorId vendorShopName sold rating reviewCount")
    .lean();

  if (!clonedProducts.length) {
    throw new Error("No cloned Apple products found for target shops");
  }

  const fakeUsers = await ensureFakeUsers();
  const fakeUserIds = fakeUsers.map((user) => user._id);
  const productIds = clonedProducts.map((product) => product._id);

  const removed = await reviewModel.deleteMany({ product: { $in: productIds }, user: { $in: fakeUserIds } });
  const existingStats = await loadReviewStats(productIds);

  const reviewDocs = [];
  const soldOverrides = new Map();

  for (const product of clonedProducts) {
    const shopName = product.vendorShopName || "";
    const sold = deriveSold(product.price, shopName);
    soldOverrides.set(String(product._id), sold);

    const targetReviewCount = deriveTargetReviewCount(sold);
    const existingCount = existingStats.get(String(product._id))?.count || 0;
    const needed = Math.max(0, targetReviewCount - existingCount);
    const config = SHOP_CONFIG[normalizeAscii(shopName)] || { ratingBase: 4.6 };
    const targetRating = clamp(config.ratingBase + (Math.random() * 0.12 - 0.06), 4.2, 4.95);
    const reviewers = shuffle(fakeUserIds).slice(0, needed);

    for (const reviewerId of reviewers) {
      const rating = generateRating(targetRating);
      const createdAt = buildCreatedAt();
      reviewDocs.push({
        user: reviewerId,
        product: product._id,
        orderId: new mongoose.Types.ObjectId(),
        rating,
        comment: buildComment(product, rating),
        images: [],
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  if (reviewDocs.length > 0) {
    await reviewModel.insertMany(reviewDocs, { ordered: false });
  }

  const finalStats = await loadReviewStats(productIds);
  await productModel.bulkWrite(
    clonedProducts.map((product) => {
      const stats = finalStats.get(String(product._id));
      const sold = soldOverrides.get(String(product._id)) || product.sold || 0;
      return {
        updateOne: {
          filter: { _id: product._id },
          update: {
            $set: {
              sold,
              rating: stats ? Math.round(stats.avg * 10) / 10 : 0,
              reviewCount: stats ? stats.count : 0,
              bestseller: sold >= 120,
            },
          },
        },
      };
    }),
    { ordered: false }
  );

  const refreshedProducts = await productModel.find({ _id: { $in: productIds } }).select("vendorShopName sold rating reviewCount").lean();
  const summaryMap = new Map();
  for (const product of refreshedProducts) {
    const key = product.vendorShopName || "Unknown shop";
    if (!summaryMap.has(key)) {
      summaryMap.set(key, { shopName: key, products: 0, totalSold: 0, totalReviews: 0, avgRatingSum: 0 });
    }
    const row = summaryMap.get(key);
    row.products += 1;
    row.totalSold += Number(product.sold || 0);
    row.totalReviews += Number(product.reviewCount || 0);
    row.avgRatingSum += Number(product.rating || 0);
  }

  const summary = [...summaryMap.values()].map((row) => ({
    shopName: row.shopName,
    products: row.products,
    totalSold: row.totalSold,
    totalReviews: row.totalReviews,
    avgRating: Number((row.avgRatingSum / Math.max(row.products, 1)).toFixed(1)),
  }));

  console.log(JSON.stringify({
    sourceVendor: sourceVendor.shopName,
    clonedProducts: clonedProducts.length,
    removedFakeReviews: removed.deletedCount || 0,
    insertedFakeReviews: reviewDocs.length,
    summary,
  }, null, 2));

  process.exit(0);
};

main().catch((error) => {
  console.error("Seed cloned social proof failed:", error);
  process.exit(1);
});


