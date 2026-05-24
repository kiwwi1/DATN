/**
 * Migrate old product.image data into variant format:
 * image: [{ main, thumb, width, height, format, original }]
 *
 * Usage:
 *   npm run migrate-product-images
 *   npm run migrate-product-images -- --dry-run
 *   npm run migrate-product-images -- --limit=50
 *   npm run migrate-product-images -- --skip=100 --force
 */

import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const limit = Number(
  (args.find((x) => x.startsWith("--limit=")) || "").split("=")[1] || 0
);
const skip = Number(
  (args.find((x) => x.startsWith("--skip=")) || "").split("=")[1] || 0
);

const parsePositiveInt = (value, fallback = 0) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;

const takeLimit = parsePositiveInt(limit, 0);
const takeSkip = parsePositiveInt(skip, 0);

const r2PublicBaseUrl = String(process.env.R2_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
const r2Bucket = String(process.env.R2_BUCKET || "");

const hasR2WriteConfig =
  Boolean(process.env.R2_BUCKET) &&
  Boolean(process.env.R2_ACCESS_KEY) &&
  Boolean(process.env.R2_SECRET_KEY) &&
  Boolean(process.env.R2_ENDPOINT);

let uploadImageUrlToR2Variants;

const normalizeR2StorageUrl = (raw) => {
  if (!raw || typeof raw !== "string") return raw;
  if (!r2PublicBaseUrl) return raw;

  try {
    const src = new URL(raw);
    if (!src.hostname.toLowerCase().includes(".r2.cloudflarestorage.com")) {
      return raw;
    }
    let keyPath = src.pathname.replace(/^\/+/, "");
    if (r2Bucket && keyPath.startsWith(`${r2Bucket}/`)) {
      keyPath = keyPath.slice(r2Bucket.length + 1);
    }
    if (!keyPath) return raw;
    return `${r2PublicBaseUrl}/${keyPath}`;
  } catch {
    return raw;
  }
};

const pickSourceFromObject = (obj) => {
  if (!obj || typeof obj !== "object") return "";
  const candidates = [obj.main, obj.url, obj.original, obj.thumb, obj.src];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
};

const isMigratedEntry = (entry) =>
  Boolean(
    entry &&
      typeof entry === "object" &&
      typeof entry.main === "string" &&
      entry.main.trim() &&
      typeof entry.thumb === "string" &&
      entry.thumb.trim()
  );

const normalizeEntry = (entry) => {
  if (entry == null) return null;
  if (typeof entry === "string") {
    const text = entry.trim();
    return text ? { source: text, migrated: false } : null;
  }
  if (typeof entry === "object") {
    if (!force && isMigratedEntry(entry)) {
      return { source: "", migrated: true, value: entry };
    }
    const source = normalizeR2StorageUrl(pickSourceFromObject(entry));
    return source ? { source, migrated: false } : null;
  }
  const text = normalizeR2StorageUrl(String(entry).trim());
  return text ? { source: text, migrated: false } : null;
};

const shouldMigrateProduct = (product) => {
  const items = Array.isArray(product?.image) ? product.image : [];
  if (!items.length) return false;
  if (force) return true;
  return items.some((item) => !isMigratedEntry(item));
};

async function main() {
  try {
    await connectDB();
    if (!dryRun && !hasR2WriteConfig) {
      throw new Error(
        "Missing R2 write configuration. Please set R2_BUCKET, R2_ACCESS_KEY, R2_SECRET_KEY, R2_ENDPOINT in backend/.env before running write mode."
      );
    }
    if (!dryRun) {
      const uploader = await import("../utils/r2Upload.js");
      uploadImageUrlToR2Variants = uploader.uploadImageUrlToR2Variants;
    }

    const filter = {};
    const query = productModel.find(filter).sort({ _id: 1 });
    if (takeSkip > 0) query.skip(takeSkip);
    if (takeLimit > 0) query.limit(takeLimit);

    const products = await query.lean();
    console.log(`Scan ${products.length} products (skip=${takeSkip}, limit=${takeLimit || "all"})`);
    console.log(`Mode: ${dryRun ? "DRY-RUN" : "WRITE"}${force ? ", FORCE" : ""}`);

    let scanned = 0;
    let migratedProducts = 0;
    let skippedProducts = 0;
    let migratedImages = 0;
    let failedImages = 0;

    for (const product of products) {
      scanned += 1;
      if (!shouldMigrateProduct(product)) {
        skippedProducts += 1;
        continue;
      }

      const oldImages = Array.isArray(product.image) ? product.image : [];
      const nextImages = [];
      let changed = false;

      for (const rawEntry of oldImages) {
        const normalized = normalizeEntry(rawEntry);
        if (!normalized) continue;

        if (normalized.migrated && normalized.value) {
          nextImages.push(normalized.value);
          continue;
        }

        if (dryRun) {
          migratedImages += 1;
          changed = true;
          nextImages.push({
            main: "__dry_run_main__",
            thumb: "__dry_run_thumb__",
            original: normalized.source,
            format: "webp",
          });
          continue;
        }

        try {
          const migrated = await uploadImageUrlToR2Variants(
            normalized.source,
            "products/migrated"
          );
          nextImages.push({
            main: migrated.main,
            thumb: migrated.thumb,
            width: migrated.width,
            height: migrated.height,
            format: migrated.format,
            original: normalized.source,
          });
          migratedImages += 1;
          changed = true;
        } catch (error) {
          failedImages += 1;
          console.warn(
            `image migrate failed [${product._id}] ${normalized.source}: ${error.message}`
          );
          nextImages.push(rawEntry);
        }
      }

      if (!nextImages.length) {
        skippedProducts += 1;
        continue;
      }

      const isDifferentLength = oldImages.length !== nextImages.length;
      const isDifferentContent =
        isDifferentLength ||
        oldImages.some((item, idx) => JSON.stringify(item) !== JSON.stringify(nextImages[idx]));

      if (!isDifferentContent && !changed) {
        skippedProducts += 1;
        continue;
      }

      if (!dryRun) {
        await productModel.updateOne(
          { _id: product._id },
          { $set: { image: nextImages } }
        );
      }
      migratedProducts += 1;
    }

    console.log("---- Summary ----");
    console.log(`Scanned products : ${scanned}`);
    console.log(`Migrated products: ${migratedProducts}`);
    console.log(`Skipped products : ${skippedProducts}`);
    console.log(`Migrated images  : ${migratedImages}`);
    console.log(`Failed images    : ${failedImages}`);
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();
