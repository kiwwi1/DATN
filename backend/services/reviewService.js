import mongoose from "mongoose";
import reviewModel from "../models/reviewModel.js";
import productModel from "../models/productModel.js";
import orderModel from "../models/orderModel.js";
import { uploadToR2 } from "../utils/r2Upload.js";

const updateProductRating = async (productId) => {
    const objectId = new mongoose.Types.ObjectId(productId);
    const stats = await reviewModel.aggregate([
        { $match: { product: objectId } },
        { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    const rating = stats[0] ? Math.round(stats[0].avg * 10) / 10 : 0;
    const reviewCount = stats[0] ? stats[0].count : 0;
    await productModel.findByIdAndUpdate(productId, { rating, reviewCount });
};

const canReviewProductInOrder = async (order, productId) => {
    if (!order || !Array.isArray(order.items)) return false;
    const matchedItem = order.items.find((item) => item._id?.toString() === productId?.toString());
    if (!matchedItem) return false;
    if (order.status === "Delivered") return true;

    const vendorId = matchedItem.vendorId?.toString();
    if (!vendorId || !Array.isArray(order.vendors)) return false;
    const vendorEntry = order.vendors.find((vendor) => vendor.vendorId?.toString() === vendorId);
    return String(vendorEntry?.vendorStatus || "") === "delivered";
};

export const canReviewService = async (userId, productId, orderId) => {
    if (!orderId) throw new Error("orderId is required");
    const order = await orderModel.findById(orderId);
    if (!order) return false;
    if (order.userId?.toString() !== userId?.toString()) return false;
    const canReview = await canReviewProductInOrder(order, productId);
    if (!canReview) return false;
    const existing = await reviewModel.findOne({ product: productId, user: userId, orderId });
    return !existing;
};

export const createReviewService = async (userId, { productId, orderId, rating, comment }, imageFiles = []) => {
    if (!productId || !orderId || !rating) throw new Error("productId, orderId and rating are required");

    const numRating = Number(rating);
    if (numRating < 1 || numRating > 5) throw new Error("rating must be between 1 and 5");

    const product = await productModel.findById(productId);
    if (!product) throw Object.assign(new Error("Product not found"), { status: 404 });

    const order = await orderModel.findById(orderId);
    const orderValid =
        order &&
        order.userId?.toString() === userId?.toString() &&
        await canReviewProductInOrder(order, productId);

    if (!orderValid) {
        throw Object.assign(new Error("You can only review this product after receiving it."), { status: 403 });
    }

    const existing = await reviewModel.findOne({ product: productId, user: userId, orderId });
    if (existing) throw Object.assign(new Error("You already reviewed this product for that order."), { status: 400 });

    if (imageFiles.length > 5) throw Object.assign(new Error("A review can contain up to 5 images"), { status: 400 });
    const imageUrls = await Promise.all(imageFiles.map((file) => uploadToR2(file, "reviews")));

    const review = await reviewModel.create({
        user: userId,
        product: productId,
        orderId,
        rating: numRating,
        comment: comment || "",
        images: imageUrls,
    });
    await updateProductRating(productId);

    return review.populate("user", "name");
};

export const getMyReviewedProductsService = async (userId) => {
    const reviews = await reviewModel.find({ user: userId }).select("product orderId");
    return reviews.map((r) => `${r.product}_${r.orderId}`);
};

export const getReviewsByProductService = async (productId, page = 1, limit = 5, star = 0) => {
    const skip = (page - 1) * limit;
    const query = { product: new mongoose.Types.ObjectId(productId) };
    if (star >= 1 && star <= 5) query.rating = star;

    const [reviews, total] = await Promise.all([
        reviewModel
            .find(query)
            .populate("user", "name")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        reviewModel.countDocuments(query),
    ]);
    return { reviews, total, page, totalPages: Math.ceil(total / limit) };
};

export const updateReviewService = async (reviewId, userId, { rating, comment, keepImages }, imageFiles = []) => {
    const review = await reviewModel.findById(reviewId);
    if (!review) throw Object.assign(new Error("Review not found"), { status: 404 });
    if (review.user.toString() !== userId) throw Object.assign(new Error("You can only edit your own review"), { status: 403 });

    if (rating !== undefined) {
        const numRating = Number(rating);
        if (numRating < 1 || numRating > 5) throw new Error("rating must be between 1 and 5");
        review.rating = numRating;
    }
    if (comment !== undefined) review.comment = comment;

    const keep = keepImages !== undefined
        ? (Array.isArray(keepImages) ? keepImages : [keepImages].filter(Boolean))
        : (review.images || []);
    const newUrls = imageFiles.length > 0 ? await Promise.all(imageFiles.map((file) => uploadToR2(file, "reviews"))) : [];
    review.images = [...keep, ...newUrls].slice(0, 5);

    await review.save();
    await updateProductRating(review.product);

    return review.populate("user", "name");
};

export const deleteReviewService = async (reviewId, userId) => {
    const review = await reviewModel.findById(reviewId);
    if (!review) throw Object.assign(new Error("Review not found"), { status: 404 });
    if (review.user.toString() !== userId) throw Object.assign(new Error("You can only delete your own review"), { status: 403 });
    const productId = review.product;
    await reviewModel.findByIdAndDelete(reviewId);
    await updateProductRating(productId);
};
