import mongoose from "mongoose";
import "dotenv/config";
import bcrypt from "bcrypt";
import connectDB from "./config/mongodb.js";
import reviewModel from "./models/reviewModel.js";
import productModel from "./models/productModel.js";
import userModel from "./models/userModel.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const FAKE_USER_COUNT = Number(process.env.SEED_REVIEW_USER_COUNT || 480);
const MIN_REVIEWS_PER_PRODUCT = Number(process.env.SEED_REVIEW_MIN_PER_PRODUCT || 4);
const MAX_REVIEWS_PER_PRODUCT = Number(process.env.SEED_REVIEW_MAX_PER_PRODUCT || 60);
const COMMENTLESS_REVIEW_RATE = Number(process.env.SEED_REVIEW_EMPTY_RATIO || 0.12);
const REPLACE_OLD_FAKE_REVIEWS = String(process.env.SEED_REVIEW_REPLACE_OLD ?? "true").toLowerCase() !== "false";
const FAKE_USER_EMAIL_DOMAIN = "seed.review.local";
const FAKE_USER_EMAIL_PREFIX = "seed.reviewer";

const LAST_NAMES = [
    "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ",
    "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý",
];

const MIDDLE_NAMES = [
    "Thị", "Văn", "Gia", "Minh", "Khánh", "Quốc", "Thanh", "Bảo",
    "Đức", "Ngọc", "Hải", "Thu", "Anh", "Phương", "Tường", "Mai",
];

const FIRST_NAMES = [
    "An", "Anh", "Bình", "Châu", "Duy", "Giang", "Hà", "Hân",
    "Hiếu", "Hùng", "Khải", "Lan", "Linh", "Long", "Mai", "Minh",
    "My", "Nam", "Ngân", "Ngọc", "Nhung", "Phúc", "Quân", "Quỳnh",
    "Sơn", "Thảo", "Trang", "Trinh", "Tuấn", "Uyên", "Vy", "Yến",
];

const COMMENT_OPENERS = {
    5: [
        "{product} đúng như mong đợi.",
        "Nhận hàng xong dùng thử thấy rất ưng.",
        "Mua lần đầu nhưng trải nghiệm rất tốt.",
        "Sản phẩm này làm mình khá bất ngờ theo hướng tích cực.",
    ],
    4: [
        "{product} nhìn chung khá ổn.",
        "Dùng thực tế thấy đáp ứng tốt nhu cầu.",
        "Chất lượng ổn trong tầm giá.",
        "Mình khá hài lòng sau vài ngày sử dụng.",
    ],
    3: [
        "Sản phẩm ở mức tạm ổn.",
        "Dùng được nhưng chưa thật sự nổi bật.",
        "{product} không tệ nhưng cũng chưa xuất sắc.",
        "Trải nghiệm tổng thể ở mức trung bình khá.",
    ],
    2: [
        "Trải nghiệm của mình chưa tốt lắm.",
        "{product} có vài điểm chưa như kỳ vọng.",
        "Nhận hàng xong thấy chất lượng chưa ổn.",
        "Mình hơi thất vọng khi dùng thực tế.",
    ],
    1: [
        "Sản phẩm không giống kỳ vọng ban đầu.",
        "Trải nghiệm khá tệ so với mô tả.",
        "{product} làm mình thất vọng.",
        "Mình không hài lòng với lần mua này.",
    ],
};

const POSITIVE_DETAILS = [
    "Đóng gói cẩn thận, nhận hàng nguyên vẹn.",
    "Hoàn thiện ổn, cầm trên tay chắc chắn.",
    "Màu sắc và hình thức khá sát ảnh.",
    "Dùng hàng ngày thấy ổn định và tiện.",
    "Shop xử lý đơn nhanh, giao đúng mẫu đã đặt.",
    "Tổng thể rất đáng tiền trong phân khúc.",
];

