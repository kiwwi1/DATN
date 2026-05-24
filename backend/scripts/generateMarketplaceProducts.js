import mongoose from "mongoose";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import bcrypt from "bcrypt";

import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";
import categoryModel from "../models/categoryModel.js";
import userModel from "../models/userModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
dotenv.config({ path: join(ROOT_DIR, ".env") });

const DEFAULT_COUNT = 200;
const FORCED_VENDOR_EMAIL = "vendor.apple@shop.com";

const VENDORS = [
    { name: "Daily Choice Mall", email: "vendor.dailychoice@shop.com", shopName: "Daily Choice Mall" },
    { name: "Urban House Official", email: "vendor.urbanhouse@shop.com", shopName: "Urban House Official" },
    { name: "Tech Plus Store", email: "vendor.techplus@shop.com", shopName: "Tech Plus Store" },
    { name: "Beauty Lab Vietnam", email: "vendor.beautylab@shop.com", shopName: "Beauty Lab Vietnam" },
    { name: "Sports Corner Hub", email: "vendor.sportcorner@shop.com", shopName: "Sports Corner Hub" },
];

const BRAND_POOL = [
    "Apple", "Samsung", "Xiaomi", "OPPO", "vivo", "ASUS", "Acer", "Dell", "HP", "Lenovo",
    "Sony", "JBL", "Anker", "Logitech", "Nike", "Adidas", "Uniqlo", "H&M", "L'Oreal", "Maybelline",
    "Innisfree", "La Roche-Posay", "LocknLock", "Philips", "Panasonic",
];

const REAL_PRODUCT_NAMES = {
    smartphone: [
        "iPhone 15 128GB",
        "Samsung Galaxy A55 5G 128GB",
        "Xiaomi Redmi Note 13 Pro 256GB",
        "OPPO Reno11 F 5G 256GB",
        "vivo V30e 5G 256GB",
    ],
    laptop: [
        "MacBook Air M2 13 inch 256GB",
        "Dell Inspiron 15 3530 i5",
        "ASUS Vivobook 15 OLED A1505",
        "Lenovo IdeaPad Slim 5 14 inch",
        "HP Pavilion 14 i5",
    ],
    headphones: [
        "AirPods Pro 2 USB-C",
        "Sony WH-CH720N",
        "JBL Tune 770NC",
        "Anker Soundcore R50i",
        "Samsung Galaxy Buds FE",
    ],
    shoes: [
        "Nike Air Force 1 '07",
        "Adidas Samba OG",
        "Puma Smash v2",
        "Converse Chuck Taylor All Star",
        "Vans Old Skool Classic",
    ],
    beauty: [
        "La Roche-Posay Effaclar Duo+ 40ml",
        "L'Oreal Revitalift Hyaluronic Serum 30ml",
        "Maybelline Sky High Mascara",
        "Innisfree Green Tea Seed Serum",
        "Bioderma Sensibio H2O 500ml",
    ],
    fashion: [
        "Uniqlo AIRism Cotton T-Shirt",
        "Levi's 511 Slim Jeans",
        "Routine Linen Shirt",
        "H&M Regular Fit Hoodie",
        "YODY Polo Basic",
    ],
    home: [
        "LocknLock Easy Match Food Container Set",
        "Philips Air Fryer HD9200",
        "Panasonic Electric Kettle NC-K301",
        "Sunhouse Rice Cooker SHD8602",
        "Xiaomi Smart Standing Fan 2 Lite",
    ],
};

const DESC_OPENERS = [
    "San pham duoc nhieu nguoi dung danh gia cao.",
    "Thiet ke toi uu cho nhu cau su dung hang ngay.",
    "Chat lieu tot, do ben cao, de ket hop.",
    "Mau sac hien dai, phu hop nhieu phong cach.",
    "Dong goi gon gang, tien loi khi bao quan va van chuyen.",
];

