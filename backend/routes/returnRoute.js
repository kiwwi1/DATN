import express from "express";
import authUser from "../middleware/auth.js";
import {
  createReturnRequest,
  getReturnRequestByOrder,
  getUserReturnRequests,
  getVendorReturnRequests,
  reviewReturnRequest,
  confirmReturnReceived,
} from "../controllers/returnController.js";

const returnRouter = express.Router();

// Buyer
returnRouter.post("/request",              authUser, createReturnRequest);
returnRouter.get("/order/:orderId",        authUser, getReturnRequestByOrder);
returnRouter.get("/my",                    authUser, getUserReturnRequests);

// Vendor
returnRouter.get("/vendor",                authUser, getVendorReturnRequests);
returnRouter.post("/:id/review",           authUser, reviewReturnRequest);
returnRouter.post("/:id/confirm-received", authUser, confirmReturnReceived);

export default returnRouter;
