import mongoose from "mongoose";

const voucherSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["SHOP", "PLATFORM", "SHIPPING"],
      required: true,
    },
    discountType: {
      type: String,
      enum: ["PERCENT", "FIXED"],
      required: true,
    },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscount: { type: Number, default: 0 },
    minOrderValue: { type: Number, default: 0 },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    startAt: { type: Number, required: true },
    endAt: { type: Number, required: true },
    usageLimit: { type: Number, default: 0 },
    usedCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

voucherSchema.index({ type: 1, isActive: 1 });
voucherSchema.index({ vendorId: 1 });

const voucherModel = mongoose.models.voucher || mongoose.model("voucher", voucherSchema);
export default voucherModel;