const IMAGE_IDS = [
    "1511707171634-5f897ff02aa9",
    "1523275335684-37898b6baf30",
    "1503341504253-dff4815485f1",
    "1542291026-7eec264c27ff",
    "1556228578-8c89e6adf883",
    "1556909211-36987daf7b4d",
    "1603344204980-4edb0ea63148",
    "1596783366167-67e1e9d1c182",
    "1548036161-18ad4197a42b",
    "1614252369475-531eba835eb1",
    "1515562141207-7a88fb7ce338",
    "1502920917128-1aa500764bee",
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const jitter = (n, pct = 0.08) => Math.max(1000, Math.round(n * (1 + (Math.random() * 2 - 1) * pct) / 1000) * 1000);

const PRICE_MULTIPLIERS = {
    XS: 0.95, S: 1.0, M: 1.05, L: 1.1, XL: 1.15, XXL: 1.2,
    "64GB": 1.0, "128GB": 1.15, "256GB": 1.35, "512GB": 1.65, "1TB": 2.0,
    "30ml": 1.0, "50ml": 1.35, "100ml": 1.85,
};

const cartesian = (arrays) => {
    if (!arrays.length) return [[]];
    const [first, ...rest] = arrays;
    const restProduct = cartesian(rest);
    return first.flatMap((value) => restProduct.map((combination) => [value, ...combination]));
};

const buildVariants = (attributes, basePrice) => {
    if (!attributes?.length) return [];
    const validAttrs = attributes.filter((attr) => Array.isArray(attr.values) && attr.values.length > 0);
    if (!validAttrs.length) return [];

    const values = validAttrs.map((attr) => attr.values.map((v) => ({ name: attr.name, value: v })));
    return cartesian(values).map((combo) => {
        const combination = {};
        let mult = 1;
        combo.forEach(({ name, value }) => {
            combination[name] = value;
            mult = Math.max(mult, PRICE_MULTIPLIERS[value] || 1);
        });
        return {
            combination,
            price: Math.round((basePrice * mult) / 1000) * 1000,
            stock: randInt(5, 50),
        };
    });
};

const toImageUrl = (id) => `https://picsum.photos/seed/market-${encodeURIComponent(id)}/800/800`;

const resolveNameBucket = (template) => {
    const source = `${template.categoryName || ""} ${template.subCategoryName || ""} ${template.name || ""}`.toLowerCase();
    if (/(dien thoai|phone|smartphone)/.test(source)) return "smartphone";
    if (/(laptop|may tinh)/.test(source)) return "laptop";
    if (/(tai nghe|headphone|earbud)/.test(source)) return "headphones";
    if (/(giay|sneaker|sandal|heels|shoes)/.test(source)) return "shoes";
    if (/(my pham|beauty|skin|serum|lip|makeup)/.test(source)) return "beauty";
    if (/(ao|quan|vay|thoi trang|fashion|shirt|jean|hoodie)/.test(source)) return "fashion";
    if (/(nha cua|home|kitchen|gia dung|decor)/.test(source)) return "home";
    return null;
};

const makeProductName = (template) => {
    const bucket = resolveNameBucket(template);
    if (bucket && REAL_PRODUCT_NAMES[bucket]?.length) return pick(REAL_PRODUCT_NAMES[bucket]);
    const cleanBase = String(template.name || "San pham")
        .replace(/\s+/g, " ")
        .trim();
    return cleanBase;
};

const makeDescription = (template) => {
    const bullets = [
        `- Thuong hieu: ${template.brand || pick(BRAND_POOL)}`,
        `- Phan loai: ${template.subCategoryName || template.categoryName || "Tong hop"}`,
        `- Cam ket: kiem tra hang truoc khi dong goi`,
    ];
    return `${pick(DESC_OPENERS)}\n${bullets.join("\n")}`;
};

const ensureVendors = async () => {
    const existingVendors = await userModel.find({ role: "vendor" }).select("_id shopName").lean();
    if (existingVendors.length >= 3) return existingVendors;

    const created = [];
    for (const v of VENDORS) {
        let user = await userModel.findOne({ email: v.email });
        if (!user) {
            const hashed = await bcrypt.hash("Vendor@123", 10);
            user = await userModel.create({
                name: v.name,
                email: v.email,
                password: hashed,
                role: "vendor",
                shopName: v.shopName,
                emailVerified: true,
            });
        }
        created.push({ _id: user._id, shopName: user.shopName || v.shopName });
    }
    return created;
};

const ensureForcedVendor = async () => {
    let vendor = await userModel.findOne({ email: FORCED_VENDOR_EMAIL }).select("_id shopName name").lean();
    if (vendor) {
        return { _id: vendor._id, shopName: vendor.shopName || vendor.name || "Apple Official Store" };
    }

    const hashed = await bcrypt.hash("Vendor@123", 10);
    const created = await userModel.create({
        name: "Apple Official Store",
        email: FORCED_VENDOR_EMAIL,
        password: hashed,
        role: "vendor",
        shopName: "Apple Official Store",
        emailVerified: true,
    });
    return { _id: created._id, shopName: created.shopName };
};

const generateProducts = async (count) => {
    await connectDB();

    const rawData = JSON.parse(readFileSync(join(ROOT_DIR, "data", "productData.json"), "utf-8"));
    if (!rawData.length) {
        throw new Error("No template data found in backend/data/productData.json");
    }

    const categories = await categoryModel.find({}).lean();
    if (!categories.length) {
        throw new Error("No categories found. Run `npm run seed-categories` first.");
    }
    const catByName = {};
    categories.forEach((cat) => {
        catByName[cat.name] = cat;
    });

    await ensureVendors();
    const forcedVendor = await ensureForcedVendor();
    const docs = [];
    const now = Date.now();

    for (let i = 0; i < count; i += 1) {
        const tpl = pick(rawData);
        const mainCat = catByName[tpl.categoryName];
        if (!mainCat) continue;
        const subCat = catByName[tpl.subCategoryName] || null;
        const subSubCat = catByName[tpl.subSubCategoryName] || null;
        const priceBase = typeof tpl.price === "number" ? tpl.price : randInt(49000, 899000);
        const price = jitter(priceBase, 0.12);
        const discount = randInt(0, 35);
        const originalPrice = discount > 0 ? Math.round((price / (1 - discount / 100)) / 1000) * 1000 : undefined;

        const variants = buildVariants(tpl.attributes || [], price);
        const stock = variants.length
            ? variants.reduce((sum, v) => sum + v.stock, 0)
            : randInt(10, 200);

        const sold = randInt(0, 4000);
        const rating = Math.min(5, Math.max(3.8, 4 + Math.random() * 0.9));
        const reviewCount = sold > 0 ? randInt(5, Math.max(20, Math.floor(sold * 0.4))) : randInt(0, 30);

        docs.push({
            name: makeProductName(tpl),
            description: makeDescription(tpl),
            price,
            image: [toImageUrl(pick(IMAGE_IDS)), toImageUrl(pick(IMAGE_IDS)), toImageUrl(pick(IMAGE_IDS))],
            category: mainCat._id,
            subCategory: subCat?._id,
            subSubCategory: subSubCat?._id,
            bestseller: sold > 2000,
            date: now - randInt(1, 200) * 24 * 60 * 60 * 1000,
            sold,
            vendorId: forcedVendor._id,
            vendorShopName: forcedVendor.shopName,
            stock,
            rating: Number(rating.toFixed(1)),
            reviewCount,
            brand: tpl.brand || pick(BRAND_POOL),
            tags: Array.isArray(tpl.tags) ? [...new Set([...tpl.tags, "marketplace", "hot-deal"])].slice(0, 8) : ["marketplace"],
            attributes: tpl.attributes || [],
            variants,
            sizes: Array.isArray(tpl.sizes) ? tpl.sizes : [],
            discount,
            originalPrice,
            isActive: true,
        });
    }

    if (!docs.length) {
        throw new Error("No product generated. Please verify template categories.");
    }

    const result = await productModel.insertMany(docs);
    return result.length;
};

const main = async () => {
    try {
        const argCount = Number(process.argv[2]);
        const count = Number.isFinite(argCount) && argCount > 0 ? Math.floor(argCount) : DEFAULT_COUNT;
        const inserted = await generateProducts(count);
        console.log(`Generated ${inserted} marketplace-like products.`);
        console.log("Done.");
        process.exit(0);
    } catch (error) {
        console.error("Generate products failed:", error.message);
        process.exit(1);
    }
};

main();
