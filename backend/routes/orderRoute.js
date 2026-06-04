import express from 'express';
import {
    placeOrder,
    userOrders,
    placeOrderStripe,
    verifyStripePayment,
    placeOrderVNPay,
    previewOrder,
    listCheckoutVoucherSuggestions,
    verifyVNPayReturn,
    vendorOrders,
    updateVendorOrderStatus,
    cancelOrder,
    vendorStats,
} from '../controllers/orderController.js';
import authUser from '../middleware/auth.js';
import vendorAuth from '../middleware/vendorAuth.js';
import { vendorListRateLimit, vendorStatsRateLimit } from '../middleware/authRateLimit.js';

const orderRouter = express.Router();

//Vendor Features
orderRouter.post('/vendor-list', vendorAuth, ...vendorListRateLimit, vendorOrders);
orderRouter.post('/vendor-status', vendorAuth, updateVendorOrderStatus);
orderRouter.get('/vendor-stats', vendorAuth, ...vendorStatsRateLimit, vendorStats);

//Payment Features
orderRouter.post('/place-order',authUser, placeOrder);
orderRouter.post('/place-order-stripe',authUser, placeOrderStripe);
orderRouter.post('/preview', authUser, previewOrder);
orderRouter.post('/voucher-suggestions', authUser, listCheckoutVoucherSuggestions);

// User Features
orderRouter.post('/user-orders',authUser, userOrders);
orderRouter.post('/cancel',authUser, cancelOrder);
//Verify Payment
orderRouter.post('/verify-stripe',authUser, verifyStripePayment);

// VNPay
orderRouter.post('/place-order-vnpay', authUser, placeOrderVNPay);
orderRouter.get('/vnpay-return', verifyVNPayReturn);



export default orderRouter; 