const NEUTRAL_DETAILS = [
    "Dùng đúng công năng nhưng chưa tạo khác biệt lớn.",
    "Hoàn thiện ở mức chấp nhận được.",
    "Phù hợp nếu cần một lựa chọn cơ bản.",
    "Chất lượng tương xứng với mức giá hiện tại.",
];

const NEGATIVE_DETAILS = [
    "Hoàn thiện chưa thật sự chắc chắn.",
    "Thực tế có vài chi tiết chưa giống kỳ vọng.",
    "Trải nghiệm sử dụng chưa mượt như mong muốn.",
    "Cảm giác chất lượng chưa tương xứng giá tiền.",
];

const POSITIVE_CLOSERS = [
    "Sẽ cân nhắc mua lại nếu cần.",
    "Mình sẽ giới thiệu thêm cho bạn bè.",
    "Nói chung khá hài lòng với lần mua này.",
    "Nếu shop giữ chất lượng như vậy thì rất ổn.",
];

const MIXED_CLOSERS = [
    "Nếu shop tối ưu thêm một chút thì sẽ tốt hơn.",
    "Tạm thời mình vẫn dùng được.",
    "Có thể mua nếu không quá khắt khe.",
    "Mình mong đợi phiên bản sau chỉn chu hơn.",
];

const NEGATIVE_CLOSERS = [
    "Hiện tại mình chưa muốn mua lại.",
    "Hy vọng shop cải thiện chất lượng ở các lô sau.",
    "Mình không đánh giá cao lần mua này.",
    "Nếu được chọn lại thì mình sẽ cân nhắc sản phẩm khác.",
];

