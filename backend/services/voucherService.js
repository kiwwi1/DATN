import voucherModel from "../models/voucherModel.js";

const toSafeMoney = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
};

const normalizeCode = (value) => String(value || "").trim().toUpperCase();

export const normalizeVoucherCodes = (voucherCodes = []) => {
  if (!Array.isArray(voucherCodes)) return [];
  const seen = new Set();
  const normalized = [];
  for (const rawCode of voucherCodes) {
    const code = normalizeCode(rawCode);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    normalized.push(code);
  }
  return normalized;
};

export const calcVoucherDiscount = (amount, voucher) => {
  const safeAmount = toSafeMoney(amount);
  if (!voucher || safeAmount <= 0) return 0;
  if (safeAmount < toSafeMoney(voucher.minOrderValue || 0)) return 0;

  let discount =
    voucher.discountType === "PERCENT"
      ? (safeAmount * Number(voucher.discountValue || 0)) / 100
      : Number(voucher.discountValue || 0);

  if (toSafeMoney(voucher.maxDiscount) > 0) {
    discount = Math.min(discount, toSafeMoney(voucher.maxDiscount));
  }

  return toSafeMoney(Math.min(discount, safeAmount));
};

export const assertVoucherValid = (voucher, code, now = Date.now()) => {
  if (!voucher || !voucher.isActive) {
    throw Object.assign(new Error(`Voucher "${code}" khong hop le`), { status: 400 });
  }
  if (now < Number(voucher.startAt) || now > Number(voucher.endAt)) {
    throw Object.assign(new Error(`Voucher "${code}" khong trong thoi gian ap dung`), { status: 400 });
  }
  if (Number(voucher.usageLimit || 0) > 0 && Number(voucher.usedCount || 0) >= Number(voucher.usageLimit)) {
    throw Object.assign(new Error(`Voucher "${code}" da het luot`), { status: 400 });
  }
  if (voucher.type === "SHOP" && !voucher.vendorId) {
    throw Object.assign(new Error(`Voucher "${code}" thieu thong tin shop`), { status: 400 });
  }
  return voucher;
};

const pushRejected = (rejectedVouchers, code, reason) => {
  rejectedVouchers.push({ code, reason });
};

const toIdKey = (idLike) => String(idLike || "");

export const computeOrderPricing = ({ items, vouchers, shippingFee }) => {
  const perShopSubtotal = new Map();
  const perShopDiscount = new Map();
  let subtotal = 0;

  for (const item of items || []) {
    const lineAmount = toSafeMoney(item.price) * Number(item.quantity || 0);
    subtotal += lineAmount;
    const vendorKey = toIdKey(item.vendorId);
    if (!vendorKey) continue;
    perShopSubtotal.set(vendorKey, toSafeMoney((perShopSubtotal.get(vendorKey) || 0) + lineAmount));
  }

  let shopDiscount = 0;
  let platformDiscount = 0;
  let shippingDiscount = 0;

  const appliedVouchers = [];
  const rejectedVouchers = [];
  const normalizedShippingFee = toSafeMoney(shippingFee);

  const safeVouchers = Array.isArray(vouchers) ? vouchers : [];
  const shopVouchers = safeVouchers.filter((voucher) => voucher.type === "SHOP");
  const platformVouchers = safeVouchers.filter((voucher) => voucher.type === "PLATFORM");
  const shippingVouchers = safeVouchers.filter((voucher) => voucher.type === "SHIPPING");

  const usedShopVendors = new Set();
  for (const voucher of shopVouchers) {
    const code = normalizeCode(voucher.code);
    const vendorKey = toIdKey(voucher.vendorId);

    if (usedShopVendors.has(vendorKey)) {
      pushRejected(rejectedVouchers, code, "Mỗi cửa hàng chỉ được áp dụng một voucher shop");
      continue;
    }
    usedShopVendors.add(vendorKey);

    const shopSubtotal = toSafeMoney(perShopSubtotal.get(vendorKey) || 0);
    const currentShopDiscount = toSafeMoney(perShopDiscount.get(vendorKey) || 0);
    const base = Math.max(0, shopSubtotal - currentShopDiscount);
    const minOrderValue = toSafeMoney(voucher.minOrderValue || 0);

    if (shopSubtotal <= 0) {
      pushRejected(rejectedVouchers, code, "Voucher shop khong thuoc don hang nay");
      continue;
    }
    if (base < minOrderValue) {
      pushRejected(rejectedVouchers, code, `Chua dat don toi thieu ${minOrderValue.toLocaleString("vi-VN")} VND`);
      continue;
    }

    const discount = calcVoucherDiscount(base, voucher);
    if (discount <= 0) {
      pushRejected(rejectedVouchers, code, "Voucher shop khong ap dung duoc");
      continue;
    }

    shopDiscount += discount;
    perShopDiscount.set(vendorKey, currentShopDiscount + discount);
    appliedVouchers.push({
      voucherId: voucher._id,
      code,
      type: "SHOP",
      vendorId: voucher.vendorId,
      discount,
    });
  }

  let platformApplied = false;
  for (const voucher of platformVouchers) {
    const code = normalizeCode(voucher.code);

    if (platformApplied) {
      pushRejected(rejectedVouchers, code, "Mỗi đơn hàng chỉ được áp dụng một voucher nền tảng");
      continue;
    }

    const base = Math.max(0, subtotal - shopDiscount - platformDiscount);
    const minOrderValue = toSafeMoney(voucher.minOrderValue || 0);
    if (base < minOrderValue) {
      pushRejected(rejectedVouchers, code, `Chua dat don toi thieu ${minOrderValue.toLocaleString("vi-VN")} VND`);
      continue;
    }

    const discount = calcVoucherDiscount(base, voucher);
    if (discount <= 0) {
      pushRejected(rejectedVouchers, code, "Voucher san khong ap dung duoc");
      continue;
    }

    platformDiscount += discount;
    platformApplied = true;
    appliedVouchers.push({
      voucherId: voucher._id,
      code,
      type: "PLATFORM",
      discount,
    });
  }

  let shippingApplied = false;
  for (const voucher of shippingVouchers) {
    const code = normalizeCode(voucher.code);

    if (shippingApplied) {
      pushRejected(rejectedVouchers, code, "Mỗi đơn hàng chỉ được áp dụng một voucher vận chuyển");
      continue;
    }

    const base = Math.max(0, normalizedShippingFee - shippingDiscount);
    const minOrderValue = toSafeMoney(voucher.minOrderValue || 0);
    if (base < minOrderValue) {
      pushRejected(rejectedVouchers, code, `Chua dat phi ship toi thieu ${minOrderValue.toLocaleString("vi-VN")} VND`);
      continue;
    }

    const discount = calcVoucherDiscount(base, voucher);
    if (discount <= 0) {
      pushRejected(rejectedVouchers, code, "Voucher ship khong ap dung duoc");
      continue;
    }

    shippingDiscount += discount;
    shippingApplied = true;
    appliedVouchers.push({
      voucherId: voucher._id,
      code,
      type: "SHIPPING",
      discount,
    });
  }

  const finalShippingDiscount = Math.min(shippingDiscount, normalizedShippingFee);
  const finalTotal = Math.max(0, subtotal - shopDiscount - platformDiscount + normalizedShippingFee - finalShippingDiscount);

  return {
    subtotal: toSafeMoney(subtotal),
    shopDiscount: toSafeMoney(shopDiscount),
    platformDiscount: toSafeMoney(platformDiscount),
    shippingFee: normalizedShippingFee,
    shippingDiscount: toSafeMoney(finalShippingDiscount),
    finalTotal: toSafeMoney(finalTotal),
    appliedVouchers,
    rejectedVouchers,
    shopDiscountByVendor: perShopDiscount,
  };
};

