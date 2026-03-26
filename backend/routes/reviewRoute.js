import express from "express";
import { canReview, createReview, getMyReviewedProducts, getReviewsByProduct, updateReview, deleteReview } from "../controllers/reviewController.js";
import authUser from "../middleware/auth.js";
import upload from "../middleware/multer.js";

const reviewRouter = express.Router();

reviewRouter.post("/can-review/:productId", authUser, canReview);
reviewRouter.post("/my-reviewed-products", authUser, getMyReviewedProducts);
reviewRouter.post("/", upload.array("images", 5), authUser, createReview);
reviewRouter.get("/product/:productId", getReviewsByProduct);
reviewRouter.put("/:id", upload.array("images", 5), authUser, updateReview);
reviewRouter.delete("/:id", authUser, deleteReview);

export default reviewRouter;
