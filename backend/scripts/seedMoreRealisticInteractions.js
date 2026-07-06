import mongoose from "mongoose";
import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import categoryModel from "../models/categoryModel.js";
import userInteractionModel from "../models/userInteractionModel.js";
import bcrypt from "bcrypt";
import connectDB from "../config/mongodb.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const vietnameseUsers = [
  { email: "nguyen.an@gmail.com", name: "Nguyễn Văn An", persona: "Men" },
  { email: "tran.binh@gmail.com", name: "Trần Thanh Bình", persona: "Men" },
  { email: "le.chi@gmail.com", name: "Lê Thị Chi", persona: "Women" },
  { email: "pham.dung@gmail.com", name: "Phạm Tiến Dũng", persona: "Men" },
  { email: "hoang.yen@gmail.com", name: "Hoàng Kim Yến", persona: "Women" },
  { email: "vu.ha@gmail.com", name: "Vũ Việt Hà", persona: "Mixed" },
  { email: "phan.huong@gmail.com", name: "Phan Thu Hương", persona: "Women" },
  { email: "dang.khoa@gmail.com", name: "Đặng Đăng Khoa", persona: "Men" },
  { email: "bui.linh@gmail.com", name: "Bùi Khánh Linh", persona: "Women" },
  { email: "do.minh@gmail.com", name: "Đỗ Đức Minh", persona: "Mixed" },
  { email: "ngo.nam@gmail.com", name: "Ngô Hoài Nam", persona: "Men" },
  { email: "duong.oanh@gmail.com", name: "Dương Tú Oanh", persona: "Women" },
  { email: "ly.phong@gmail.com", name: "Lý Thanh Phong", persona: "Men" },
  { email: "diep.quynh@gmail.com", name: "Diệp Trúc Quỳnh", persona: "Kids" },
  { email: "ta.son@gmail.com", name: "Tạ Hồng Sơn", persona: "Mixed" },
  { email: "dinh.thao@gmail.com", name: "Đinh Phương Thảo", persona: "Kids" },
  { email: "lam.uyen@gmail.com", name: "Lâm Nhã Uyên", persona: "Women" },
  { email: "mai.vy@gmail.com", name: "Mai Thảo Vy", persona: "Kids" },
  { email: "doan.xuong@gmail.com", name: "Đoàn Minh Xương", persona: "Mixed" },
  { email: "giang.son@gmail.com", name: "Giang Trường Sơn", persona: "Men" }
];

const weights = {
  purchased: 10,
  rated: 2,
  reviewed: 8,
  addedToCart: 5,
  wishlisted: 6,
  viewed: 1,
  clicked: 1,
  searched: 2,
  timeSpent: 0.01 // per second
};

const calculateScore = (interactions) => {
  let score = 0;
  score += (interactions.purchased || 0) * weights.purchased;
  score += (interactions.rated || 0) * weights.rated;
  score += (interactions.reviewed ? weights.reviewed : 0);
  score += (interactions.addedToCart || 0) * weights.addedToCart;
  score += (interactions.wishlisted ? weights.wishlisted : 0);
  score += (interactions.viewed || 0) * weights.viewed;
  score += (interactions.clicked || 0) * weights.clicked;
  score += (interactions.searched || 0) * weights.searched;
  score += (interactions.timeSpent || 0) * weights.timeSpent;
  return Number(score.toFixed(2));
};

