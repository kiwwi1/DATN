/**
 * Script to reset and recalculate actual product sold counts based on database orders.
 *
 * Chạy từ thư mục backend:
 *   node scripts/resetProductSold.js
 */

import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";
import orderModel from "../models/orderModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

async function main() {
  try {
    console.log("🔌 Connecting to database...");
    await connectDB();

    console.log("🔄 Resetting all product sold counts to 0...");
    const resetResult = await productModel.updateMany({}, { $set: { sold: 0 } });
    console.log(`✅ Reset completed. Affected products: ${resetResult.modifiedCount}`);

    console.log("📦 Fetching all non-cancelled orders to recalculate actual sales...");
    const orders = await orderModel.find({ status: { $ne: "Cancelled" } }).lean();
    console.log(`📊 Found ${orders.length} non-cancelled orders.`);

    const salesMap = new Map();
    let totalItemsProcessed = 0;

    for (const order of orders) {
      if (!order.items || !Array.isArray(order.items)) continue;
      for (const item of order.items) {
        const productId = String(item._id);
        const quantity = Math.max(0, Number(item.quantity) || 0);
        if (quantity === 0) continue;

        salesMap.set(productId, (salesMap.get(productId) || 0) + quantity);
        totalItemsProcessed += quantity;
      }
    }

    console.log(`📈 Recalculating sales for ${salesMap.size} unique products (total quantity: ${totalItemsProcessed})...`);

    let updatedProductsCount = 0;
    for (const [productId, quantity] of salesMap.entries()) {
      const updateResult = await productModel.updateOne(
        { _id: productId },
        { $set: { sold: quantity } }
      );
      if (updateResult.modifiedCount > 0) {
        updatedProductsCount++;
      }
    }

    console.log(`🎉 Recalculation completed. Updated sales count for ${updatedProductsCount} products.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

main();
