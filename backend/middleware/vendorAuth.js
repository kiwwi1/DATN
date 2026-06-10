import userModel from '../models/userModel.js';
import { verifyAccessToken } from "../services/authSessionService.js";

const vendorAuth = async (req, res, next) => {
    try {
        const token = req.headers?.token || req.cookies?.accessToken;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized - No token provided' });
        }

        const token_decode = await verifyAccessToken(token);
        const user = await userModel.findById(token_decode.id);

        if (!user) {
            return res.status(401).json({ success: false, message: 'Unauthorized - User not found' });
        }

        if (user.role !== 'vendor') {
            return res.status(403).json({ success: false, message: 'Unauthorized - Not a vendor' });
        }

        // Add user info to request object for use in controllers
        req.user = user;
        req.vendorId = user._id;
        req.vendorShopName = user.shopName;

        next();
    } catch (error) {
        console.error("[vendor-auth]", error.message);
        return res.status(401).json({ success: false, message: 'Unauthorized - Invalid token' });
    }
};

export default vendorAuth;
