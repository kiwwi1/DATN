/**
 * Import sản phẩm từ:
 * - https://fakestoreapiserver.reactbd.org/api/products
 * - https://dummyjson.com/products
 *
 * Giữ cấu trúc productModel; ảnh lưu URL gốc từ API (không upload R2).
 *
 * Chạy (cần file backend/.env có MONGODB_URI):
 *   npm run import-external-products
 *   npm run reimport-fakestore — gỡ trùng tên + xóa Fakestore cũ + import lại API
 *   hoặc: node scripts/importExternalProducts.js (từ thư mục backend)
 *   Script tự load backend/.env dù bạn chạy từ backend hay backend/scripts.
 *
 * Tuỳ chọn môi trường:
 *   IMPORT_MAX_IMAGES_PER_PRODUCT=3 — giới hạn số ảnh/sản phẩm (mặc định 5).
 *   IMPORT_VENDOR_EMAIL / IMPORT_VENDOR_SHOP — vendor gán cho sản phẩm import.
 *
 * Cần đã seed category (npm run seed-categories). Category tra theo `name` (VN) hoặc
 * `description` (English) như trong seedCategories.
 */

import dotenv from "dotenv";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";
import categoryModel from "../models/categoryModel.js";
import userModel from "../models/userModel.js";
import bcrypt from "bcrypt";

