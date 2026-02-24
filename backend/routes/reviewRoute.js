import express from "express";
import { createReview, getReviewsByProduct, updateReview, deleteReview } from "../controllers/reviewController.js";
import authUser from "../middleware/auth.js";

const reviewRouter = express.Router();

reviewRouter.post("/", authUser, createReview);
reviewRouter.get("/product/:productId", getReviewsByProduct);
reviewRouter.put("/:id", authUser, updateReview);
reviewRouter.delete("/:id", authUser, deleteReview);

export default reviewRouter;
