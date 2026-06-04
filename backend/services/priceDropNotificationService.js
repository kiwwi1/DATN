import mongoose from "mongoose";
import userInteractionModel from "../models/userInteractionModel.js";
import productPriceAlertModel from "../models/productPriceAlertModel.js";
import userModel from "../models/userModel.js";
import notificationModel from "../models/notificationModel.js";
import { createNotification } from "./notificationService.js";
import { sendTelegramMessage } from "./telegramService.js";

const PRICE_DROP_DEDUP_HOURS = Number(process.env.PRICE_DROP_DEDUP_HOURS) || 24;

const formatCurrency = (n) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(n) || 0);

const calculateDiscountPct = (oldPrice, newPrice) => {
  if (!oldPrice || oldPrice <= newPrice) return 0;
  return Math.round(((oldPrice - newPrice) / oldPrice) * 100);
};

const hasProductInCartData = (cartData, productId) => {
  if (!cartData || typeof cartData !== "object") return false;
  const key = String(productId);
  const entry = cartData[key];
  if (!entry || typeof entry !== "object") return false;
  return Object.values(entry).some((qty) => Number(qty) > 0);
};

const alreadyNotifiedRecently = async (userId, productId) => {
  const since = new Date(Date.now() - PRICE_DROP_DEDUP_HOURS * 60 * 60 * 1000);
  const exists = await notificationModel.exists({
    userId,
    type: "price_drop",
    productId,
    createdAt: { $gte: since },
  });
  return !!exists;
};

export const getPriceAlertStatusService = async (userId, productId) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new Error("Invalid productId");
  }
  const item = await productPriceAlertModel.findOne({ userId, productId }).lean();
  return !!item?.enabled;
};

export const setPriceAlertSubscriptionService = async (userId, productId, enabled) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new Error("Invalid productId");
  }
  const user = await userModel.findById(userId).select("cartData").lean();
  if (!user) throw new Error("User not found");
  const nextEnabled = enabled !== false;
  if (nextEnabled && !hasProductInCartData(user.cartData, productId)) {
    throw new Error("Bạn chỉ có thể bật thông báo cho sản phẩm đã thêm vào giỏ hàng");
  }

  const updated = await productPriceAlertModel.findOneAndUpdate(
    { userId, productId },
    { $set: { enabled: nextEnabled } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return updated;
};

export const notifyPriceDrop = async ({ productBefore, productAfter }) => {
  const oldPrice = Number(productBefore?.price) || 0;
  const newPrice = Number(productAfter?.price) || 0;
  if (!productAfter?._id || oldPrice <= 0 || newPrice <= 0 || newPrice >= oldPrice) return;

  const productId = productAfter._id;
  const interactedUserIds = await userInteractionModel.distinct("userId", {
    productId,
    "interactions.addedToCart": { $gt: 0 },
  });
  if (!interactedUserIds.length) return;

  const subscribed = await productPriceAlertModel.find({
    userId: { $in: interactedUserIds },
    productId,
    enabled: true,
  }).select("userId").lean();
  const subscribedUserIds = [...new Set(subscribed.map((x) => x.userId.toString()))];
  if (!subscribedUserIds.length) return;

  const users = await userModel.find({
    _id: { $in: subscribedUserIds },
    [`cartData.${productId.toString()}`]: { $exists: true },
  }).select("_id telegramChatId cartData").lean();

  const discountPct = calculateDiscountPct(oldPrice, newPrice);
  const title = `Sản phẩm giảm giá${discountPct > 0 ? ` -${discountPct}%` : ""}`;
  const message = `${productAfter.name} vừa giảm từ ${formatCurrency(oldPrice)} xuống ${formatCurrency(newPrice)}.`;

  for (const u of users) {
    if (!hasProductInCartData(u.cartData, productId)) continue;
    if (await alreadyNotifiedRecently(u._id, productId)) continue;

    await createNotification(u._id, "price_drop", title, message, null, productId, {
      audience: "user",
    });
    if (u.telegramChatId) {
      const telegramText =
        `Giá giảm!\n${productAfter.name}\n` +
        `${formatCurrency(oldPrice)} -> ${formatCurrency(newPrice)}\n` +
        (discountPct > 0 ? `Giảm ${discountPct}%` : "");
      sendTelegramMessage(u.telegramChatId, telegramText).catch(() => {});
    }
  }
};
