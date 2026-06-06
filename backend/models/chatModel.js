import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
    {
        buyerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true,
            index: true,
        },
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true,
            index: true,
        },
        lastMessage: { type: String, default: "" },
        unreadBuyer: { type: Number, default: 0 },
        unreadVendor: { type: Number, default: 0 },
    },
    { timestamps: true }
);

conversationSchema.index({ buyerId: 1, vendorId: 1 }, { unique: true });
conversationSchema.index({ updatedAt: -1 });

const messageSchema = new mongoose.Schema(
    {
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "conversation",
            required: true,
            index: true,
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true,
        },
        senderRole: {
            type: String,
            enum: ["buyer", "vendor"],
            required: true,
        },
        content: { type: String, required: true, trim: true },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "product",
            index: true,
        },
        read: { type: Boolean, default: false },
    },
    { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export const conversationModel =
    mongoose.models.conversation ||
    mongoose.model("conversation", conversationSchema);

export const messageModel =
    mongoose.models.message || mongoose.model("message", messageSchema);
