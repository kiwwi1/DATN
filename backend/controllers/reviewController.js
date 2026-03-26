import {
    canReviewService,
    createReviewService,
    getMyReviewedProductsService,
    getReviewsByProductService,
    updateReviewService,
    deleteReviewService,
} from "../services/reviewService.js";

const canReview = async (req, res) => {
    try {
        const userId = req.body.userId;
        const { productId } = req.params;
        const { orderId } = req.body;
        const result = await canReviewService(userId, productId, orderId);
        res.json({ success: true, canReview: result });
    } catch (error) {
        console.error("canReview:", error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const createReview = async (req, res) => {
    try {
        const userId = req.body.userId;
        const review = await createReviewService(userId, req.body, req.files || []);
        res.status(201).json({ success: true, message: "Đánh giá đã gửi", review });
    } catch (error) {
        console.error("createReview:", error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const getMyReviewedProducts = async (req, res) => {
    try {
        const keys = await getMyReviewedProductsService(req.body.userId);
        res.json({ success: true, keys });
    } catch (error) {
        console.error("getMyReviewedProducts:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getReviewsByProduct = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 5));
        const star = parseInt(req.query.star) || 0;
        const result = await getReviewsByProductService(req.params.productId, page, limit, star);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("getReviewsByProduct:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateReview = async (req, res) => {
    try {
        const review = await updateReviewService(req.params.id, req.body.userId, req.body, req.files || []);
        res.json({ success: true, message: "Đã cập nhật đánh giá", review });
    } catch (error) {
        console.error("updateReview:", error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const deleteReview = async (req, res) => {
    try {
        await deleteReviewService(req.params.id, req.body.userId);
        res.json({ success: true, message: "Đã xóa đánh giá" });
    } catch (error) {
        console.error("deleteReview:", error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

export { canReview, createReview, getMyReviewedProducts, getReviewsByProduct, updateReview, deleteReview };
