import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
        receiverName: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        city: { type: String, required: true, trim: true },
        ward: { type: String, required: true, trim: true },
        addressLine: { type: String, required: true, trim: true },
        addressType: { type: String, enum: ["home", "office"], default: "home" },
        isDefault: { type: Boolean, default: false, index: true },
        lastUsedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

addressSchema.index({ userId: 1, isDefault: 1 });

const addressModel = mongoose.models.address || mongoose.model("address", addressSchema);

export default addressModel;