export const loadAndValidateVouchers = async ({ voucherCodes = [], vendorIds = [], now = Date.now() }) => {
  const normalizedCodes = normalizeVoucherCodes(voucherCodes);
  if (normalizedCodes.length === 0) {
    return { vouchers: [], rejectedVouchers: [], normalizedCodes: [] };
  }

  const vouchers = await voucherModel.find({ code: { $in: normalizedCodes } }).lean();
  const voucherMap = new Map(vouchers.map((voucher) => [normalizeCode(voucher.code), voucher]));
  const vendorIdSet = new Set((Array.isArray(vendorIds) ? vendorIds : []).map(toIdKey).filter(Boolean));
  const validVouchers = [];
  const rejectedVouchers = [];

  for (const code of normalizedCodes) {
    const voucher = voucherMap.get(code);
    try {
      assertVoucherValid(voucher, code, now);
      if (voucher.type === "SHOP" && !vendorIdSet.has(toIdKey(voucher.vendorId))) {
        pushRejected(rejectedVouchers, code, "Voucher shop khong thuoc don hang nay");
        continue;
      }
      validVouchers.push(voucher);
    } catch (error) {
      pushRejected(rejectedVouchers, code, error.message);
    }
  }

  return {
    vouchers: validVouchers,
    rejectedVouchers,
    normalizedCodes,
  };
};

export const claimVoucherUsage = async (appliedVouchers = []) => {
  const rollbackQueue = [];
  const uniqueVoucherIds = Array.from(
    new Set(
      (Array.isArray(appliedVouchers) ? appliedVouchers : [])
        .map((voucher) => toIdKey(voucher.voucherId))
        .filter(Boolean)
    )
  );

  try {
    for (const voucherId of uniqueVoucherIds) {
      const result = await voucherModel.updateOne(
        {
          _id: voucherId,
          $or: [
            { usageLimit: { $lte: 0 } },
            { $expr: { $lt: ["$usedCount", "$usageLimit"] } },
          ],
        },
        { $inc: { usedCount: 1 } }
      );

      if (result.modifiedCount !== 1) {
        const exists = await voucherModel.exists({ _id: voucherId });
        if (!exists) {
          throw Object.assign(new Error("Voucher không tồn tại"), { status: 400 });
        }
        throw Object.assign(new Error(`Voucher "${voucherId}" đã hết lượt`), { status: 409, code: "VOUCHER_EXHAUSTED" });
      }

      rollbackQueue.push(voucherId);
    }
  } catch (error) {
    if (rollbackQueue.length > 0) {
      await Promise.all(
        rollbackQueue.map((voucherId) =>
          voucherModel.updateOne({ _id: voucherId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } })
        )
      ).catch(() => {});
    }
    throw error;
  }
};

export const releaseVoucherUsage = async (appliedVouchers = []) => {
  const uniqueVoucherIds = Array.from(
    new Set(
      (Array.isArray(appliedVouchers) ? appliedVouchers : [])
        .map((voucher) => toIdKey(voucher.voucherId))
        .filter(Boolean)
    )
  );

  if (uniqueVoucherIds.length === 0) return;

  await Promise.all(
    uniqueVoucherIds.map((voucherId) =>
      voucherModel.updateOne({ _id: voucherId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } })
    )
  );
};
