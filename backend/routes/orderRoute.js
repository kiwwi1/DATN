import express from 'express';
import { createOrder, getUserOrders, getOrderDetails, cancelOrder } from '../controllers/orderController.js';

const orderRouter = express.Router();


export default orderRouter; 