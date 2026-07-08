import dotenv from "dotenv";
import { join } from "path";
import connectDB from "../config/mongodb.js";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import orderModel from "../models/orderModel.js";

dotenv.config({ path: join(process.cwd(), ".env") });

const normalizeShopName = (shopName) =>
  String(shopName || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

await connectDB();

const vendor = await userModel.findOne({ email: "hieu@gmail.com", role: "vendor" });
if (!vendor) {
  throw new Error("Vendor hieu@gmail.com not found");
}

const nextShopName = "hieu shop";
const normalizedNextShopName = normalizeShopName(nextShopName);
const conflict = await userModel.findOne({
  role: "vendor",
  shopNameNormalized: normalizedNextShopName,
  _id: { $ne: vendor._id },
}).select("_id email shopName").lean();

if (conflict) {
  throw new Error(`Target shop name already exists: ${conflict.shopName} (${conflict.email})`);
}

const previousShopName = vendor.shopName;
vendor.shopName = nextShopName;
vendor.shopNameNormalized = normalizedNextShopName;
await vendor.save();

const productResult = await productModel.updateMany(
  { vendorId: vendor._id },
  { $set: { vendorShopName: nextShopName } }
);

const orderResult = await orderModel.updateMany(
  {
    $or: [
      { "items.vendorId": vendor._id },
      { "vendors.vendorId": vendor._id },
    ],
  },
  {
    $set: {
      "items.$[item].vendorShopName": nextShopName,
      "vendors.$[vendor].vendorShopName": nextShopName,
    },
  },
  {
    arrayFilters: [
      { "item.vendorId": vendor._id },
      { "vendor.vendorId": vendor._id },
    ],
  }
);

console.log(JSON.stringify({
  vendorId: String(vendor._id),
  previousShopName,
  nextShopName,
  productsMatched: productResult.matchedCount || 0,
  productsModified: productResult.modifiedCount || 0,
  ordersMatched: orderResult.matchedCount || 0,
  ordersModified: orderResult.modifiedCount || 0,
}, null, 2));
process.exit(0);
