import {
  createVoucherService,
  deleteVoucherService,
  listVouchersService,
  toggleVoucherActiveService,
  updateVoucherService,
} from "../services/voucherManagementService.js";

const listVouchers = async (req, res) => {
  try {
    const vouchers = await listVouchersService({
      userId: req.body.userId,
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
      userId: req.body.userId,
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
      userId: req.body.userId,
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
      userId: req.body.userId,
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
      userId: req.body.userId,
      voucherId: req.body.voucherId,
    });
    res.json({ success: true, message: "Voucher deleted" });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export {
  listVouchers,
  createVoucher,
  updateVoucher,
  toggleVoucherActive,
  deleteVoucher,
};
