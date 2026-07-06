/**
 * Seed 50 Apple products vào Apple Official Store.
 * - Upsert sản phẩm theo tag import:apple:<index>
 * - Seed fake reviews + sync rating/reviewCount
 * Usage: node scripts/seedAppleProducts.js
 */
import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import mongoose from "mongoose";
import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";
import reviewModel from "../models/reviewModel.js";
import userModel from "../models/userModel.js";
import bcrypt from "bcrypt";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

// ─── Cấu hình ────────────────────────────────────────────────────────────────
const APPLE_VENDOR_ID   = "69c4e7cc845ed1af8f99534c";
const APPLE_SHOP_NAME   = "Apple Official Store";
const FAKE_DOMAIN       = "seed.review.local";
const FAKE_PREFIX       = "seed.reviewer";
const FAKE_USER_COUNT   = 480;
const MIN_REVIEWS       = 5;
const MAX_REVIEWS       = 65;
const PLACEHOLDER_IMAGE = "https://placehold.co/600x600?text=Apple+Product";

// ─── Dữ liệu tên người dùng giả ──────────────────────────────────────────────
const LAST   = ["Nguyễn","Trần","Lê","Phạm","Hoàng","Huỳnh","Phan","Vũ","Võ","Đặng","Bùi","Đỗ","Hồ","Ngô","Dương","Lý"];
const MIDDLE = ["Thị","Văn","Gia","Minh","Khánh","Quốc","Thanh","Bảo","Đức","Ngọc","Hải","Thu","Anh","Phương","Tường","Mai"];
const FIRST  = ["An","Anh","Bình","Châu","Duy","Giang","Hà","Hân","Hiếu","Hùng","Khải","Lan","Linh","Long","Mai","Minh","My","Nam","Ngân","Ngọc","Nhung","Phúc","Quân","Quỳnh","Sơn","Thảo","Trang","Trinh","Tuấn","Uyên","Vy","Yến"];

// ─── Nội dung review theo sao ─────────────────────────────────────────────────
const OPENERS = {
  5: ["Sản phẩm vượt kỳ vọng, dùng thực tế rất ưng ý.","Đặt hàng Apple chính hãng lần này rất hài lòng.","Nhận hàng xong dùng thử thấy xuất sắc thật sự."],
  4: ["Nhìn chung sản phẩm khá tốt trong tầm giá.","Dùng thực tế đáp ứng tốt nhu cầu hàng ngày.","Hài lòng sau vài ngày trải nghiệm."],
  3: ["Sản phẩm ở mức ổn, không quá nổi bật.","Dùng được nhưng chưa thật sự ấn tượng.","Trải nghiệm tổng thể trung bình khá."],
  2: ["Chưa hài lòng hoàn toàn với lần mua này.","Thực tế có vài điểm chưa như kỳ vọng.","Cảm giác chất lượng chưa tương xứng."],
  1: ["Khá thất vọng so với mô tả ban đầu.","Trải nghiệm chưa tốt như mong đợi.","Sản phẩm không như kỳ vọng của mình."],
};
const DETAILS_POS = ["Đóng gói cẩn thận, nhận hàng nguyên vẹn.","Hoàn thiện cao cấp, cầm trên tay chắc chắn.","Hiệu năng mượt, không gặp lỗi vặt.","Giao hàng nhanh, đúng hàng đã đặt.","Màu sắc đẹp, khớp hoàn toàn với ảnh."];
const DETAILS_NEU = ["Hoàn thiện ở mức chấp nhận được.","Phù hợp nếu cần một lựa chọn cơ bản.","Chất lượng tương xứng mức giá."];
const DETAILS_NEG = ["Hoàn thiện chưa thật sự chắc chắn.","Có vài chi tiết chưa giống kỳ vọng.","Chất lượng chưa tương xứng giá tiền."];
const CLOSERS_POS = ["Sẽ mua lại nếu cần.","Giới thiệu thêm cho bạn bè.","Rất hài lòng với lần mua này."];
const CLOSERS_NEU = ["Tạm thời vẫn dùng được.","Mong đợi phiên bản sau chỉn chu hơn."];
const CLOSERS_NEG = ["Chưa muốn mua lại lần này.","Hy vọng shop cải thiện hơn."];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pick    = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const buildComment = (rating) => {
  if (Math.random() < 0.10) return "";
  const opener  = pick(OPENERS[rating]);
  const detail  = rating >= 4 ? pick(DETAILS_POS) : rating === 3 ? pick(DETAILS_NEU) : pick(DETAILS_NEG);
  const closer  = rating >= 4 ? pick(CLOSERS_POS) : rating === 3 ? pick(CLOSERS_NEU) : pick(CLOSERS_NEG);
  return `${opener} ${detail} ${closer}`;
};

const generateRating = (target) => {
  const t = Math.min(5, Math.max(1, Number(target || 4.7)));
  const w = [1,2,3,4,5].map(s => {
    const d = Math.abs(s - t);
    return 1 / (1 + d * 1.25) + (t >= 4.5 && s >= 4 ? 0.25 : 0);
  });
  const total = w.reduce((s, x) => s + x, 0);
  let cur = Math.random() * total;
  for (let i = 0; i < w.length; i++) { cur -= w[i]; if (cur <= 0) return i + 1; }
  return Math.round(t);
};

