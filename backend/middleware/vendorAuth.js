import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';

const vendorAuth = async (req, res, next) => {
    try {
        const { token } = req.headers;
        if (!token) {
            return res.json({ success: false, message: 'Unauthorized - No token provided' });
        }

        const token_decode = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(token_decode.id);

        if (!user) {
            return res.json({ success: false, message: 'Unauthorized - User not found' });
        }

        if (user.role !== 'vendor') {
            return res.json({ success: false, message: 'Unauthorized - Not a vendor' });
        }

        // Add user info to request object for use in controllers
        req.user = user;
        req.vendorId = user._id;
        req.vendorShopName = user.shopName;

        next();
    } catch (error) {
        console.log(error);
        return res.json({ success: false, message: 'Unauthorized - Invalid token' });
    }
};

export default vendorAuth;
