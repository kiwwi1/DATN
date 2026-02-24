import express from 'express';
import { placeOrder, allOrders, userOrders, updateOrderStatus, placeOrderStripe, verifyStripePayment, vendorOrders, updateVendorOrderStatus } from '../controllers/orderController.js';
import adminAuth from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';
import vendorAuth from '../middleware/vendorAuth.js';

const orderRouter = express.Router();

//Admin Features
orderRouter.post('/list',adminAuth, allOrders);
orderRouter.post('/status',adminAuth, updateOrderStatus);

//Vendor Features
orderRouter.post('/vendor-list', vendorAuth, vendorOrders);
orderRouter.post('/vendor-status', vendorAuth, updateVendorOrderStatus);

//Payment Features
orderRouter.post('/place-order',authUser, placeOrder);
orderRouter.post('/place-order-stripe',authUser, placeOrderStripe);

// User Features
orderRouter.post('/user-orders',authUser, userOrders);
//Verify Payment
orderRouter.post('/verify-stripe',authUser, verifyStripePayment);



export default orderRouter; 