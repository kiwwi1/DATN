import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
dotenv.config({ path: join(ROOT_DIR, ".env") });

const normalizeText = (text = '') =>
    String(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .trim();

const STOP_WORDS = new Set([
    "va", "cho", "cua", "co", "la", "de", "chinh", "hang", "cao", "cap", 
    "nam", "nu", "gia", "re", "dep", "tot", "hieu", "loai", "mot", "hai",
    "ba", "bon", "nam", "sau", "bay", "tam", "chin", "muoi", "cai", "con",
    "nhung", "cac", "nay", "kia", "do", "day", "trend", "hot", "moi", "chinh hang"
]);

const generateTagsFromName = (name = '', existingTags = []) => {
    const tags = new Set(existingTags.map(t => String(t).toLowerCase().trim()));
    const normalizedName = normalizeText(name);
    
    // 1. Keyword mapping for categories/types
    const mappings = [
        { keywords: ["son", "lipstick", "lip"], tags: ["son", "my pham", "lam dep"] },
        { keywords: ["kem duong", "kem duong da", "kem chong nang", "sua rua mat", "toner", "serum", "tay trang", "duong am"], tags: ["skincare", "my pham", "lam dep"] },
        { keywords: ["nuoc hoa", "perfume"], tags: ["nuoc hoa", "my pham", "thom tho"] },
        { keywords: ["phan", "cushion", "che khuyet diem", "kem nen", "mascara", "ke mat", "ma hong", "makeup"], tags: ["makeup", "my pham", "lam dep"] },
        { keywords: ["my pham", "my pham nam", "my pham nu"], tags: ["my pham", "lam dep"] },
        
        { keywords: ["dien thoai", "phone", "iphone", "samsung", "xiaomi", "oppo", "nokia", "vivo", "realme"], tags: ["dien thoai", "cong nghe", "smart phone"] },
        { keywords: ["laptop", "macbook", "pc", "dell", "asus", "acer", "hp", "lenovo"], tags: ["laptop", "may tinh", "cong nghe"] },
        { keywords: ["tai nghe", "headphone", "earphone", "airpods"], tags: ["tai nghe", "am thanh", "phu kien"] },
        { keywords: ["loa", "speaker"], tags: ["loa", "am thanh", "phu kien"] },
        { keywords: ["chuot", "mouse", "ban phim", "keyboard", "man hinh", "monitor"], tags: ["phu kien may tinh", "cong nghe"] },
        
        { keywords: ["ao thun", "ao phong", "t-shirt", "polo", "ao so mi", "ao khoac", "bomber", "jacket"], tags: ["ao nam", "ao nu", "thoi trang", "quan ao"] },
        { keywords: ["quan jean", "quan tay", "quan short", "jeans"], tags: ["quan nam", "quan nu", "thoi trang", "quan ao"] },
        { keywords: ["giay", "shoes", "sneaker", "sandal"], tags: ["giay dep", "thoi trang"] },
        { keywords: ["tui xach", "bag", "balo", "backpack"], tags: ["tui xach", "phu kien"] },
        { keywords: ["dong ho", "watch"], tags: ["dong ho", "phu kien"] }
    ];

    for (const mapping of mappings) {
        if (mapping.keywords.some(kw => normalizedName.includes(kw))) {
            mapping.tags.forEach(t => tags.add(t));
        }
    }

    // 2. Tokenize and filter out short and common words
    const words = normalizedName.split(/[^a-z0-9]/).filter(Boolean);
    for (const word of words) {
        if (word.length >= 3 && !STOP_WORDS.has(word) && isNaN(Number(word))) {
            tags.add(word);
        }
    }

    return Array.from(tags).filter(Boolean);
};

const main = async () => {
    try {
        await connectDB();
        
        const products = await productModel.find();
        console.log(`Found ${products.length} products to process.`);
        
        let updatedCount = 0;
        for (const product of products) {
            const currentTags = product.tags || [];
            const newTags = generateTagsFromName(product.name, currentTags);
            
            // Check if tags changed
            const currentSorted = [...currentTags].map(t => String(t).trim().toLowerCase()).sort().join(",");
            const newSorted = [...newTags].sort().join(",");
            
            if (currentSorted !== newSorted) {
                product.tags = newTags;
                await product.save();
                updatedCount++;
                console.log(`[${updatedCount}] Updated product: "${product.name}" -> Tags: [${newTags.join(", ")}]`);
            }
        }
        
        console.log(`Successfully updated tags for ${updatedCount} / ${products.length} products.`);
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error.message);
        process.exit(1);
    }
};

main();
