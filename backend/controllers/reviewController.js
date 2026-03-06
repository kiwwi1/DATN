import mongoose from "mongoose";
import reviewModel from "../models/reviewModel.js";
import productModel from "../models/productModel.js";
import orderModel from "../models/orderModel.js";
import { uploadToR2 } from "../utils/r2Upload.js";

/**
 * Cập nhật rating và reviewCount của product từ tập review hiện tại.
 * Phải cast productId → ObjectId vì aggregation pipeline không tự cast.
 */
async function updateProductRating(productId) {
    const objectId = new mongoose.Types.ObjectId(productId);
    const stats = await reviewModel.aggregate([
        { $match: { product: objectId } },
        { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    const rating = stats[0] ? Math.round(stats[0].avg * 10) / 10 : 0;
    const reviewCount = stats[0] ? stats[0].count : 0;
    await productModel.findByIdAndUpdate(productId, { rating, reviewCount });
}

// Kiểm tra user có thể đánh giá sản phẩm theo đơn hàng cụ thể không
const canReview = async (req, res) => {
    try {
        const userId = req.body.userId;
        const { productId } = req.params;
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "orderId là bắt buộc" });
        }

        const order = await orderModel.findById(orderId);
        if (!order) return res.json({ success: true, canReview: false });

        // Kiểm tra đơn thuộc user này
        if (order.userId?.toString() !== userId?.toString()) {
            return res.json({ success: true, canReview: false });
        }

        // Kiểm tra trạng thái đã Delivered
        if (order.status !== "Delivered") {
            return res.json({ success: true, canReview: false });
        }

        // Kiểm tra đơn có chứa sản phẩm (so sánh string để tránh type mismatch)
        const hasProduct = order.items.some(
            (item) => item._id?.toString() === productId?.toString()
        );
        if (!hasProduct) return res.json({ success: true, canReview: false });

        // Kiểm tra đơn này đã được review chưa
        const existing = await reviewModel.findOne({
            product: productId,
            user: userId,
            orderId,
        });

        return res.json({ success: true, canReview: !existing });
    } catch (error) {
        console.error("canReview:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Tạo review (1 review per user per product per order)
const createReview = async (req, res) => {
    try {
        const userId = req.body.userId;
        const { productId, orderId, rating, comment } = req.body;

        if (!productId || !orderId || !rating) {
            return res.status(400).json({ success: false, message: "productId, orderId và rating là bắt buộc" });
        }
        const numRating = Number(rating);
        if (numRating < 1 || numRating > 5) {
            return res.status(400).json({ success: false, message: "rating phải từ 1 đến 5" });
        }

        const product = await productModel.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Sản phẩm không tồn tại" });
        }

        // Kiểm tra đơn hàng hợp lệ: thuộc user, đã Delivered, chứa sản phẩm
        const order = await orderModel.findById(orderId);

        console.log("--- [createReview] DEBUG ---");
        console.log("productId (request)  :", productId);
        console.log("orderId   (request)  :", orderId);
        console.log("userId    (request)  :", userId);
        console.log("order found          :", !!order);
        if (order) {
            console.log("order.userId         :", order.userId, "| match:", order.userId?.toString() === userId?.toString());
            console.log("order.status         :", order.status, "| is Delivered:", order.status === "Delivered");
            console.log("order.items _id list :", order.items.map(i => i._id?.toString()));
            console.log("product in items     :", order.items.some(i => i._id?.toString() === productId?.toString()));
        }
        console.log("----------------------------");

        const orderValid =
            order &&
            order.userId?.toString() === userId?.toString() &&
            order.status === "Delivered" &&
            order.items.some((item) => item._id?.toString() === productId?.toString());

        if (!orderValid) {
            return res.status(403).json({
                success: false,
                message: "Bạn chỉ có thể đánh giá sản phẩm sau khi đã nhận hàng.",
            });
        }

        // Kiểm tra đã review đơn này chưa
        const existing = await reviewModel.findOne({ product: productId, user: userId, orderId });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Bạn đã đánh giá sản phẩm này cho đơn hàng đó rồi.",
            });
        }

        // Upload ảnh đính kèm (nếu có)
        const imageFiles = req.files || [];
        if (imageFiles.length > 5) {
            return res.status(400).json({ success: false, message: "Tối đa 5 ảnh mỗi đánh giá" });
        }
        const imageUrls = await Promise.all(
            imageFiles.map((file) => uploadToR2(file, "reviews"))
        );

        const review = new reviewModel({
            user: userId,
            product: productId,
            orderId,
            rating: numRating,
            comment: comment || "",
            images: imageUrls,
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

// Lấy danh sách { productId, orderId } mà user đã review (dùng cho trang Orders)
const getMyReviewedProducts = async (req, res) => {
    try {
        const userId = req.body.userId;
        const reviews = await reviewModel.find({ user: userId }).select("product orderId");
        // Trả về key dạng "productId_orderId" để frontend dễ kiểm tra
        const keys = reviews.map((r) => `${r.product}_${r.orderId}`);
        return res.json({ success: true, keys });
    } catch (error) {
        console.error("getMyReviewedProducts:", error);
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

        // Cập nhật ảnh: keepImages là mảng URL ảnh cũ muốn giữ lại
        const keep = req.body.keepImages !== undefined
            ? (Array.isArray(req.body.keepImages) ? req.body.keepImages : [req.body.keepImages].filter(Boolean))
            : (review.images || []);
        const imageFiles = req.files || [];
        const newUrls = imageFiles.length > 0
            ? await Promise.all(imageFiles.map((file) => uploadToR2(file, "reviews")))
            : [];
        review.images = [...keep, ...newUrls].slice(0, 5);

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

export { canReview, createReview, getMyReviewedProducts, getReviewsByProduct, updateReview, deleteReview };
