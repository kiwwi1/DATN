import dotenv from "dotenv";
import { join } from "path";
import connectDB from "../config/mongodb.js";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import orderModel from "../models/orderModel.js";

dotenv.config({ path: join(process.cwd(), ".env") });
await connectDB();

const vendor = await userModel.findOne({ email: "hieu@gmail.com" }).select("_id email shopName shopNameNormalized").lean();
const products = vendor ? await productModel.countDocuments({ vendorId: vendor._id, vendorShopName: "hieu shop" }) : 0;
const orders = vendor ? await orderModel.countDocuments({ $or: [ { "items.vendorShopName": "hieu shop", "items.vendorId": vendor._id }, { "vendors.vendorShopName": "hieu shop", "vendors.vendorId": vendor._id } ] }) : 0;
console.log(JSON.stringify({ vendor, productsWithNewShopName: products, ordersWithNewShopName: orders }, null, 2));
process.exit(0);
