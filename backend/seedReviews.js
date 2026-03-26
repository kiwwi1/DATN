import mongoose from 'mongoose';
import 'dotenv/config';
import bcrypt from 'bcrypt';
import connectDB from './config/mongodb.js';
import reviewModel from './models/reviewModel.js';
import productModel from './models/productModel.js';
import userModel from './models/userModel.js';

// ── Fake reviewers ─────────────────────────────────────────────────────────────
const FAKE_USERS = [
    { name: 'Nguyễn Thị Lan',     email: 'reviewer.lan@fake.com'     },
    { name: 'Trần Văn Minh',      email: 'reviewer.minh@fake.com'    },
    { name: 'Lê Thị Hương',       email: 'reviewer.huong@fake.com'   },
    { name: 'Phạm Đức Anh',       email: 'reviewer.anh@fake.com'     },
    { name: 'Hoàng Thị Mai',      email: 'reviewer.mai@fake.com'     },
    { name: 'Vũ Quốc Huy',        email: 'reviewer.huy@fake.com'     },
    { name: 'Đặng Thị Thu',       email: 'reviewer.thu@fake.com'     },
    { name: 'Bùi Văn Nam',        email: 'reviewer.nam@fake.com'     },
    { name: 'Ngô Thị Linh',       email: 'reviewer.linh@fake.com'    },
    { name: 'Đinh Quang Khải',    email: 'reviewer.khai@fake.com'    },
    { name: 'Trịnh Thị Ngọc',    email: 'reviewer.ngoc@fake.com'    },
    { name: 'Lý Văn Tùng',        email: 'reviewer.tung@fake.com'    },
    { name: 'Phan Thị Bích',      email: 'reviewer.bich@fake.com'    },
    { name: 'Cao Minh Đức',       email: 'reviewer.duc@fake.com'     },
    { name: 'Dương Thị Hoa',      email: 'reviewer.hoa@fake.com'     },
    { name: 'Lưu Văn Thắng',      email: 'reviewer.thang@fake.com'   },
    { name: 'Tống Thị Thanh',     email: 'reviewer.thanh@fake.com'   },
    { name: 'Hà Đình Phúc',       email: 'reviewer.phuc@fake.com'    },
    { name: 'Mai Thị Yến',        email: 'reviewer.yen@fake.com'     },
    { name: 'Nguyễn Văn Tuấn',   email: 'reviewer.tuan@fake.com'    },
];

