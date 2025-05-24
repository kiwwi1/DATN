import orderModel from '../models/orderModel.js';
import userModel from '../models/userModel.js';
import productModel from '../models/productModel.js';

// Tạo đơn hàng mới
export const createOrder = async (req, res) => {
    try {
        const { items, shippingAddress, paymentMethod } = req.body;
        const userId = req.user._id; // Lấy từ middleware auth

        // Kiểm tra tồn tại sản phẩm và số lượng
        for (let item of items) {
            const product = await productModel.findById(item.product);
            if (!product) {
                return res.status(404).json({ message: `Sản phẩm ${item.product} không tồn tại` });
            }
            // Kiểm tra số lượng tồn kho
            if (product.quantity < item.quantity) {
                return res.status(400).json({ message: `Sản phẩm ${product.name} chỉ còn ${product.quantity} sản phẩm` });
            }
        }

        // Tính tổng tiền
        let totalAmount = 0;
        for (let item of items) {
            const product = await productModel.findById(item.product);
            totalAmount += product.price * item.quantity;
        }

        // Tạo đơn hàng mới
        const newOrder = new orderModel({
            user: userId,
            items,
            totalAmount,
            shippingAddress,
            paymentMethod
        });

        // Lưu đơn hàng
        await newOrder.save();

        // Cập nhật số lượng sản phẩm
        for (let item of items) {
            await productModel.findByIdAndUpdate(item.product, {
                $inc: { quantity: -item.quantity }
            });
        }

        // Xóa giỏ hàng của user
        await userModel.findByIdAndUpdate(userId, {
            $set: { cartData: {} }
        });

        res.status(201).json({
            success: true,
            message: "Đặt hàng thành công",
            order: newOrder
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi tạo đơn hàng",
            error: error.message
        });
    }
};

// Lấy danh sách đơn hàng của user
export const getUserOrders = async (req, res) => {
    try {
        const userId = req.user._id;
        const orders = await orderModel.find({ user: userId })
            .populate('items.product')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            orders
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách đơn hàng",
            error: error.message
        });
    }
};

// Lấy chi tiết đơn hàng
export const getOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await orderModel.findById(orderId)
            .populate('items.product')
            .populate('user', 'name email');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đơn hàng"
            });
        }

        // Kiểm tra quyền xem đơn hàng
        if (order.user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền xem đơn hàng này"
            });
        }

        res.status(200).json({
            success: true,
            order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy chi tiết đơn hàng",
            error: error.message
        });
    }
};

// Hủy đơn hàng
export const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await orderModel.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đơn hàng"
            });
        }

        // Kiểm tra quyền hủy đơn hàng
        if (order.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền hủy đơn hàng này"
            });
        }

        // Chỉ cho phép hủy đơn hàng ở trạng thái pending
        if (order.orderStatus !== 'pending') {
            return res.status(400).json({
                success: false,
                message: "Không thể hủy đơn hàng ở trạng thái này"
            });
        }

        // Cập nhật trạng thái đơn hàng
        order.orderStatus = 'cancelled';
        await order.save();

        // Hoàn trả số lượng sản phẩm
        for (let item of order.items) {
            await productModel.findByIdAndUpdate(item.product, {
                $inc: { quantity: item.quantity }
            });
        }

        res.status(200).json({
            success: true,
            message: "Hủy đơn hàng thành công"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi hủy đơn hàng",
            error: error.message
        });
    }
}; 