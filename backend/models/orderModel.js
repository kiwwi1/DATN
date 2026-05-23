import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    originalPrice: { type: Number },
    discount: { type: Number, default: 0 },
    quantity: { type: Number, required: true },
    image: { type: Array, default: [] },
    brand: { type: String, default: "" },
    selectedAttributes: [
      {
        name: { type: String },
        value: { type: String },
      },
    ],
    size: { type: String },
    variantKey: { type: String, default: "" },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    vendorShopName: { type: String },
  },
  { _id: false }
);

const vendorItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    originalPrice: { type: Number },
    discount: { type: Number, default: 0 },
    quantity: { type: Number, required: true },
    image: { type: Array, default: [] },
    brand: { type: String, default: "" },
    selectedAttributes: [
      {
        name: { type: String },
        value: { type: String },
      },
    ],
    size: { type: String },
    variantKey: { type: String, default: "" },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  items: [orderItemSchema],
  amount: { type: Number, required: true },
  address: { type: Object, required: true },
  status: { type: String, default: "Order Placed" },
  trackingNumber: { type: String, default: "" },
  trackingUpdatedAt: { type: Number },
  paymentMethod: { type: String, required: true },
  payment: { type: Boolean, default: false, required: true },
  date: { type: Number, required: true },

  // Idempotency / reservation fields
  idempotencyKey: { type: String },
  reservationExpiresAt: { type: Number },
  stockReservedAt: { type: Number },
  stockReleasedAt: { type: Number },

  // Gateway metadata
  stripeSessionId: { type: String },
  stripeSessionUrl: { type: String },
  vnpPaymentUrl: { type: String },
  vnp_TransactionNo: { type: String },
  vnpTxnRef: { type: String },

  // Cancellation info
  cancelReason: { type: String },
  cancelledBy: { type: String, enum: ["user", "vendor", "admin"] },
  cancelledAt: { type: Number },

  // Vendor tracking for multi-vendor orders
  vendors: [
    {
      vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
      vendorShopName: { type: String },
      items: [vendorItemSchema],
      subtotal: { type: Number, required: true },
      vendorStatus: {
        type: String,
        enum: ["pending", "confirmed", "preparing", "shipped", "delivered", "cancelled"],
        default: "pending",
      },
      commission: { type: Number, default: 10 },
    },
  ],
});

orderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  }
);

const orderModel = mongoose.model.order || mongoose.model("order", orderSchema);
export default orderModel;

