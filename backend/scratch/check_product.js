import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
dotenv.config({ path: join(ROOT_DIR, ".env") });

const main = async () => {
    try {
        await connectDB();
        const product = await productModel.findOne({ name: /Apple Watch Series 4/i });
        if (product) {
            console.log("Product found:", product.name);
            console.log("Tags:", product.tags);
        } else {
            console.log("Product 'Apple Watch Series 4' not found in database.");
        }
        process.exit(0);
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
};

main();