const PRODUCT_HINTS = [
    { test: /(iphone|samsung|xiaomi|oppo|vivo|macbook|laptop|monitor|router|camera|tv|console|headphone|earbud|speaker)/i, details: [
        "Hiệu năng và độ ổn định nhìn chung khá tốt.",
        "Thiết bị hoạt động mượt, không gặp lỗi vặt.",
        "Cảm giác sử dụng thực tế ổn hơn mình nghĩ.",
    ] },
    { test: /(powerbank|sạc|charger|usb|pd|magsafe|cable|pin dự phòng)/i, details: [
        "Khả năng sạc và kết nối ổn định.",
        "Công suất thực tế đủ dùng cho nhu cầu hàng ngày.",
        "Dùng vài lần đầu thấy sạc khá đều và không nóng nhiều.",
    ] },
    { test: /(áo|quần|shirt|dress|hoodie|jacket|jeans|skirt|fashion|sneaker|sandal|giày|túi|handbag|backpack)/i, details: [
        "Form và chất liệu ở ngoài khá ổn.",
        "Mặc lên thấy thoải mái, không bị cứng.",
        "Kiểu dáng dễ phối và lên form gọn.",
    ] },
    { test: /(serum|kem|skincare|makeup|lipstick|perfume|beauty|haircare)/i, details: [
        "Kết cấu và cảm giác sử dụng khá dễ chịu.",
        "Mùi và texture ở mức ổn, không bị gắt.",
        "Dùng vài lần đầu thấy tương đối lành tính.",
    ] },
    { test: /(kitchen|bottle|lamp|bedding|decor|home|appliance|coffee|storage)/i, details: [
        "Hoàn thiện gọn gàng, dùng đúng nhu cầu.",
        "Lắp đặt và sử dụng khá đơn giản.",
        "Kích thước và công năng đúng như mình cần.",
    ] },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const pick = (items) => items[Math.floor(Math.random() * items.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const shuffle = (items) => {
    const cloned = [...items];
    for (let index = cloned.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
    }
    return cloned;
};

const buildFakeUserProfiles = (count) => {
    const profiles = [];
    for (let index = 0; index < count; index += 1) {
        const lastName = LAST_NAMES[index % LAST_NAMES.length];
        const middleName = MIDDLE_NAMES[Math.floor(index / LAST_NAMES.length) % MIDDLE_NAMES.length];
        const firstName =
            FIRST_NAMES[
                Math.floor(index / (LAST_NAMES.length * MIDDLE_NAMES.length)) % FIRST_NAMES.length
            ];
        profiles.push({
            name: `${lastName} ${middleName} ${firstName}`,
            email: `${FAKE_USER_EMAIL_PREFIX}.${String(index + 1).padStart(4, "0")}@${FAKE_USER_EMAIL_DOMAIN}`,
        });
    }
    return profiles;
};

const deriveTargetReviewCount = (product) => {
    const reviewCount = Math.max(0, Number(product.reviewCount || 0));
    const sold = Math.max(0, Number(product.sold || 0));
    if (reviewCount <= 0 && sold <= 0) return 0;

    const fromExistingCount = reviewCount > 0 ? Math.round(Math.sqrt(reviewCount) * 2.4) : 0;
    const fromSold = sold > 0 ? Math.round(Math.log10(sold + 10) * 8) : 0;
    const target = Math.max(fromExistingCount, fromSold, sold > 0 ? MIN_REVIEWS_PER_PRODUCT : 0);
    return clamp(target, MIN_REVIEWS_PER_PRODUCT, MAX_REVIEWS_PER_PRODUCT);
};

const generateRating = (targetRating) => {
    const target = clamp(Number(targetRating || 4.5), 1, 5);
    const weights = [1, 2, 3, 4, 5].map((star) => {
        const distance = Math.abs(star - target);
        const baseWeight = 1 / (1 + distance * 1.25);
        const favorPositive = target >= 4.5 && star >= 4 ? 0.25 : 0;
        return baseWeight + favorPositive;
    });
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = Math.random() * totalWeight;
    for (let index = 0; index < weights.length; index += 1) {
        cursor -= weights[index];
        if (cursor <= 0) return index + 1;
    }
    return Math.round(target);
};

const buildProductDetail = (product, rating) => {
    const haystack = `${product.name || ""} ${product.brand || ""} ${(product.tags || []).join(" ")}`;
    const hints = PRODUCT_HINTS.flatMap((entry) => (entry.test.test(haystack) ? entry.details : []));

    if (product.attributes?.length) {
        const attribute = pick(product.attributes);
        const value = attribute?.values?.length ? pick(attribute.values) : "";
        if (attribute?.name && value) {
            hints.push(`${attribute.name} ${value} đúng như mô tả.`);
        }
    }

    if (rating >= 4) {
        hints.push(...POSITIVE_DETAILS);
    } else if (rating === 3) {
        hints.push(...NEUTRAL_DETAILS);
    } else {
        hints.push(...NEGATIVE_DETAILS);
    }

    return pick(hints);
};

const buildComment = (product, rating) => {
    if (Math.random() < COMMENTLESS_REVIEW_RATE) return "";

    const productLabel = Math.random() < 0.45
        ? `${product.brand ? `${product.brand} ` : ""}${product.name}`.trim()
        : "Sản phẩm";

    const opener = pick(COMMENT_OPENERS[rating]).replace("{product}", productLabel);
    const detail = buildProductDetail(product, rating);
    const closer =
        rating >= 4
            ? pick(POSITIVE_CLOSERS)
            : rating === 3
                ? pick(MIXED_CLOSERS)
                : pick(NEGATIVE_CLOSERS);

    return [opener, detail, closer].join(" ").trim();
};

const buildCreatedAt = () => {
    const daysAgo = randomInt(2, 240);
    const hourOffset = randomInt(0, 23);
    const minuteOffset = randomInt(0, 59);
    return new Date(Date.now() - daysAgo * DAY_MS - hourOffset * 60 * 60 * 1000 - minuteOffset * 60 * 1000);
};

const ensureFakeUsers = async () => {
    const profiles = buildFakeUserProfiles(FAKE_USER_COUNT);
    const hashedPassword = await bcrypt.hash("Reviewer@123", 10);

    await userModel.bulkWrite(
        profiles.map((profile) => ({
            updateOne: {
                filter: { email: profile.email },
                update: {
                    $set: {
                        name: profile.name,
                        emailVerified: true,
                        role: "user",
                    },
                    $setOnInsert: {
                        email: profile.email,
                        password: hashedPassword,
                    },
                    $unset: {
                        emailVerificationToken: "",
                        emailVerificationExpires: "",
                    },
                },
                upsert: true,
            },
        })),
        { ordered: false }
    );

    return userModel
        .find({ email: { $in: profiles.map((profile) => profile.email) } })
        .select("_id email")
        .lean();
};

const loadReviewStats = async (productIds) => {
    const stats = await reviewModel.aggregate([
        { $match: { product: { $in: productIds } } },
        { $group: { _id: "$product", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);

    return new Map(
        stats.map((entry) => [
            String(entry._id),
            {
                count: Number(entry.count || 0),
                avg: Number(entry.avg || 0),
            },
        ])
    );
};

const syncProductRatings = async (products) => {
    const productIds = products.map((product) => product._id);
    const statsMap = await loadReviewStats(productIds);

    await productModel.bulkWrite(
        products.map((product) => {
            const stats = statsMap.get(String(product._id));
            const rating = stats ? Math.round(stats.avg * 10) / 10 : 0;
            const reviewCount = stats ? stats.count : 0;
            return {
                updateOne: {
                    filter: { _id: product._id },
                    update: { $set: { rating, reviewCount } },
                },
            };
        }),
        { ordered: false }
    );
};

const seedReviews = async () => {
    try {
        await connectDB();

        const fakeUsers = await ensureFakeUsers();
        const fakeUserIds = fakeUsers.map((user) => user._id);
        console.log(`👥 Reviewer pool ready: ${fakeUsers.length} users`);

        if (REPLACE_OLD_FAKE_REVIEWS) {
            const removed = await reviewModel.deleteMany({ user: { $in: fakeUserIds } });
            console.log(`🗑 Removed ${removed.deletedCount || 0} old seeded reviews`);
        }

        const products = await productModel
            .find({ isActive: true })
            .select("_id name brand sold rating reviewCount tags attributes")
            .lean();

        console.log(`📦 Backfilling reviews for ${products.length} active products...`);

        const existingStats = await loadReviewStats(products.map((product) => product._id));
        const reviewDocs = [];
        let productsUpdated = 0;
        let preservedRealReviews = 0;

        for (const product of products) {
            const currentStats = existingStats.get(String(product._id));
            const existingCount = currentStats?.count || 0;
            const targetCount = deriveTargetReviewCount(product);
            preservedRealReviews += existingCount;

            const needed = clamp(targetCount - existingCount, 0, fakeUserIds.length);
            if (needed <= 0) continue;

            productsUpdated += 1;
            const reviewers = shuffle(fakeUserIds).slice(0, needed);

            for (const reviewerId of reviewers) {
                const rating = generateRating(product.rating || 4.5);
                const createdAt = buildCreatedAt();
                reviewDocs.push({
                    user: reviewerId,
                    product: product._id,
                    orderId: new mongoose.Types.ObjectId(),
                    rating,
                    comment: buildComment(product, rating),
                    images: [],
                    createdAt,
                    updatedAt: createdAt,
                });
            }
        }

        if (reviewDocs.length > 0) {
            await reviewModel.insertMany(reviewDocs, { ordered: false });
        }

        await syncProductRatings(products);

        const finalStats = await loadReviewStats(products.map((product) => product._id));
        const totalReviews = [...finalStats.values()].reduce((sum, stat) => sum + stat.count, 0);
        const averagePerProduct = products.length > 0 ? (totalReviews / products.length).toFixed(1) : "0.0";

        console.log(`✅ Seeded ${reviewDocs.length} new reviews`);
        console.log(`🔒 Preserved ${preservedRealReviews} existing reviews already in DB`);
        console.log(`🛍 Products updated: ${productsUpdated}/${products.length}`);
        console.log(`📊 Final total reviews: ${totalReviews} (~${averagePerProduct}/product)`);

        process.exit(0);
    } catch (error) {
        console.error("❌ seedReviews failed:", error);
        process.exit(1);
    }
};

seedReviews();
