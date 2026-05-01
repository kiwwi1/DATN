import mongoose from "mongoose";

const productPriceAlertSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "product", required: true, index: true },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productPriceAlertSchema.index({ userId: 1, productId: 1 }, { unique: true });

const productPriceAlertModel =
  mongoose.models.productPriceAlert ||
  mongoose.model("productPriceAlert", productPriceAlertSchema);

export default productPriceAlertModel;
