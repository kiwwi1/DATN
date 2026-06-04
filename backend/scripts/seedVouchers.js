import mongoose from "mongoose";
import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/mongodb.js";
import userModel from "../models/userModel.js";
import voucherModel from "../models/voucherModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const seed = async () => {
  await connectDB();

  const now = Date.now();
  const startAt = now - 24 * 60 * 60 * 1000;
  const endAt = now + 30 * 24 * 60 * 60 * 1000;
  const vendor = await userModel.findOne({ role: "vendor" }).select("_id");

  const vouchers = [
    {
      code: "SALE20",
      type: "PLATFORM",
      discountType: "FIXED",
      discountValue: 20000,
      minOrderValue: 300000,
      usageLimit: 0,
      startAt,
      endAt,
      isActive: true,
      description: "Giam 20.000 cho don tu 300.000",
    },
    {
      code: "FREESHIP",
      type: "SHIPPING",
      discountType: "FIXED",
      discountValue: 25000,
      minOrderValue: 0,
      usageLimit: 0,
      startAt,
      endAt,
      isActive: true,
      description: "Giam phi ship toi da 25.000",
    },
  ];

  if (vendor?._id) {
    vouchers.push({
      code: "SHOP10",
      type: "SHOP",
      discountType: "PERCENT",
      discountValue: 10,
      maxDiscount: 30000,
      minOrderValue: 100000,
      vendorId: vendor._id,
      usageLimit: 0,
      startAt,
      endAt,
      isActive: true,
      description: "Giam 10% cho shop (toi da 30.000)",
    });
  }

  for (const voucher of vouchers) {
    await voucherModel.updateOne({ code: voucher.code }, { $set: voucher }, { upsert: true });
  }

  console.log(`Seeded ${vouchers.length} vouchers`);
  await mongoose.disconnect();
};

seed().catch(async (error) => {
  console.error("Seed vouchers failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
