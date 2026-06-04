/**
 * Ghi đè field `image` bằng URL từ https://dummyjson.com/products (thumbnail + images)
 * cho các sản phẩm đã import (có tag import:dummyjson:<id>).
 *
 * Dùng khi trong DB đang lưu URL R2 / URL cũ, muốn đổi về đúng ảnh API.
 *
 * Chạy từ thư mục backend:
 *   npm run resync-dummyjson-images
 * Cả DummyJSON + Fakestore một lượt:
 *   npm run resync-external-images
 */

import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

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
    headers: { "User-Agent": "Mozilla/5.0 (compatible; DATN-resync/1.0)" },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

/** Lấy toàn bộ sản phẩm DummyJSON (phân trang). */
async function fetchAllDummyJsonProducts() {
  const all = [];
  let skip = 0;
  const limit = 100;
  let total = Infinity;

  while (skip < total) {
    const url = `https://dummyjson.com/products?limit=${limit}&skip=${skip}`;
    const j = await fetchJson(url);
    total = typeof j.total === "number" ? j.total : all.length;
    const batch = j.products || [];
    if (!batch.length) break;
    all.push(...batch);
    skip += limit;
    if (all.length >= total) break;
  }
  return all;
}

async function main() {
  try {
    await connectDB();
    const rows = await fetchAllDummyJsonProducts();
    console.log(`📥 DummyJSON: ${rows.length} sản phẩm từ API`);

    let updated = 0;
    let notFound = 0;

    for (const p of rows) {
      const tag = `import:dummyjson:${p.id}`;
      const thumbs = [p.thumbnail, ...(p.images || [])].filter(Boolean);
      const image = pickImageUrls(thumbs);

      const r = await productModel.updateOne({ tags: tag }, { $set: { image } });
      if (r.matchedCount === 0) {
        notFound++;
      } else if (r.modifiedCount > 0) {
        updated++;
      }
    }

    console.log(`✅ Đã cập nhật ảnh (modified): ${updated}`);
    console.log(`ℹ️  Không có document trùng tag import:dummyjson:<id>: ${notFound}`);
    process.exit(0);
  } catch (e) {
    console.error("❌", e);
    process.exit(1);
  }
}

main();
