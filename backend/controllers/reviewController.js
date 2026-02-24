import reviewModel from "../models/reviewModel.js";
import productModel from "../models/productModel.js";

/**
 * Cập nhật rating và reviewCount của product từ tập review hiện tại.
 */
async function updateProductRating(productId) {
    const stats = await reviewModel.aggregate([
        { $match: { product: productId } },
        { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    const rating = stats[0] ? Math.round(stats[0].avg * 10) / 10 : 0;
    const reviewCount = stats[0] ? stats[0].count : 0;
    await productModel.findByIdAndUpdate(productId, { rating, reviewCount });
}

// Tạo review (user đã đăng nhập, 1 user 1 review/product)
const createReview = async (req, res) => {
    try {
        const userId = req.body.userId; // set bởi authUser
        const { productId, rating, comment } = req.body;

        if (!productId || !rating) {
            return res.status(400).json({ success: false, message: "productId và rating là bắt buộc" });
        }
        const numRating = Number(rating);
        if (numRating < 1 || numRating > 5) {
            return res.status(400).json({ success: false, message: "rating phải từ 1 đến 5" });
        }

        const product = await productModel.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Sản phẩm không tồn tại" });
        }

        const existing = await reviewModel.findOne({ product: productId, user: userId });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Bạn đã đánh giá sản phẩm này. Có thể chỉnh sửa đánh giá hiện tại.",
            });
        }

        const review = new reviewModel({
            user: userId,
            product: productId,
            rating: numRating,
            comment: comment || "",
        });
        await review.save();
        await updateProductRating(productId);

        const populated = await review.populate("user", "name");
        return res.status(201).json({ success: true, message: "Đánh giá đã gửi", review: populated });
    } catch (error) {
        console.error("createReview:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Lấy danh sách review theo product (public)
const getReviewsByProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const reviews = await reviewModel
            .find({ product: productId })
            .populate("user", "name")
            .sort({ createdAt: -1 });
        return res.json({ success: true, reviews });
    } catch (error) {
        console.error("getReviewsByProduct:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Chỉnh sửa review (chỉ author)
const updateReview = async (req, res) => {
    try {
        const userId = req.body.userId;
        const { id } = req.params;
        const { rating, comment } = req.body;

        const review = await reviewModel.findById(id);
        if (!review) {
            return res.status(404).json({ success: false, message: "Đánh giá không tồn tại" });
        }
        if (review.user.toString() !== userId) {
            return res.status(403).json({ success: false, message: "Chỉ có thể sửa đánh giá của bạn" });
        }

        if (rating !== undefined) {
            const numRating = Number(rating);
            if (numRating < 1 || numRating > 5) {
                return res.status(400).json({ success: false, message: "rating phải từ 1 đến 5" });
            }
            review.rating = numRating;
        }
        if (comment !== undefined) review.comment = comment;
        await review.save();
        await updateProductRating(review.product);

        const populated = await review.populate("user", "name");
        return res.json({ success: true, message: "Đã cập nhật đánh giá", review: populated });
    } catch (error) {
        console.error("updateReview:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Xóa review (chỉ author)
const deleteReview = async (req, res) => {
    try {
        const userId = req.body.userId;
        const { id } = req.params;

        const review = await reviewModel.findById(id);
        if (!review) {
            return res.status(404).json({ success: false, message: "Đánh giá không tồn tại" });
        }
        if (review.user.toString() !== userId) {
            return res.status(403).json({ success: false, message: "Chỉ có thể xóa đánh giá của bạn" });
        }

        const productId = review.product;
        await reviewModel.findByIdAndDelete(id);
        await updateProductRating(productId);
        return res.json({ success: true, message: "Đã xóa đánh giá" });
    } catch (error) {
        console.error("deleteReview:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export { createReview, getReviewsByProduct, updateReview, deleteReview };
