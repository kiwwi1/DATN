import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
        product: { type: mongoose.Schema.Types.ObjectId, ref: "product", required: true },
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: "order", required: true },
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String, default: "", trim: true },
        images: { type: [String], default: [] },
    },
    { timestamps: true }
);

// Mỗi user chỉ được 1 review cho 1 sản phẩm trong 1 đơn hàng
reviewSchema.index({ product: 1, user: 1, orderId: 1 }, { unique: true });
reviewSchema.index({ product: 1 });

const reviewModel = mongoose.models.review || mongoose.model("review", reviewSchema);
export default reviewModel;
