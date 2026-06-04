/**
 * Apply approved Google Image candidates to product image[0].
 *
 * Usage:
 *   npm run apply-google-img0 -- --input=./scripts/output/google-img0-candidates.csv
 *   npm run apply-google-img0 -- --input=./scripts/output/google-img0-candidates.csv --dry-run
 *   npm run apply-google-img0 -- --input=./scripts/output/google-img0-candidates.csv --limit=50
 */

import fs from "fs/promises";
import path, { dirname, join } from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const args = process.argv.slice(2);
const inputArg = (args.find((x) => x.startsWith("--input=")) || "").split("=")[1];
const dryRun = args.includes("--dry-run");
const limit = Number((args.find((x) => x.startsWith("--limit=")) || "").split("=")[1] || 0);
const skip = Number((args.find((x) => x.startsWith("--skip=")) || "").split("=")[1] || 0);

const toPositiveInt = (value, fallback = 0) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;

const takeLimit = toPositiveInt(limit, 0);
const takeSkip = toPositiveInt(skip, 0);

if (!inputArg) {
  console.error("Missing --input=<csv-file>");
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), inputArg);

const hasR2WriteConfig =
  Boolean(process.env.R2_BUCKET) &&
  Boolean(process.env.R2_ACCESS_KEY) &&
  Boolean(process.env.R2_SECRET_KEY) &&
  Boolean(process.env.R2_ENDPOINT);

const parseCsvLine = (line) => {
  const result = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === "\"") {
        if (line[i + 1] === "\"") {
          field += "\"";
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === "\"") {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      result.push(field);
      field = "";
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  result.push(field);
  return result;
};

const parseCsv = (content) => {
  const lines = String(content || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((x) => x.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((key, idx) => {
      row[key] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
};

const isApproved = (value) => /^(1|true|yes|y)$/i.test(String(value || "").trim());
const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || ""));

const pickSourceFromImageEntry = (entry) => {
  if (entry == null) return "";
  if (typeof entry === "string") return entry.trim();
  if (typeof entry === "object") {
    const candidates = [entry.main, entry.url, entry.original, entry.thumb, entry.src];
    for (const item of candidates) {
      if (typeof item === "string" && item.trim()) return item.trim();
    }
  }
  const text = String(entry).trim();
  return text || "";
};

async function main() {
  try {
    if (!dryRun && !hasR2WriteConfig) {
      throw new Error(
        "Missing R2 write configuration. Please set R2_BUCKET, R2_ACCESS_KEY, R2_SECRET_KEY, R2_ENDPOINT in backend/.env before running write mode."
      );
    }

    let uploadImageUrlToR2Variants = null;
    if (!dryRun) {
      const uploader = await import("../utils/r2Upload.js");
      uploadImageUrlToR2Variants = uploader.uploadImageUrlToR2Variants;
    }

    await connectDB();

    const csvContent = await fs.readFile(inputPath, "utf8");
    const rows = parseCsv(csvContent);
    const approvedRows = rows.filter(
      (row) => isApproved(row.approved) && row.productId && row.chosenUrl && isHttpUrl(row.chosenUrl)
    );

    const slicedRows = approvedRows.slice(
      takeSkip,
      takeLimit > 0 ? takeSkip + takeLimit : undefined
    );

    console.log(`Input CSV rows      : ${rows.length}`);
    console.log(`Approved valid rows : ${approvedRows.length}`);
    console.log(`Applying rows       : ${slicedRows.length} (skip=${takeSkip}, limit=${takeLimit || "all"})`);
    console.log(`Mode                : ${dryRun ? "DRY-RUN" : "WRITE"}`);

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of slicedRows) {
      processed += 1;
      const productId = String(row.productId).trim();
      const chosenUrl = String(row.chosenUrl).trim();

      try {
        const product = await productModel.findById(productId, { image: 1, name: 1 }).lean();
        if (!product) {
          skipped += 1;
          console.warn(`[skip] ${productId}: product not found`);
          continue;
        }

        const oldImages = Array.isArray(product.image) ? product.image : [];
        const currentImg0 = pickSourceFromImageEntry(oldImages[0]);

        if (dryRun) {
          updated += 1;
          console.log(
            `[dry-run] ${productId} | ${product.name || ""} | old0=${currentImg0 || "(empty)"} | new0=${chosenUrl}`
          );
          continue;
        }

        const migrated = await uploadImageUrlToR2Variants(chosenUrl, "products/google-replace");
        const nextImages = [
          {
            main: migrated.main,
            thumb: migrated.thumb,
            width: migrated.width,
            height: migrated.height,
            format: migrated.format,
            original: chosenUrl,
          },
          ...oldImages.slice(1),
        ];

        await productModel.updateOne({ _id: product._id }, { $set: { image: nextImages } });

        updated += 1;
        console.log(
          `[ok] ${productId} | ${product.name || ""} | old0=${currentImg0 || "(empty)"} | new0=${chosenUrl}`
        );
      } catch (error) {
        failed += 1;
        console.warn(`[fail] ${productId} | ${chosenUrl} | ${error.message}`);
      }
    }

    console.log("---- Summary ----");
    console.log(`Processed : ${processed}`);
    console.log(`Updated   : ${updated}`);
    console.log(`Skipped   : ${skipped}`);
    console.log(`Failed    : ${failed}`);
    process.exit(0);
  } catch (error) {
    console.error("Apply failed:", error);
    process.exit(1);
  }
}

main();
