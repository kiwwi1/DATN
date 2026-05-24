/**
 * Ghi đè field `image` bằng URL từ
 * https://fakestoreapiserver.reactbd.org/api/products (trường `image` — Pexels)
 * cho sản phẩm đã import (tag import:fakestore:<_id>).
 *
 * Chạy từ thư mục backend:
 *   npm run resync-fakestore-images
 */

import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const API_BASE = "https://fakestoreapiserver.reactbd.org/api/products";

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

async function fetchAllFakestoreProducts() {
  const all = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = `${API_BASE}?page=${page}&perPage=30`;
    const j = await fetchJson(url);
    totalPages = Math.max(1, Number(j.totalPages) || 1);
    const batch = j.data || [];
    all.push(...batch);
    page++;
  } while (page <= totalPages);

  return all;
}

async function main() {
  try {
    await connectDB();
    const rows = await fetchAllFakestoreProducts();
    console.log(`📥 Fakestore API: ${rows.length} sản phẩm`);

    let updated = 0;
    let notFound = 0;

    for (const p of rows) {
      const tag = `import:fakestore:${p._id}`;
      const image = pickImageUrls([p.image]);

      const r = await productModel.updateOne({ tags: tag }, { $set: { image } });
      if (r.matchedCount === 0) {
        notFound++;
      } else if (r.modifiedCount > 0) {
        updated++;
      }
    }

    console.log(`✅ Đã cập nhật ảnh (modified): ${updated}`);
    console.log(`ℹ️  Không có document trùng tag import:fakestore:<_id>: ${notFound}`);
    process.exit(0);
  } catch (e) {
    console.error("❌", e);
    process.exit(1);
  }
}

main();
