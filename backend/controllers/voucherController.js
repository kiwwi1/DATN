import {
  createVoucherService,
  deleteVoucherService,
  listVouchersService,
  toggleVoucherActiveService,
  updateVoucherService,
} from "../services/voucherManagementService.js";

const listPublicVouchers = async (req, res) => {
  try {
    const now = Date.now();
    const vouchers = await (await import("../models/voucherModel.js")).default.find({
      type: { $in: ["PLATFORM", "SHIPPING"] },
      isActive: true,
      startAt: { $lte: now },
      endAt: { $gte: now },
      $or: [{ usageLimit: 0 }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }],
    })
      .select("code type discountType discountValue maxDiscount minOrderValue endAt description usageLimit usedCount")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, vouchers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const listVouchers = async (req, res) => {
  try {
    const vouchers = await listVouchersService({
      userId: req.userId,
      filters: req.body || {},
    });
    res.json({ success: true, vouchers });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

const createVoucher = async (req, res) => {
  try {
    const voucher = await createVoucherService({
      userId: req.userId,
      payload: req.body,
    });
    res.status(201).json({ success: true, voucher });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

const updateVoucher = async (req, res) => {
  try {
    const voucher = await updateVoucherService({
      userId: req.userId,
      voucherId: req.body.voucherId,
      payload: req.body,
    });
    res.json({ success: true, voucher });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

const toggleVoucherActive = async (req, res) => {
  try {
    const voucher = await toggleVoucherActiveService({
      userId: req.userId,
      voucherId: req.body.voucherId,
      isActive: req.body.isActive,
    });
    res.json({ success: true, voucher });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

const deleteVoucher = async (req, res) => {
  try {
    await deleteVoucherService({
      userId: req.userId,
      voucherId: req.body.voucherId,
    });
    res.json({ success: true, message: "Voucher deleted" });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export {
  listVouchers,
  listPublicVouchers,
  createVoucher,
  updateVoucher,
  toggleVoucherActive,
  deleteVoucher,
};
