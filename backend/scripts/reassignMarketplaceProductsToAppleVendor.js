import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import connectDB from "../config/mongodb.js";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
dotenv.config({ path: join(ROOT_DIR, ".env") });

const main = async () => {
    try {
        await connectDB();
        const vendor = await userModel.findOne({ email: "vendor.apple@shop.com" });
        if (!vendor) {
            throw new Error("vendor.apple@shop.com not found");
        }

        const shopName = vendor.shopName || vendor.name || "Apple Official Store";
        const result = await productModel.updateMany(
            { tags: "marketplace" },
            { $set: { vendorId: vendor._id, vendorShopName: shopName } }
        );

        console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}, Shop: ${shopName}`);
        process.exit(0);
    } catch (error) {
        console.error("Reassign failed:", error.message);
        process.exit(1);
    }
};

main();