// ── Review comment pools by star rating ───────────────────────────────────────
const COMMENTS = {
    5: [
        'Sản phẩm quá tuyệt vời! Chất lượng vượt kỳ vọng, đóng gói cẩn thận, giao hàng nhanh. Sẽ quay lại mua thêm.',
        'Mình đã dùng nhiều thương hiệu khác nhau nhưng cái này thật sự tốt nhất. Đáng tiền lắm, rất hài lòng!',
        'Chất lượng y như mô tả, màu sắc đẹp, không bị phai sau khi giặt. Shop tư vấn nhiệt tình, đóng gói chắc chắn.',
        'Mua lần đầu nhưng ưng lắm. Sản phẩm đẹp hơn ảnh, dùng thấy ngay sự khác biệt so với hàng rẻ tiền.',
        'Tuyệt vời! Mình đặt hôm qua hôm nay đã nhận được. Sản phẩm đúng như mô tả, chất lượng rất ổn.',
        'Đây là lần thứ 3 mình mua item này. Luôn giữ chất lượng ổn định, không lo hàng kém. Five stars!',
        'Giao hàng siêu tốc, chỉ 1 ngày đã nhận được. Sản phẩm đóng gói kỹ lưỡng, không trầy xước gì cả.',
        'Rất hài lòng với chất lượng. Đúng size, màu đẹp y ảnh, dùng thoải mái. Recommend cho mọi người.',
        'Shop phản hồi nhanh, giải đáp thắc mắc nhiệt tình. Sản phẩm đúng chuẩn chính hãng. Cảm ơn shop!',
        'Mình mua làm quà tặng, người nhận thích lắm. Bao bì sang trọng, quà cáp đẹp. Rất đáng tiền.',
        'Sản phẩm vượt xa kỳ vọng. Dùng thử thấy ngay chất lượng hơn hẳn hàng tầm giá này. Cực kỳ hài lòng!',
        'Đặt lúc 8 giờ tối, sáng hôm sau đã nhận. Logistic nhanh, sản phẩm không bị móp méo gì. Hài lòng 100%.',
        'Chất liệu rất tốt, nhìn là biết hàng xịn. Dùng đã 2 tuần vẫn như mới, không bị xuống cấp hay bạc màu.',
        'Shop uy tín, giao đúng sản phẩm như mô tả. Mình đã giới thiệu cho cả gia đình cùng mua.',
        'Sản phẩm hoàn hảo, không có điểm nào để chê. Đây chắc chắn là shop mình sẽ quay lại.',
    ],
    4: [
        'Sản phẩm tốt, chất lượng ổn. Chỉ trừ 1 sao vì giao hàng hơi chậm, mất 3 ngày mới nhận được.',
        'Nhìn chung khá ưng. Sản phẩm đúng như mô tả, dùng tốt. Nhưng đóng gói bên ngoài hơi đơn giản.',
        'Chất lượng ok, giá tốt trong phân khúc này. Sẽ cân nhắc mua thêm nếu có deal tốt hơn.',
        'Mua về dùng thấy ổn. Chỉ có điều màu thực tế hơi khác với ảnh một chút nhưng vẫn đẹp.',
        'Sản phẩm dùng được, đúng công năng. Chất liệu ổn, không quá xuất sắc nhưng xứng đáng với giá tiền.',
        'Mình thấy tốt, phù hợp nhu cầu. Giao hàng nhanh. Trừ 1 sao vì hướng dẫn sử dụng không rõ ràng.',
        'Hàng ổn, dùng được ngay. Thiết kế đẹp, nhưng chất liệu có thể cải thiện hơn ở mức giá này.',
        'Nhìn chung hài lòng. Sản phẩm chắc chắn, dùng thuận tiện. Hộp đựng sạch sẽ, giao hàng đúng hẹn.',
        'Tốt so với giá tiền. Đã dùng được 1 tháng, chưa thấy vấn đề gì. Recommend cho ai cần.',
        'Sản phẩm đúng như quảng cáo. Trừ 1 sao vì khâu xử lý đơn hàng hơi lâu, phải chờ 1 ngày.',
    ],
    3: [
        'Sản phẩm tạm ổn, dùng được nhưng không ấn tượng. Chất lượng trung bình, xứng đáng với mức giá.',
        'Giao hàng chậm, mất gần 1 tuần mới nhận. Sản phẩm ổn nhưng trải nghiệm mua hàng không tốt.',
        'Chất lượng tầm trung, không tệ nhưng cũng không xuất sắc. Mua về dùng được, không hối hận.',
        'Màu thực tế khác với ảnh khá nhiều. Sản phẩm không xấu nhưng không đúng kỳ vọng ban đầu.',
        'Mua về cũng được nhưng thấy không bằng sản phẩm cùng giá của hãng khác đã dùng trước.',
        'Bình thường, không có gì đặc biệt. Dùng được, không tệ. Sẽ không mua lại vì có lựa chọn tốt hơn.',
    ],
    2: [
        'Không hài lòng. Sản phẩm không như mô tả, chất lượng kém hơn nhiều so với ảnh quảng cáo.',
        'Hàng bị lỗi nhỏ, có vài chỗ không như ý. Shop đã xử lý nhưng trải nghiệm không tốt lắm.',
        'Chất liệu kém hơn kỳ vọng. Nhìn ảnh đẹp nhưng cầm tay thấy ngay chất lượng không ổn.',
    ],
    1: [
        'Sản phẩm không đúng như mô tả. Rất thất vọng, sẽ không mua lại.',
        'Hàng kém chất lượng. Đã liên hệ shop nhưng không được hỗ trợ đầy đủ.',
    ],
};

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// Sinh rating có xác suất cao về 4-5 sao (giống thực tế)
const generateRating = (productRating) => {
    const base = Math.round(productRating || 4.5);
    const rand = Math.random();
    // 60% đúng base, 25% base-1, 10% base+1 (nếu <5), 5% thấp hơn
    if (rand < 0.60) return Math.min(5, Math.max(1, base));
    if (rand < 0.85) return Math.min(5, Math.max(1, base - 1));
    if (rand < 0.95) return Math.min(5, Math.max(1, base + 1));
    return Math.floor(Math.random() * 3) + 1;
};

