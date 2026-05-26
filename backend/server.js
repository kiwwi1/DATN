import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import connectDB from './config/mongodb.js';
import { initRedis } from './config/redis.js';
import userRouter from './routes/userRoute.js';
import productRouter from './routes/productRoute.js';
import orderRouter from './routes/orderRoute.js';
import cartRouter from './routes/cartRoute.js';
import categoryRouter from './routes/categoryRoute.js';
import reviewRouter from './routes/reviewRoute.js';
import notificationRouter from './routes/notificationRoute.js';
import interactionRouter from './routes/interactionRoute.js';
import reviewModel from './models/reviewModel.js';
import shopFollowRouter from './routes/shopFollowRoute.js';
import chatRouter from './routes/chatRoute.js';
import addressRouter from './routes/addressRoute.js';
import locationRouter from './routes/locationRoute.js';
import voucherRouter from './routes/voucherRoute.js';
import { getImageProxy } from './controllers/imageProxyController.js';
import { expirePendingReservationsService } from './services/orderService.js';
import { stripeWebhook } from './controllers/orderController.js';
import { conversationModel } from './models/chatModel.js';


const parseAllowedOrigins = () => {
    const localDefaults = ['http://localhost:5173', 'http://localhost:5174'];
    const fromEnv = String(process.env.CORS_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    return Array.from(new Set(fromEnv.length > 0 ? fromEnv : localDefaults));
};

const allowedOrigins = parseAllowedOrigins();
const allowCorsOrigin = (origin, callback) => {
    if (!origin) {
        callback(null, true);
        return;
    }
    callback(null, allowedOrigins.includes(origin));
};
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET is required and must be at least 32 chars in production');
    }
}

// App config
const app = express();
const port = process.env.PORT || 4000;
const httpServer = http.createServer(app);
app.set('trust proxy', 1);
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
    },
});
app.set('io', io);

// Kết nối DB rồi đồng bộ index (xóa index cũ, tạo index mới)
connectDB().then(async () => {
    try {
        await reviewModel.syncIndexes();
        console.log('✅ Review indexes synced');
    } catch (e) {
        console.warn('⚠️ syncIndexes warning:', e.message);
    }
});

initRedis();

// Stripe webhook must use raw body and be mounted before express.json()
app.post('/api/order/stripe-webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// Middlewares
app.use(cors({
    origin: allowCorsOrigin,
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Ảnh từ CDN bên ngoài (Pexels, DummyJSON, …) — tránh chặn hotlink
app.get('/api/image-proxy', getImageProxy);

//api endpoints
app.use('/api/user', userRouter);
app.use('/api/product', productRouter);
app.use('/api/cart', cartRouter);
app.use('/api/order', orderRouter);
app.use('/api/category', categoryRouter);
app.use('/api/review', reviewRouter);
app.use('/api/notification', notificationRouter);
app.use('/api/interaction', interactionRouter);
app.use('/api/shop-follow', shopFollowRouter);
app.use('/api/chat', chatRouter);
app.use('/api/address', addressRouter);
app.use('/api/location', locationRouter);
app.use('/api/voucher', voucherRouter);

io.use((socket, next) => {
    try {
        const authToken = socket.handshake.auth?.token;
        const token = authToken || '';
        if (!token) {
            return next(new Error('Unauthorized'));
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded?.id || (decoded?.type && decoded.type !== 'access')) {
            return next(new Error('Unauthorized'));
        }
        socket.data.userId = String(decoded.id);
        return next();
    } catch {
        return next(new Error('Unauthorized'));
    }
});

io.on('connection', (socket) => {
    socket.on('join_room', async (conversationId) => {
        const cid = String(conversationId || '').trim();
        if (!cid) return;
        const userId = String(socket.data.userId || '');
        if (!userId) return;

        const conversation = await conversationModel
            .findById(cid)
            .select('buyerId vendorId')
            .lean()
            .catch(() => null);
        if (!conversation) return;
        const isMember =
            String(conversation.buyerId) === userId ||
            String(conversation.vendorId) === userId;
        if (!isMember) return;
        socket.join(cid);
    });
});

httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

const RESERVATION_SWEEP_INTERVAL_MS = Number(process.env.RESERVATION_SWEEP_INTERVAL_MS || 60_000);
const reservationSweepTimer = setInterval(async () => {
    try {
        const expired = await expirePendingReservationsService();
        if (expired > 0) {
            console.log(`[orders] expired reservations released: ${expired}`);
        }
    } catch (error) {
        console.error("[orders] reservation sweep failed:", error.message);
    }
}, Math.max(10_000, RESERVATION_SWEEP_INTERVAL_MS));

if (typeof reservationSweepTimer.unref === "function") {
    reservationSweepTimer.unref();
}
