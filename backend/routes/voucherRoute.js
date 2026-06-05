import express from "express";
import authUser from "../middleware/auth.js";
import {
  createVoucher,
  deleteVoucher,
  listVouchers,
  toggleVoucherActive,
  updateVoucher,
  listPublicVouchers,
} from "../controllers/voucherController.js";

const voucherRouter = express.Router();

voucherRouter.get("/public", listPublicVouchers);
voucherRouter.post("/list", authUser, listVouchers);
voucherRouter.post("/create", authUser, createVoucher);
voucherRouter.post("/update", authUser, updateVoucher);
voucherRouter.post("/toggle-active", authUser, toggleVoucherActive);
voucherRouter.post("/delete", authUser, deleteVoucher);

export default voucherRouter;