// ─── Tạo / lấy pool fake users ────────────────────────────────────────────────
async function ensureFakeUsers() {
  const profiles = [];
  for (let i = 0; i < FAKE_USER_COUNT; i++) {
    profiles.push({
      name:  `${LAST[i % LAST.length]} ${MIDDLE[Math.floor(i / LAST.length) % MIDDLE.length]} ${FIRST[Math.floor(i / (LAST.length * MIDDLE.length)) % FIRST.length]}`,
      email: `${FAKE_PREFIX}.${String(i + 1).padStart(4, "0")}@${FAKE_DOMAIN}`,
    });
  }
  const hashed = await bcrypt.hash("Reviewer@123", 10);
  await userModel.bulkWrite(profiles.map(p => ({
    updateOne: {
      filter: { email: p.email },
      update: { $set: { name: p.name, emailVerified: true, role: "user" }, $setOnInsert: { email: p.email, password: hashed } },
      upsert: true,
    },
  })), { ordered: false });
  return userModel.find({ email: { $in: profiles.map(p => p.email) } }).select("_id").lean();
}

// ─── Đồng bộ rating/reviewCount sau khi seed ─────────────────────────────────
async function syncRatings(productIds) {
  const stats = await reviewModel.aggregate([
    { $match: { product: { $in: productIds } } },
    { $group: { _id: "$product", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const map = new Map(stats.map(s => [String(s._id), { avg: s.avg, count: s.count }]));
  await productModel.bulkWrite(productIds.map(id => ({
    updateOne: {
      filter: { _id: id },
      update: {
        $set: {
          rating:      Math.round((map.get(String(id))?.avg || 0) * 10) / 10,
          reviewCount: map.get(String(id))?.count || 0,
        },
      },
    },
  })), { ordered: false });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await connectDB();

  const jsonPath = join(__dirname, "..", "data", "apple-products.json");
  if (!fs.existsSync(jsonPath)) { console.error("❌ Không tìm thấy apple-products.json"); process.exit(1); }
  const products = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  console.log(`📦 Đang upsert ${products.length} sản phẩm Apple...`);

  const vendorId = new mongoose.Types.ObjectId(APPLE_VENDOR_ID);
  const upsertedIds = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const tag = `import:apple:${i + 1}`;
    const payload = {
      name:           p.name,
      description:    p.description,
      price:          p.price,
      discount:       p.discount || 0,
      image:          Array.isArray(p.image) && p.image.length ? p.image : [PLACEHOLDER_IMAGE],
      category:       new mongoose.Types.ObjectId(p.category),
      bestseller:     p.sold > 2000,
      date:           Date.now() - i * 60000,
      sold:           p.sold || 0,
      vendorId,
      vendorShopName: APPLE_SHOP_NAME,
      stock:          randInt(20, 500),
      rating:         p.rating || 4.7,
      reviewCount:    0,
      brand:          "Apple",
      tags:           [tag, "source:apple", "brand:apple"],
      attributes:     [],
      variants:       [],
      isActive:       true,
    };

    const doc = await productModel.findOneAndUpdate(
      { tags: tag },
      payload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    upsertedIds.push(doc._id);
    process.stdout.write(`\r   ${i + 1}/${products.length} - ${p.name.slice(0, 50)}`);
  }
  console.log("\n✅ Upsert hoàn tất.");

  // ─── Seed reviews ─────────────────────────────────────────────────────────
  console.log("👥 Chuẩn bị pool reviewer...");
  const fakeUsers = await ensureFakeUsers();
  const fakeIds   = fakeUsers.map(u => u._id);
  console.log(`   ${fakeIds.length} fake users sẵn sàng.`);

  const reviewDocs = [];
  const seededProducts = await productModel.find({ _id: { $in: upsertedIds } })
    .select("_id name sold rating").lean();

  for (const prod of seededProducts) {
    const base      = Math.max(prod.sold || 0, 10);
    const target    = Math.min(MAX_REVIEWS, Math.max(MIN_REVIEWS, Math.round(Math.log10(base + 10) * 12)));
    const existing  = await reviewModel.countDocuments({ product: prod._id });
    const needed    = Math.max(0, target - existing);
    if (needed <= 0) continue;

    const reviewers = shuffle(fakeIds).slice(0, needed);
    for (const uid of reviewers) {
      const rating    = generateRating(prod.rating);
      const daysAgo   = randInt(2, 300);
      const createdAt = new Date(Date.now() - daysAgo * 86400000 - randInt(0, 23) * 3600000);
      reviewDocs.push({
        user:      uid,
        product:   prod._id,
        orderId:   new mongoose.Types.ObjectId(),
        rating,
        comment:   buildComment(rating),
        images:    [],
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  if (reviewDocs.length > 0) {
    await reviewModel.insertMany(reviewDocs, { ordered: false });
  }
  console.log(`✅ Đã seed ${reviewDocs.length} reviews.`);

  console.log("🔄 Đồng bộ rating/reviewCount...");
  await syncRatings(upsertedIds);

  console.log("\n🎉 Hoàn tất! Tổng kết:");
  console.log(`   - Sản phẩm Apple: ${upsertedIds.length}`);
  console.log(`   - Reviews mới:    ${reviewDocs.length}`);
  console.log(`\n📝 Mở file để thêm ảnh:`);
  console.log(`   ${join(__dirname, "..", "data", "apple-products.json")}`);
  process.exit(0);
}

main().catch(e => { console.error("❌", e); process.exit(1); });
