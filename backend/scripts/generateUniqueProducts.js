import dotenv from "dotenv";
import bcrypt from "bcrypt";
import gis from "g-i-s";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";
import categoryModel from "../models/categoryModel.js";
import userModel from "../models/userModel.js";
import { uploadImageUrlToR2 } from "../utils/r2Upload.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const VENDOR_EMAIL = process.env.AUTO_GEN_VENDOR_EMAIL || "autogen.vendor@shop.com";
const VENDOR_NAME = process.env.AUTO_GEN_VENDOR_NAME || "AI Auto Product Vendor";
const TARGET_COUNT = Number(process.env.AUTO_GEN_COUNT || process.argv[2] || 15);

const ADJECTIVES = [
  "Cao cấp",
  "Thông minh",
  "Tiện dụng",
  "Bền bỉ",
  "Nhẹ gọn",
  "Hiện đại",
  "Đa năng",
  "Chính hãng",
];

const PRODUCT_TYPES = [
  "Bộ sản phẩm",
  "Phụ kiện",
  "Thiết bị",
  "Combo",
  "Phiên bản",
  "Dòng sản phẩm",
];

const BRANDS = [
  "Nova",
  "Lumi",
  "Aster",
  "Nexa",
  "Vario",
  "Orion",
  "Elio",
  "Zenit",
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cartesian(input) {
  if (!input.length) return [[]];
  const [head, ...tail] = input;
  const rest = cartesian(tail);
  return head.flatMap((x) => rest.map((y) => [x, ...y]));
}

function buildVariants(attributes, basePrice) {
  if (!attributes.length) return { variants: [], stock: randomInt(15, 80) };
  const matrix = attributes.map((attr) => attr.values.map((value) => ({ name: attr.name, value })));
  const combos = cartesian(matrix).slice(0, 12);
  const variants = combos.map((combo, idx) => {
    const combination = {};
    combo.forEach((item) => {
      combination[item.name] = item.value;
    });
    const ratio = 1 + idx * 0.03;
    return {
      combination,
      price: Math.round((basePrice * ratio) / 1000) * 1000,
      stock: randomInt(3, 18),
    };
  });
  return { variants, stock: variants.reduce((sum, item) => sum + item.stock, 0) };
}

function buildAttributesByCategory(categoryName) {
  const c = (categoryName || "").toLowerCase();
  if (c.includes("clothe") || c.includes("fashion") || c.includes("shoe") || c.includes("bag")) {
    return [
      { name: "Kích thước", values: ["S", "M", "L", "XL"] },
      { name: "Màu sắc", values: ["Đen", "Trắng", "Xanh"] },
    ];
  }
  if (c.includes("elect") || c.includes("computer") || c.includes("mobile")) {
    return [
      { name: "Màu sắc", values: ["Đen", "Bạc", "Xanh"] },
      { name: "Phiên bản", values: ["Tiêu chuẩn", "Nâng cao"] },
    ];
  }
  return [{ name: "Loại", values: ["Tiêu chuẩn", "Cao cấp"] }];
}

function generateDescription({ name, categoryName, subCategoryName, brand, attributes }) {
  const attrText = attributes
    .map((a) => `${a.name}: ${a.values.slice(0, 3).join(", ")}`)
    .join("; ");
  const categoryText = [categoryName, subCategoryName].filter(Boolean).join(" - ");
  return `${name} từ thương hiệu ${brand} được thiết kế tối ưu cho nhu cầu sử dụng hằng ngày.${
    categoryText ? ` Sản phẩm thuộc nhóm ${categoryText}, dễ kết hợp cho nhiều tình huống khác nhau.` : ""
  } Chất lượng hoàn thiện tốt, vận hành ổn định và phù hợp nhiều tệp khách hàng. ${
    attrText ? `Các tùy chọn nổi bật gồm ${attrText}.` : ""
  }`;
}

async function getOrCreateVendor() {
  let vendor = await userModel.findOne({ email: VENDOR_EMAIL });
  if (!vendor) {
    const anyVendor = await userModel.findOne({ role: "vendor" });
    if (anyVendor) return anyVendor;
    const hashed = await bcrypt.hash("AutoVendor@123", 10);
    vendor = await userModel.create({
      name: VENDOR_NAME,
      email: VENDOR_EMAIL,
      password: hashed,
      role: "vendor",
      shopName: VENDOR_NAME,
      emailVerified: true,
    });
  }
  return vendor;
}

async function searchGoogleImageUrls(query, limit = 2) {
  const results = await new Promise((resolve, reject) => {
    gis({ searchTerm: query, queryStringAddition: "&tbm=isch" }, (error, output) => {
      if (error) return reject(error);
      resolve(Array.isArray(output) ? output : []);
    });
  });

  const urls = [];
  for (const item of results) {
    const url = item?.url || item?.thumb || item?.image;
    if (!url || typeof url !== "string") continue;
    if (!url.startsWith("http://") && !url.startsWith("https://")) continue;
    urls.push(url);
    if (urls.length >= limit) break;
  }
  return urls;
}

async function resolveImages(name, categoryName) {
  const query = `${name} ${categoryName} product`;
  let urls = [];
  try {
    urls = await searchGoogleImageUrls(query, 2);
  } catch {
    urls = [];
  }

  if (!urls.length) {
    urls = [
      `https://picsum.photos/seed/${encodeURIComponent(name)}-1/900/900`,
      `https://picsum.photos/seed/${encodeURIComponent(name)}-2/900/900`,
    ];
  }

  const uploaded = await Promise.all(urls.map((url) => uploadImageUrlToR2(url, "products/auto-generated")));
  const cleaned = uploaded.filter(Boolean).slice(0, 2);
  return cleaned.length ? cleaned : urls.slice(0, 2);
}

async function main() {
  try {
    await connectDB();
    const level1Categories = await categoryModel.find({ level: 1, isActive: true }).lean();
    if (!level1Categories.length) {
      throw new Error("Không có category level 1. Hãy seed category trước.");
    }

    const allSubCategories = await categoryModel.find({ level: 2, isActive: true }).lean();
    const subByParent = new Map();
    allSubCategories.forEach((sub) => {
      const key = String(sub.parentCategory);
      if (!subByParent.has(key)) subByParent.set(key, []);
      subByParent.get(key).push(sub);
    });

    const vendor = await getOrCreateVendor();
    const existingNames = new Set(
      (await productModel.find({}, { name: 1 }).lean()).map((p) => normalizeName(p.name))
    );

    let created = 0;
    let attempts = 0;
    const maxAttempts = TARGET_COUNT * 20;
    const insertedDocs = [];

    while (created < TARGET_COUNT && attempts < maxAttempts) {
      attempts += 1;
      const category = pick(level1Categories);
      const subList = subByParent.get(String(category._id)) || [];
      const subCategory = subList.length ? pick(subList) : null;
      const brand = pick(BRANDS);
      const name = `${pick(ADJECTIVES)} ${pick(PRODUCT_TYPES)} ${category.name} ${brand} ${randomInt(100, 9999)}`.replace(
        /\s+/g,
        " "
      );
      const normalized = normalizeName(name);
      if (existingNames.has(normalized)) continue;

      const attributes = buildAttributesByCategory(category.name);
      const basePrice = randomInt(99, 1499) * 1000;
      const { variants, stock } = buildVariants(attributes, basePrice);
      const image = await resolveImages(name, category.name);
      const sold = randomInt(0, 400);
      const rating = Number((Math.random() * 1.5 + 3.5).toFixed(1));
      const reviewCount = randomInt(0, 120);
      const description = generateDescription({
        name,
        categoryName: category.name,
        subCategoryName: subCategory?.name || "",
        brand,
        attributes,
      });

      insertedDocs.push({
        name,
        description,
        price: variants.length ? Math.min(...variants.map((v) => v.price)) : basePrice,
        originalPrice: Math.round(basePrice * 1.15),
        discount: 10,
        image,
        category: category._id,
        subCategory: subCategory?._id,
        bestseller: sold > 300,
        date: Date.now(),
        sold,
        vendorId: vendor._id,
        vendorShopName: vendor.shopName || vendor.name,
        stock,
        rating,
        reviewCount,
        brand,
        tags: ["source:auto-generated", `auto-gen:${Date.now()}`],
        attributes,
        variants,
        sizes: [],
        isActive: true,
      });

      existingNames.add(normalized);
      created += 1;
      console.log(`✅ [${created}/${TARGET_COUNT}] ${name}`);
    }

    if (!insertedDocs.length) {
      throw new Error("Không tạo được sản phẩm mới (có thể do trùng tên quá nhiều).");
    }

    await productModel.insertMany(insertedDocs);
    console.log(`\n🎉 Hoàn tất: tạo ${insertedDocs.length} sản phẩm mới, không trùng tên.`);
    console.log("ℹ Có thể chỉnh số lượng bằng: AUTO_GEN_COUNT=30 node scripts/generateUniqueProducts.js");
    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi tạo sản phẩm:", error.message);
    process.exit(1);
  }
}

main();
