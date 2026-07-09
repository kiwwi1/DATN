import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import connectDB from "../config/mongodb.js";
import userModel from "../models/userModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const normalizeShopName = (value) =>
    String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("vi-VN");

const DEFAULT_TARGETS = [
    "Shop Công Nghệ 24/7",
    "Shop Điện Thoại ABC",
    "123",
    "huy shop1",
    "Gian Hàng Việt Nam",
];

const nextPassword = process.argv[2];

if (!nextPassword) {
    console.error("Usage: node scripts/resetVendorPasswordsByShop.js <newPassword>");
    process.exit(1);
}

try {
    await connectDB();

    const vendors = await userModel
        .find({ role: "vendor" })
        .select("_id shopName email")
        .lean();

    const targetMap = new Map(DEFAULT_TARGETS.map((shopName) => [normalizeShopName(shopName), shopName]));
    const matched = vendors.filter((vendor) => targetMap.has(normalizeShopName(vendor.shopName)));
    const missing = DEFAULT_TARGETS.filter((shopName) =>
        !matched.some((vendor) => normalizeShopName(vendor.shopName) === normalizeShopName(shopName))
    );

    if (!matched.length) {
        console.log(JSON.stringify({ updated: [], missing }, null, 2));
        process.exit(0);
    }

    const passwordHash = await bcrypt.hash(nextPassword, 10);

    for (const vendor of matched) {
        await userModel.updateOne(
            { _id: vendor._id },
            {
                $set: {
                    password: passwordHash,
                    emailVerified: true,
                },
                $unset: {
                    passwordResetToken: "",
                    passwordResetExpires: "",
                    emailVerificationToken: "",
                    emailVerificationExpires: "",
                },
            }
        );
    }

    console.log(
        JSON.stringify(
            {
                updated: matched.map((vendor) => ({
                    shopName: vendor.shopName,
                    email: vendor.email,
                })),
                missing,
            },
            null,
            2
        )
    );
    process.exit(0);
} catch (error) {
    console.error(error);
    process.exit(1);
}
