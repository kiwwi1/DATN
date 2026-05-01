import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    type: {
        type: String,
        enum: ["order_placed", "order_status", "order_cancelled", "price_drop"],
        required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "order", default: null },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "product", default: null },

    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

notificationSchema.index({ userId: 1, createdAt: -1 });

const notificationModel =
    mongoose.model.notification || mongoose.model("notification", notificationSchema);

export default notificationModel;
