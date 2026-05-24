/**
 * Kiểm tra ảnh bìa (image[0]) bằng HTTP; nếu URL không tồn tại / lỗi mạng,
 * đưa ảnh ở slot 1 (hoặc slot kế tiếp còn sống) lên làm image[0].
 *
 * Chạy từ thư mục backend:
 *   node scripts/fixPrimaryProductImage.js
 *   node scripts/fixPrimaryProductImage.js --dry-run
 *
 * URL tương đối (/uploads/...): đặt PUBLIC_API_URL hoặc BACKEND_URL (gốc API, không có / cuối).
 */

import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const TIMEOUT_MS = 12_000;
const DRY_RUN = process.argv.includes("--dry-run");

function asImageArray(image) {
  if (image == null) return [];
  if (Array.isArray(image)) {
    return image.map((x) => (x == null ? "" : String(x).trim())).filter(Boolean);
  }
  if (typeof image === "string" && image.trim()) return [image.trim()];
  return [];
}

function resolveProbeUrl(raw) {
  let u = String(raw).trim();
  if (!u) return null;
  if (u.startsWith("//")) u = `https:${u}`;
  const base = (process.env.PUBLIC_API_URL || process.env.BACKEND_URL || "").replace(/\/+$/, "");
  if (u.startsWith("/")) {
    if (!base) return null;
    u = `${base}${u}`;
  }
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

async function probeImageUrl(rawUrl) {
  const url = resolveProbeUrl(rawUrl);
  if (!url) return false;

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow", signal });
    if (res.ok) return true;
    if (res.status === 405 || res.status === 501) {
      const signal2 = AbortSignal.timeout(TIMEOUT_MS);
      res = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        redirect: "follow",
        signal: signal2,
      });
      return res.ok || res.status === 206;
    }
    return false;
  } catch {
    return false;
  }
}

/** Đưa phần tử index `from` lên đầu, giữ thứ tự còn lại, bỏ trùng URL. */
function promoteIndexToFront(images, fromIndex) {
  if (fromIndex <= 0 || fromIndex >= images.length) return images;
  const picked = images[fromIndex];
  const rest = images.filter((_, i) => i !== fromIndex);
  const merged = [picked, ...rest];
  const seen = new Set();
  const out = [];
  for (const u of merged) {
    const k = String(u).trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(u);
  }
  return out;
}

function sameImageArray(a, b) {
  if (a.length !== b.length) return false;
  return a.every((u, i) => String(u).trim() === String(b[i]).trim());
}

async function main() {
  try {
    await connectDB();

    const products = await productModel.find({}, { image: 1, name: 1 }).lean();
    console.log(`📦 ${products.length} sản phẩm · dry-run=${DRY_RUN}`);

    let checked = 0;
    let updated = 0;
    let skippedNoSecond = 0;
    let skippedAllBad = 0;

    for (const p of products) {
      const images = asImageArray(p.image);
      if (images.length < 2) {
        skippedNoSecond++;
        continue;
      }

      checked++;
      const ok0 = await probeImageUrl(images[0]);
      if (ok0) continue;

      let promoteIdx = -1;
      for (let j = 1; j < images.length; j++) {
        if (await probeImageUrl(images[j])) {
          promoteIdx = j;
          break;
        }
      }

      if (promoteIdx === -1) {
        skippedAllBad++;
        console.warn(`⚠ Không có ảnh dự phòng sống: ${p.name} (${p._id})`);
        continue;
      }

      const next = promoteIndexToFront(images, promoteIdx);
      if (sameImageArray(images, next)) continue;

      if (!DRY_RUN) {
        await productModel.updateOne({ _id: p._id }, { $set: { image: next } });
      }
      updated++;
      console.log(
        `${DRY_RUN ? "🔎" : "✅"} [${promoteIdx}→0] ${p.name.slice(0, 60)}${p.name.length > 60 ? "…" : ""}`
      );
    }

    console.log(
      `\nKết quả: đã kiểm tra (≥2 ảnh)=${checked}, cập nhật=${updated}, <2 ảnh=${skippedNoSecond}, mọi URL lỗi=${skippedAllBad}`
    );
    process.exit(0);
  } catch (err) {
    console.error("❌", err);
    process.exit(1);
  }
}

main();
