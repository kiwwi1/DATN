import mongoose from "mongoose";

const returnRequestSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "order", required: true },
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: "user",  required: true },

    reason: {
      type: String,
      enum: ["damaged", "wrong_item", "not_as_described", "changed_mind", "other"],
      required: true,
    },
    description: { type: String, default: "" },
    images: [{ type: String }],

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "received", "refunded"],
      default: "pending",
    },

    refundAmount: { type: Number, default: 0 },
    paymentMethod: { type: String, default: "" },
    stripeRefundId: { type: String, default: "" },
    isManualRefund: { type: Boolean, default: false },

    vendorNote: { type: String, default: "" },

    requestedAt: { type: Date, default: Date.now },
    reviewedAt:  { type: Date },
    receivedAt:  { type: Date },
    refundedAt:  { type: Date },
  },
  { timestamps: true }
);

returnRequestSchema.index({ orderId: 1 }, { unique: true });
returnRequestSchema.index({ userId: 1, createdAt: -1 });

const returnRequestModel =
  mongoose.models.returnRequest || mongoose.model("returnRequest", returnRequestSchema);

export default returnRequestModel;