const __importFile = fileURLToPath(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const VENDOR_EMAIL = process.env.IMPORT_VENDOR_EMAIL || "import@external.local";
const VENDOR_SHOP = process.env.IMPORT_VENDOR_SHOP || "External API Import";
const FX_USD_TO_VND = Number(process.env.IMPORT_USD_TO_VND_RATE) || 25500;

/** Map slug DummyJSON → tên category level-1 trong DB (seedCategories) */
const DUMMYJSON_CAT_TO_DB = {
  smartphones: "Mobile & Gadgets",
  laptops: "Computer & Accessories",
  tablets: "Mobile & Gadgets",
  "mobile-accessories": "Mobile & Gadgets",
  beauty: "Beauty & Personal Care",
  fragrances: "Beauty & Personal Care",
  "skin-care": "Beauty & Personal Care",
  furniture: "Home & Living",
  "home-decoration": "Home & Living",
  groceries: "Grocery",
  "kitchen-accessories": "Home & Living",
  "mens-shirts": "Men Clothes",
  "mens-shoes": "Men Shoes",
  "mens-watches": "Watches",
  "womens-dresses": "Women Clothes",
  "womens-shoes": "Women Shoes",
  "womens-watches": "Watches",
  "womens-bags": "Women Bags",
  "womens-jewellery": "Fashion Accessories",
  tops: "Women Clothes",
  sunglasses: "Fashion Accessories",
  vehicle: "Automotive",
  motorcycle: "Automotive",
  "sports-accessories": "Sport & Outdoor",
  smartphones_accessories: "Mobile & Gadgets",
  lighting: "Home & Living",
  motorcycle_accessories: "Automotive",
  phone_accessories: "Mobile & Gadgets",
  watches: "Watches",
  dresses: "Women Clothes",
  "office-accessories": "Computer & Accessories",
};

const DEFAULT_DUMMY_CAT = "Consumer Electronics";

/** fakestore: women | men | kids */
const FAKESTORE_GENDER_CAT = {
  women: "Women Clothes",
  men: "Men Clothes",
  kids: "Kid Fashion",
};

async function getOrCreateVendor() {
  let user = await userModel.findOne({ email: VENDOR_EMAIL });
  if (!user) {
    const anyVendor = await userModel.findOne({ role: "vendor" }).sort({ createdAt: 1 });
    if (anyVendor) {
      console.log(`📌 Dùng vendor có sẵn: ${anyVendor.email} (${anyVendor.shopName || ""})`);
      return anyVendor;
    }
    const hashed = await bcrypt.hash("ImportVendor@123", 10);
    user = await userModel.create({
      name: VENDOR_SHOP,
      email: VENDOR_EMAIL,
      password: hashed,
      role: "vendor",
      shopName: VENDOR_SHOP,
    });
    console.log(`👤 Đã tạo vendor import: ${VENDOR_EMAIL} / ImportVendor@123`);
  }
  return user;
}

async function loadCategoryMap() {
  /** seedCategories lưu name = tiếng Việt, description = tên English gốc */
  const cats = await categoryModel.find({ level: 1 }).lean();
  const byName = new Map();
  for (const c of cats) {
    byName.set(c.name, c);
    if (c.description && typeof c.description === "string") {
      byName.set(c.description.trim(), c);
    }
  }
  return byName;
}

function resolveCategoryId(map, dbName, label) {
  const cat = map.get(dbName);
  if (!cat) {
    console.warn(`⚠️ Không tìm thấy category "${dbName}" (${label}) — bỏ qua`);
    return null;
  }
  return cat._id;
}

function mapDummySlug(slug) {
  const key = String(slug || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
  return DUMMYJSON_CAT_TO_DB[key] || DEFAULT_DUMMY_CAT;
}

function buildSizeVariants(sizes, unitPrice, totalStock) {
  const list = Array.isArray(sizes) ? sizes.map((s) => String(s)) : [];
  if (!list.length) {
    return {
      attributes: [],
      variants: [],
      stock: Math.max(0, Number(totalStock) || 0),
    };
  }
  const per = Math.max(1, Math.floor((Number(totalStock) || list.length * 10) / list.length));
  const variants = list.map((size) => ({
    combination: { Size: size },
    price: Math.round(Number(unitPrice) * 100) / 100,
    stock: per,
  }));
  return {
    attributes: [{ name: "Size", values: list }],
    variants,
    stock: variants.reduce((s, v) => s + v.stock, 0),
  };
}

function toVndPrice(value) {
  const n = Number(value) || 0;
  // Giá import từ external API chủ yếu là USD, quy đổi sang VND để hiển thị thực tế hơn.
  const vnd = n * FX_USD_TO_VND;
  return Math.max(1000, Math.round(vnd / 1000) * 1000);
}

function normalizeProductName(name, brand) {
  const rawName = String(name || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const rawBrand = String(brand || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!rawName && !rawBrand) return "Sản phẩm";
  if (!rawBrand) return rawName || "Sản phẩm";
  if (!rawName) return rawBrand;

  const nameLower = rawName.toLowerCase();
  const brandLower = rawBrand.toLowerCase();
  if (nameLower.startsWith(brandLower)) return rawName;
  return `${rawBrand} ${rawName}`;
}

function pickImageUrls(urls) {
  const maxImages = Number(process.env.IMPORT_MAX_IMAGES_PER_PRODUCT) || 5;
  const unique = [...new Set(urls.filter(Boolean))].slice(0, maxImages);
  if (!unique.length) {
    return ["https://placehold.co/600x600?text=No+image"];
  }
  return unique;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; DATN-import/1.0)" },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

const FAKESTORE_API_BASE =
  "https://fakestoreapiserver.reactbd.org/api/products";

/** Tất cả sản phẩm Fakestore (phân trang theo totalPages). */
export async function fetchAllFakestoreProducts() {
  const all = [];
  let page = 1;
  let totalPages = 1;
  do {
    const url = `${FAKESTORE_API_BASE}?page=${page}&perPage=30`;
    const j = await fetchJson(url);
    totalPages = Math.max(1, Number(j.totalPages) || 1);
    const batch = j.data || [];
    all.push(...batch);
    page++;
  } while (page <= totalPages);
  return all;
}

/**
 * Mỗi `name` chỉ giữ một document (ObjectId nhỏ nhất), xóa các bản còn lại.
 * Chạy trước khi import lại Fakestore để tránh trùng tên với dữ liệu cũ.
 */
export async function removeDuplicateProductsByName() {
  const dupes = await productModel.aggregate([
    { $match: { name: { $exists: true, $type: "string", $ne: "" } } },
    {
      $group: {
        _id: "$name",
        ids: { $push: "$_id" },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  let deleted = 0;
  for (const g of dupes) {
    const sorted = [...g.ids].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
    const [, ...removeIds] = sorted;
    if (removeIds.length) {
      const r = await productModel.deleteMany({ _id: { $in: removeIds } });
      deleted += r.deletedCount || 0;
    }
  }
  console.log(
    `🧹 Trùng tên: đã xóa ${deleted} bản ghi (${dupes.length} tên trùng)`
  );
  return { duplicateNames: dupes.length, deleted };
}

/** Xóa toàn bộ sản phẩm được import từ Fakestore (tag nguồn). */
export async function deleteFakestoreImportedProducts() {
  const r = await productModel.deleteMany({
    $or: [
      { tags: "source:fakestore" },
      { tags: { $regex: /^import:fakestore:/ } },
    ],
  });
  console.log(`🗑️  Đã xóa ${r.deletedCount || 0} sản phẩm import Fakestore cũ`);
  return r.deletedCount || 0;
}

async function importFakestore(catMap, vendor) {
  const rows = await fetchAllFakestoreProducts();
  let added = 0;
  let skipped = 0;

  for (const p of rows) {
    const tag = `import:fakestore:${p._id}`;
    const exists = await productModel.findOne({ tags: tag });
    if (exists) {
      skipped++;
      continue;
    }

    const dbCatName =
      FAKESTORE_GENDER_CAT[String(p.category || "").toLowerCase()] || "Women Clothes";
    const categoryId = resolveCategoryId(catMap, dbCatName, `fakestore ${p.title}`);
    if (!categoryId) {
      skipped++;
      continue;
    }

    const price = toVndPrice(p.price);
    const oldP = p.oldPrice != null ? toVndPrice(p.oldPrice) : null;
    const disc =
      oldP && oldP > price ? Math.round(((oldP - price) / oldP) * 100) : 0;

    const unitPrice =
      p.discountedPrice != null ? toVndPrice(p.discountedPrice) : price;
    const { attributes, variants, stock } = buildSizeVariants(
      p.size,
      unitPrice,
      p.stock
    );

    const imageUrls = [p.image].filter(Boolean);
    const image = pickImageUrls(imageUrls);

    await productModel.create({
      name: normalizeProductName(p.title, p.brand).slice(0, 200),
      description: String(p.description || "").slice(0, 8000),
      price,
      originalPrice: oldP && oldP > price ? oldP : undefined,
      discount: disc,
      image,
      category: categoryId,
      bestseller: !!p.isNew,
      date: Date.now(),
      sold: 0,
      vendorId: vendor._id,
      vendorShopName: vendor.shopName || VENDOR_SHOP,
      stock,
      rating: Math.min(5, Math.max(0, Number(p.rating) || 0)),
      reviewCount: 0,
      brand: String(p.brand || ""),
      tags: [tag, "source:fakestore"],
      attributes,
      variants,
      sizes: p.size || [],
      isActive: true,
    });
    added++;
  }
  console.log(`✅ Fakestore: thêm ${added}, bỏ qua (trùng/thiếu cat): ${skipped}`);
}

/**
 * Gỡ trùng tên → xóa bản Fakestore cũ → import lại toàn bộ từ API.
 * Chạy: npm run reimport-fakestore
 */
export async function reimportFakestoreProducts() {
  await connectDB();
  const catMap = await loadCategoryMap();
  if (!catMap.size) {
    console.error("❌ Chưa có category level-1. Chạy: npm run seed-categories");
    process.exit(1);
  }
  const vendor = await getOrCreateVendor();

  await removeDuplicateProductsByName();
  await deleteFakestoreImportedProducts();
  console.log("⬇️  Đang tải lại Fakestore API (tất cả trang)…");
  await importFakestore(catMap, vendor);
  console.log("🎉 Hoàn tất reimport Fakestore.");
}

async function importDummyjson(catMap, vendor) {
  const url = "https://dummyjson.com/products?limit=194&skip=0";
  const json = await fetchJson(url);
  const rows = json.products || [];
  let added = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const p = rows[i];
    if (i % 25 === 0) {
      console.log(`   … DummyJSON ${i + 1}/${rows.length} …`);
    }

    const tag = `import:dummyjson:${p.id}`;
    const exists = await productModel.findOne({ tags: tag });
    if (exists) {
      skipped++;
      continue;
    }

    const dbName = mapDummySlug(p.category);
    const categoryId = resolveCategoryId(catMap, dbName, `dummyjson ${p.title}`);
    if (!categoryId) {
      skipped++;
      continue;
    }

    const discountPct = Math.round(Number(p.discountPercentage) || 0);
    const price = toVndPrice(p.price);
    let originalPrice;
    if (discountPct > 0 && discountPct < 100) {
      originalPrice = Math.round((price / (1 - discountPct / 100)) / 1000) * 1000;
    }

    const thumbs = [p.thumbnail, ...(p.images || [])].filter(Boolean);
    const image = pickImageUrls(thumbs);

    const stock = Math.max(0, Number(p.stock) || 0);

    await productModel.create({
      name: normalizeProductName(p.title, p.brand).slice(0, 200),
      description: String(p.description || "").slice(0, 8000),
      price,
      originalPrice,
      discount: discountPct,
      image,
      category: categoryId,
      bestseller: false,
      date: Date.now(),
      sold: Math.floor(Math.random() * 50),
      vendorId: vendor._id,
      vendorShopName: vendor.shopName || VENDOR_SHOP,
      stock,
      rating: Math.min(5, Math.max(0, Number(p.rating) || 0)),
      reviewCount: 0,
      brand: String(p.brand || ""),
      tags: [tag, "source:dummyjson"],
      attributes: [],
      variants: [],
      isActive: true,
    });
    added++;
  }
  console.log(`✅ DummyJSON: thêm ${added}, bỏ qua (trùng/thiếu cat): ${skipped}`);
}

async function main() {
  try {
    await connectDB();
    const catMap = await loadCategoryMap();
    if (!catMap.size) {
      console.error("❌ Chưa có category level-1. Chạy: npm run seed-categories");
      process.exit(1);
    }

    const vendor = await getOrCreateVendor();

    console.log("⬇️  Đang tải Fakestore API…");
    await importFakestore(catMap, vendor);
    console.log("⬇️  Đang tải DummyJSON…");
    await importDummyjson(catMap, vendor);

    console.log("🎉 Hoàn tất import.");
    process.exit(0);
  } catch (e) {
    console.error("❌", e);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(__importFile)) {
  main();
}