// Số lượng review cho từng sản phẩm dựa trên sold
const reviewCountFor = (sold) => {
    if (sold > 10000) return Math.floor(Math.random() * 8) + 8;   // 8-15
    if (sold > 3000)  return Math.floor(Math.random() * 6) + 5;   // 5-10
    if (sold > 500)   return Math.floor(Math.random() * 5) + 3;   // 3-7
    return Math.floor(Math.random() * 3) + 2;                      // 2-4
};

const updateProductRating = async (productId) => {
    const objectId = new mongoose.Types.ObjectId(productId);
    const stats = await reviewModel.aggregate([
        { $match: { product: objectId } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    const rating = stats[0] ? Math.round(stats[0].avg * 10) / 10 : 0;
    const reviewCount = stats[0] ? stats[0].count : 0;
    await productModel.findByIdAndUpdate(productId, { rating, reviewCount });
};

const seedReviews = async () => {
    try {
        await connectDB();

        // 1. Tạo/lấy fake users
        const hashed = await bcrypt.hash('Reviewer@123', 10);
        const userIds = [];
        for (const u of FAKE_USERS) {
            let user = await userModel.findOne({ email: u.email });
            if (!user) {
                user = await userModel.create({ name: u.name, email: u.email, password: hashed, role: 'user' });
            }
            userIds.push(user._id);
        }
        console.log(`👥 ${userIds.length} fake reviewers ready`);

        // 2. Xoá review cũ của fake users
        const removed = await reviewModel.deleteMany({ user: { $in: userIds } });
        if (removed.deletedCount > 0) {
            console.log(`🗑  Removed ${removed.deletedCount} old fake reviews`);
        }

        // 3. Lấy tất cả sản phẩm
        const products = await productModel.find({ isActive: true }).lean();
        console.log(`📦 Seeding reviews for ${products.length} products...`);

        let totalInserted = 0;
        const reviewDocs = [];

        for (const product of products) {
            const count = reviewCountFor(product.sold || 0);
            const usedUserIndices = new Set();

            for (let i = 0; i < count; i++) {
                // Chọn user không trùng cho cùng 1 sản phẩm
                let userIndex;
                let attempts = 0;
                do {
                    userIndex = Math.floor(Math.random() * userIds.length);
                    attempts++;
                } while (usedUserIndices.has(userIndex) && attempts < 50);
                if (usedUserIndices.has(userIndex)) continue;
                usedUserIndices.add(userIndex);

                const rating = generateRating(product.rating);
                const comment = Math.random() > 0.15 ? pick(COMMENTS[rating] || COMMENTS[4]) : ''; // 15% không có comment

                // Ngày tạo ngẫu nhiên trong 6 tháng gần đây
                const daysAgo = Math.floor(Math.random() * 180);
                const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

                reviewDocs.push({
                    user: userIds[userIndex],
                    product: product._id,
                    orderId: new mongoose.Types.ObjectId(), // fake orderId
                    rating,
                    comment,
                    images: [],
                    createdAt,
                    updatedAt: createdAt,
                });
                totalInserted++;
            }
        }

        // 4. Insert tất cả reviews
        await reviewModel.insertMany(reviewDocs, { ordered: false });
        console.log(`✅ Inserted ${totalInserted} reviews`);

        // 5. Cập nhật rating + reviewCount cho từng product
        console.log('📊 Updating product ratings...');
        for (const product of products) {
            await updateProductRating(product._id.toString());
        }
        console.log('✅ Product ratings updated');

        // 6. Thống kê
        const avgReviews = (totalInserted / products.length).toFixed(1);
        console.log(`\n🎉 Done! ${totalInserted} reviews across ${products.length} products (~${avgReviews}/product)`);

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
};

seedReviews();
