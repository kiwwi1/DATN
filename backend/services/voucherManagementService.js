import mongoose from "mongoose";
import voucherModel from "../models/voucherModel.js";
import userModel from "../models/userModel.js";

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const normalizeVoucherPayload = (payload = {}) => {
  const code = String(payload.code || "").trim().toUpperCase();
  return {
    code,
    type: String(payload.type || "").trim().toUpperCase(),
    discountType: String(payload.discountType || "").trim().toUpperCase(),
    discountValue: Math.max(0, Math.round(parseNumber(payload.discountValue, 0))),
    maxDiscount: Math.max(0, Math.round(parseNumber(payload.maxDiscount, 0))),
    minOrderValue: Math.max(0, Math.round(parseNumber(payload.minOrderValue, 0))),
    vendorId: payload.vendorId || null,
    startAt: Math.round(parseNumber(payload.startAt, 0)),
    endAt: Math.round(parseNumber(payload.endAt, 0)),
    usageLimit: Math.max(0, Math.round(parseNumber(payload.usageLimit, 0))),
    perUserLimit: Math.max(0, Math.round(parseNumber(payload.perUserLimit, 0))),
    isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
    description: String(payload.description || "").trim(),
  };
};

const assertVoucherPayload = (payload) => {
  if (!payload.code) throw Object.assign(new Error("Voucher code is required"), { status: 400 });
  if (!["SHOP", "PLATFORM", "SHIPPING"].includes(payload.type)) {
    throw Object.assign(new Error("Invalid voucher type"), { status: 400 });
  }
  if (!["PERCENT", "FIXED"].includes(payload.discountType)) {
    throw Object.assign(new Error("Invalid discount type"), { status: 400 });
  }
  if (payload.discountType === "PERCENT" && payload.discountValue > 100) {
    throw Object.assign(new Error("Percent discount cannot exceed 100"), { status: 400 });
  }
  if (!payload.startAt || !payload.endAt || payload.endAt <= payload.startAt) {
    throw Object.assign(new Error("Invalid voucher start/end time"), { status: 400 });
  }
  if (payload.type === "SHOP" && !payload.vendorId) {
    throw Object.assign(new Error("SHOP voucher must have vendorId"), { status: 400 });
  }
};

const loadRequester = async (userId) => {
  const requester = await userModel.findById(userId).select("_id role");
  if (!requester) throw Object.assign(new Error("User not found"), { status: 404 });
  return requester;
};

const buildScopedQuery = (requester) => {
  if (requester.role === "admin") return {};
  if (requester.role === "vendor") return { type: "SHOP", vendorId: requester._id };
  throw Object.assign(new Error("Forbidden"), { status: 403 });
};

export const listVouchersService = async ({ userId, filters = {} }) => {
  const requester = await loadRequester(userId);
  const query = { ...buildScopedQuery(requester) };
  if (filters.type) query.type = String(filters.type).trim().toUpperCase();
  if (filters.code) query.code = String(filters.code).trim().toUpperCase();
  return voucherModel.find(query).sort({ createdAt: -1 });
};

export const createVoucherService = async ({ userId, payload }) => {
  const requester = await loadRequester(userId);
  const data = normalizeVoucherPayload(payload);
  assertVoucherPayload(data);

  if (requester.role === "vendor") {
    if (data.type !== "SHOP") {
      throw Object.assign(new Error("Vendor can only create SHOP vouchers"), { status: 403 });
    }
    data.vendorId = requester._id;
  } else if (requester.role === "admin") {
    if (data.type !== "SHOP") data.vendorId = undefined;
    if (data.type === "SHOP" && !data.vendorId) {
      throw Object.assign(new Error("SHOP voucher requires vendorId"), { status: 400 });
    }
  } else {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  try {
    return await voucherModel.create(data);
  } catch (error) {
    if (error?.code === 11000) {
      throw Object.assign(new Error("Voucher code already exists"), { status: 409 });
    }
    throw error;
  }
};

export const updateVoucherService = async ({ userId, voucherId, payload }) => {
  const requester = await loadRequester(userId);
  if (!voucherId || !mongoose.Types.ObjectId.isValid(voucherId)) {
    throw Object.assign(new Error("Invalid voucher id"), { status: 400 });
  }

  const voucher = await voucherModel.findById(voucherId);
  if (!voucher) throw Object.assign(new Error("Voucher not found"), { status: 404 });

  if (requester.role === "vendor") {
    if (voucher.type !== "SHOP" || String(voucher.vendorId) !== String(requester._id)) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
  } else if (requester.role !== "admin") {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  const incoming = normalizeVoucherPayload({
    ...voucher.toObject(),
    ...payload,
    code: voucher.code,
  });
  if (requester.role === "vendor") {
    incoming.type = "SHOP";
    incoming.vendorId = requester._id;
  }
  assertVoucherPayload(incoming);

  Object.assign(voucher, incoming);
  await voucher.save();
  return voucher;
};

export const toggleVoucherActiveService = async ({ userId, voucherId, isActive }) => {
  const requester = await loadRequester(userId);
  if (!voucherId || !mongoose.Types.ObjectId.isValid(voucherId)) {
    throw Object.assign(new Error("Invalid voucher id"), { status: 400 });
  }

  const voucher = await voucherModel.findById(voucherId);
  if (!voucher) throw Object.assign(new Error("Voucher not found"), { status: 404 });

  if (requester.role === "vendor") {
    if (voucher.type !== "SHOP" || String(voucher.vendorId) !== String(requester._id)) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
  } else if (requester.role !== "admin") {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  voucher.isActive = Boolean(isActive);
  await voucher.save();
  return voucher;
};

export const deleteVoucherService = async ({ userId, voucherId }) => {
  const requester = await loadRequester(userId);
  if (!voucherId || !mongoose.Types.ObjectId.isValid(voucherId)) {
    throw Object.assign(new Error("Invalid voucher id"), { status: 400 });
  }
  const voucher = await voucherModel.findById(voucherId);
  if (!voucher) throw Object.assign(new Error("Voucher not found"), { status: 404 });

  if (requester.role === "vendor") {
    if (voucher.type !== "SHOP" || String(voucher.vendorId) !== String(requester._id)) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
  } else if (requester.role !== "admin") {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  await voucherModel.deleteOne({ _id: voucherId });
};
