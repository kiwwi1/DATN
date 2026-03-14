import { addToCartService, updateCartService, getUserCartService } from "../services/cartService.js";

const adddToCart = async (req, res) => {
    try {
        const { userId, itemId, size } = req.body;
        await addToCartService(userId, itemId, size);
        res.json({ success: true, message: "Product added to cart" });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

const updateCart = async (req, res) => {
    try {
        const { userId, itemId, size, quantity } = req.body;
        await updateCartService(userId, itemId, size, quantity);
        res.json({ success: true, message: "Cart updated" });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

const getUserCart = async (req, res) => {
    try {
        const cartData = await getUserCartService(req.body.userId);
        res.json({ success: true, cartData });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

export { adddToCart, updateCart, getUserCart };
