import dotenv from "dotenv";
import { join } from "path";
import mongoose from "mongoose";
import connectDB from "../config/mongodb.js";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";

dotenv.config({ path: join(process.cwd(), ".env") });
await connectDB();

const vendorIds = [
  "693faff6d9aadce2a77751ac",
  "693faff7d9aadce2a77751b5",
  "6a44f3eade29f9392d532551",
  "68f9b69d1d0edd93713b6754",
  "69aff75ae400ac5e00430cd5",
  "68a04f71b97bc1ae6a62b96a",
].map((id) => new mongoose.Types.ObjectId(id));

const vendors = await userModel.find({ _id: { $in: vendorIds } }).select("_id shopName email").lean();
const rows = [];
for (const v of vendors) {
  const clonedProducts = await productModel.countDocuments({
    vendorId: v._id,
    tags: { $regex: "^cloned-source-vendor:" },
  });
  const totalProducts = await productModel.countDocuments({ vendorId: v._id });
  rows.push({ shopName: v.shopName, email: v.email, clonedProducts, totalProducts });
}

console.log(JSON.stringify(rows, null, 2));
process.exit(0);
