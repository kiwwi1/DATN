/**
 * Vá ảnh lỗi cho sản phẩm đã có trong DB.
 *
 * Tiêu chí lỗi:
 * - URL rỗng/không hợp lệ
 * - URL Unsplash sai format photo-id (hay gặp do id bị thiếu ký tự)
 *
 * Chạy từ thư mục backend:
 *   node scripts/fixBrokenSeedImages.js
 */

import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const UNSPLASH_ID_REGEX = /^[a-zA-Z0-9_-]{12,40}$/;

const FALLBACKS = [
  "https://picsum.photos/seed/datn-fallback-1/800/800",
  "https://picsum.photos/seed/datn-fallback-2/800/800",
  "https://picsum.photos/seed/datn-fallback-3/800/800",
];

function getDeterministicFallbacks(seed) {
  const key = String(seed || "datn");
  return [
    `https://picsum.photos/seed/${key}-1/800/800`,
    `https://picsum.photos/seed/${key}-2/800/800`,
    `https://picsum.photos/seed/${key}-3/800/800`,
  ];
}

function isValidImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return false;

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(url.protocol)) return false;

  const host = url.hostname.toLowerCase();
  if (host === "images.unsplash.com") {
    const m = url.pathname.match(/\/photo-([a-zA-Z0-9_-]+)/);
    if (!m) return false;
    return UNSPLASH_ID_REGEX.test(m[1]);
  }

  return true;
}

function normalizeImageList(images, seed) {
  const input = Array.isArray(images) ? images : [];
  const validUnique = [...new Set(input.filter(isValidImageUrl))];

  if (validUnique.length >= 3) return validUnique.slice(0, 3);

  const topup = getDeterministicFallbacks(seed).filter((u) => !validUnique.includes(u));
  const merged = [...validUnique, ...topup];
  if (merged.length > 0) return merged.slice(0, 3);

  return FALLBACKS;
}

async function main() {
  try {
    await connectDB();

    const products = await productModel.find({}, { image: 1, name: 1 }).lean();
    console.log(`📦 Scan ${products.length} products`);

    let scanned = 0;
    let fixed = 0;

    for (const p of products) {
      scanned++;
      const before = Array.isArray(p.image) ? p.image : [];
      const after = normalizeImageList(before, p._id);

      const changed =
        before.length !== after.length ||
        before.some((url, idx) => url !== after[idx]);

      if (!changed) continue;

      await productModel.updateOne({ _id: p._id }, { $set: { image: after } });
      fixed++;

      if (fixed <= 20) {
        console.log(`🛠 Fixed image list: ${p.name}`);
      }
    }

    console.log(`✅ Done. Scanned: ${scanned}, Fixed: ${fixed}`);
    process.exit(0);
  } catch (err) {
    console.error("❌", err);
    process.exit(1);
  }
}

main();
