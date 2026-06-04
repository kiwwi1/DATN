import express from "express";
import { followShop, unfollowShop, getFollowStatus, getFollowerCount } from "../controllers/shopFollowController.js";
import authUser from "../middleware/auth.js";

const shopFollowRouter = express.Router();

shopFollowRouter.post("/follow", authUser, followShop);
shopFollowRouter.post("/unfollow", authUser, unfollowShop);
shopFollowRouter.get("/status/:vendorId", authUser, getFollowStatus);
shopFollowRouter.get("/count/:vendorId", getFollowerCount);
export default shopFollowRouter;