import { addToCartService, updateCartService, getUserCartService } from "../services/cartService.js";

const adddToCart = async (req, res) => {
    try {
        const { itemId, size } = req.body;
        const userId = req.userId;
        await addToCartService(userId, itemId, size);
        res.json({ success: true, message: "Product added to cart" });
    } catch (error) {
        console.log(error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const updateCart = async (req, res) => {
    try {
        const { itemId, size, quantity } = req.body;
        const userId = req.userId;
        await updateCartService(userId, itemId, size, quantity);
        res.json({ success: true, message: "Cart updated" });
    } catch (error) {
        console.log(error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const getUserCart = async (req, res) => {
    try {
        const cartData = await getUserCartService(req.userId);
        res.json({ success: true, cartData });
    } catch (error) {
        console.log(error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

export { adddToCart, updateCart, getUserCart };
