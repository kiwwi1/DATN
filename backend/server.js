import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './config/mongodb.js';
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


// App config
const app = express();
const port = process.env.PORT || 4000;

// Kết nối DB rồi đồng bộ index (xóa index cũ, tạo index mới)
connectDB().then(async () => {
    try {
        await reviewModel.syncIndexes();
        console.log('✅ Review indexes synced');
    } catch (e) {
        console.warn('⚠️ syncIndexes warning:', e.message);
    }
});

// Middlewares
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true
}));
app.use(express.json());




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

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

