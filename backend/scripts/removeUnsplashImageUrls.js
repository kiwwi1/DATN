import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
dotenv.config({ path: join(ROOT_DIR, ".env") });

const isUnsplashUrl = (value) =>
    typeof value === "string" && value.toLowerCase().includes("images.unsplash.com");

const toFallback = (productId, index) =>
    `https://picsum.photos/seed/${productId}-img-${index + 1}/800/800`;

const main = async () => {
    try {
        await connectDB();
        const docs = await productModel
            .find({ image: { $elemMatch: { $regex: "images\\.unsplash\\.com", $options: "i" } } })
            .select("_id image");

        let modified = 0;
        for (const doc of docs) {
            const original = Array.isArray(doc.image) ? doc.image : [];
            const replaced = original.map((url, idx) => (isUnsplashUrl(url) ? toFallback(doc._id, idx) : url));
            if (JSON.stringify(replaced) !== JSON.stringify(original)) {
                doc.image = replaced;
                await doc.save();
                modified += 1;
            }
        }

        console.log(`Updated ${modified} product(s).`);
        process.exit(0);
    } catch (error) {
        console.error("Remove unsplash URLs failed:", error.message);
        process.exit(1);
    }
};

main();
