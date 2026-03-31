import {
    followShopService,
    unfollowShopService,
    getFollowStatusService,
    getFollowerCountService,
} from "../services/shopFollowService.js";

const followShop = async (req, res) => {
    try {
        const { vendorId } = req.body;
        const userId = req.body.userId;
        const result = await followShopService(userId, vendorId);
        res.json({ success: true, message: "Theo dõi shop thành công", result });
    } catch (error) {
        console.log(error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const unfollowShop = async (req, res) => {
    try {
        const { vendorId } = req.body;
        const userId = req.body.userId;
        const result = await unfollowShopService(userId, vendorId);
        res.json({ success: true, message: "Bỏ theo dõi shop thành công", result });
    } catch (error) {
        console.log(error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const getFollowStatus = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const userId = req.body.userId;
        const result = await getFollowStatusService(userId, vendorId);
        res.json({ success: true, ...result });
    } catch (error) {
        console.log(error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const getFollowerCount = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const result = await getFollowerCountService(vendorId);
        res.json({ success: true, ...result });
    } catch (error) {
        console.log(error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

export { followShop, unfollowShop, getFollowStatus, getFollowerCount };