async function seed() {
  try {
    console.log("Connecting to database...");
    await connectDB();
    console.log("Connected to MongoDB!");

    // 1. Fetch active categories
    const categories = await categoryModel.find({ isActive: true }).lean();
    console.log(`Found ${categories.length} active categories in database.`);

    const categoryMap = {}; // Maps "Men", "Women", "Kids" to their mongo objectId strings
    for (const cat of categories) {
      const nameLower = cat.name.toLowerCase();
      if (nameLower.includes("men") && !nameLower.includes("women")) {
        categoryMap["Men"] = cat._id.toString();
      } else if (nameLower.includes("women")) {
        categoryMap["Women"] = cat._id.toString();
      } else if (nameLower.includes("kid") || nameLower.includes("child")) {
        categoryMap["Kids"] = cat._id.toString();
      }
    }
    console.log("Mapped personas to category IDs:", categoryMap);

    // 2. Fetch active products
    const products = await productModel.find({ isActive: true }).lean();
    if (products.length < 10) {
      console.log("Not enough products in DB. Please run seed script or add products first.");
      await mongoose.disconnect();
      return;
    }
    console.log(`Found ${products.length} active products in database.`);

    // 3. Create users
    const passwordHash = await bcrypt.hash("buyer123", 10);
    const users = [];
    for (const uInfo of vietnameseUsers) {
      let user = await userModel.findOne({ email: uInfo.email });
      if (!user) {
        user = await userModel.create({
          name: uInfo.name,
          email: uInfo.email,
          password: passwordHash,
          role: "user",
          emailVerified: true
        });
        console.log(`Created user: ${uInfo.email} (${uInfo.name})`);
      } else {
        console.log(`Found existing user: ${uInfo.email}`);
      }
      users.push({
        _id: user._id,
        email: user.email,
        name: user.name,
        persona: uInfo.persona
      });
    }

    // 4. Clear old interactions
    const deleteRes = await userInteractionModel.deleteMany({});
    console.log(`Cleared ${deleteRes.deletedCount} old user interaction records.`);

    // 5. Generate realistic human-like interactions based on personas
    const interactionsToInsert = [];

    for (const user of users) {
      // Find category ID matching the user persona
      const primaryCategoryId = categoryMap[user.persona];
      
      let primaryProducts = [];
      if (primaryCategoryId) {
        primaryProducts = products.filter(p => p.category?.toString() === primaryCategoryId);
      }
      
      // Fallback to all products if no category match
      if (primaryProducts.length === 0) {
        primaryProducts = products;
      }

      // Secondary products are all other products
      const allOtherProducts = products.filter(p => 
        !primaryProducts.some(pp => pp._id.toString() === p._id.toString())
      );

      // A typical user interacts with 6-12 products total
      const totalInteractionsCount = Math.floor(Math.random() * 7) + 6; 
      const primaryCount = Math.min(primaryProducts.length, Math.floor(totalInteractionsCount * 0.7)); // 70% in preferred category
      
      const selectedProductsMap = new Map();
      
      // Shuffle primary products and take up to primaryCount unique items
      const shuffledPrimary = [...primaryProducts].sort(() => 0.5 - Math.random());
      for (const p of shuffledPrimary) {
        if (selectedProductsMap.size >= primaryCount) break;
        selectedProductsMap.set(p._id.toString(), p);
      }

      // Shuffle other products and fill the rest of the target list
      const shuffledSecondary = [...allOtherProducts].sort(() => 0.5 - Math.random());
      for (const p of shuffledSecondary) {
        if (selectedProductsMap.size >= totalInteractionsCount) break;
        selectedProductsMap.set(p._id.toString(), p);
      }

      // If we still need more products, just pull from general products
      if (selectedProductsMap.size < totalInteractionsCount) {
        const shuffledAll = [...products].sort(() => 0.5 - Math.random());
        for (const p of shuffledAll) {
          if (selectedProductsMap.size >= totalInteractionsCount) break;
          selectedProductsMap.set(p._id.toString(), p);
        }
      }

      const selectedProducts = Array.from(selectedProductsMap.values());

      for (const product of selectedProducts) {
        // Generate human-like stats for this product
        const purchased = Math.random() > 0.75 ? 1 : 0; // ~25% purchase rate
        const addedToCart = purchased ? (Math.floor(Math.random() * 2) + 1) : (Math.random() > 0.7 ? 1 : 0);
        const wishlisted = Math.random() > 0.8;
        const viewed = Math.floor(Math.random() * 8) + (addedToCart ? 2 : 1);
        const clicked = Math.min(viewed, Math.floor(Math.random() * viewed) + (addedToCart ? 1 : 0));
        const searched = Math.random() > 0.85 ? 1 : 0;
        
        let timeSpent = 0;
        if (purchased) {
          timeSpent = Math.floor(Math.random() * 180) + 120; // 2-5 mins
        } else if (addedToCart) {
          timeSpent = Math.floor(Math.random() * 90) + 60; // 1-2.5 mins
        } else {
          timeSpent = Math.floor(Math.random() * 45) + 5; // 5-50 secs
        }

        const rated = purchased && Math.random() > 0.4 ? (Math.floor(Math.random() * 2) + 4) : 0; // 4-5 stars
        const reviewed = rated > 0 && Math.random() > 0.5;

        const interactions = {
          purchased,
          rated,
          reviewed,
          addedToCart,
          wishlisted,
          viewed,
          clicked,
          searched,
          timeSpent
        };

        const score = calculateScore(interactions);

        // Add 0-5 days delay to lastInteraction to simulate varying recency
        const daysAgo = Math.floor(Math.random() * 6);
        const lastInteraction = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        const decayFactor = Math.exp(-daysAgo / 30);

        interactionsToInsert.push({
          userId: user._id,
          productId: product._id,
          interactions,
          interactionScore: score * decayFactor,
          lastInteraction,
          decayFactor
        });
      }
    }

    if (interactionsToInsert.length > 0) {
      await userInteractionModel.insertMany(interactionsToInsert);
      console.log(`Successfully seeded ${interactionsToInsert.length} realistic user interactions for ${users.length} users!`);
    }

    console.log("\nFinished seeding realistic interaction matrix.");
    await mongoose.disconnect();
  } catch (error) {
    console.error("Seed failed:", error.message || error);
    if (error.errors) {
      for (const key of Object.keys(error.errors)) {
        console.error(`Validation error on field [${key}]:`, error.errors[key].message);
      }
    }
    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();
