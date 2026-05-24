/**
 * Prepare Google Image candidates for replacing product image[0].
 *
 * Usage:
 *   npm run prepare-google-img0
 *   npm run prepare-google-img0 -- --limit=20 --skip=0
 *   npm run prepare-google-img0 -- --output=./scripts/output/google-img0-candidates.csv
 */

import fs from "fs/promises";
import path, { dirname, join } from "path";
import dotenv from "dotenv";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import connectDB from "../config/mongodb.js";
import productModel from "../models/productModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const require = createRequire(import.meta.url);
const gis = require("g-i-s");

const args = process.argv.slice(2);
const limit = Number((args.find((x) => x.startsWith("--limit=")) || "").split("=")[1] || 0);
const skip = Number((args.find((x) => x.startsWith("--skip=")) || "").split("=")[1] || 0);
const outputArg = (args.find((x) => x.startsWith("--output=")) || "").split("=")[1];

const toPositiveInt = (value, fallback = 0) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;

const takeLimit = toPositiveInt(limit, 0);
const takeSkip = toPositiveInt(skip, 0);
const resultLimit = toPositiveInt(Number(process.env.GOOGLE_IMAGE_RESULT_LIMIT || 10), 10);
const candidateLimit = 2;
const imageMinShortSide = toPositiveInt(Number(process.env.IMAGE_MIN_SHORT_SIDE || 500), 500);
const maxBytes = toPositiveInt(Number(process.env.GOOGLE_IMAGE_MAX_BYTES || 12 * 1024 * 1024), 12 * 1024 * 1024);
const requestTimeoutMs = toPositiveInt(Number(process.env.GOOGLE_IMAGE_FETCH_TIMEOUT_MS || 15000), 15000);

const now = new Date();
const dateStamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
  now.getDate()
).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(
  2,
  "0"
)}`;
const defaultOutputPath = path.resolve(
  __dirname,
  "output",
  `google-img0-candidates-${dateStamp}.csv`
);
const outputPath = outputArg ? path.resolve(process.cwd(), outputArg) : defaultOutputPath;

const csvColumns = [
  "productId",
  "productName",
  "currentImg0",
  "candidate1",
  "candidate2",
  "width",
  "height",
  "chosenUrl",
  "approved",
];

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

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || ""));

const normalizeUrlForDedupe = (rawUrl) => {
  try {
    const u = new URL(rawUrl);
    u.hash = "";
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname}${u.search}`;
  } catch {
    return "";
  }
};

const searchGoogleImages = async (searchTerm) =>
  new Promise((resolve, reject) => {
    gis(searchTerm, (error, results) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(Array.isArray(results) ? results : []);
    });
  });

const fetchImageBuffer = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DATN-google-image-prepare/1.0)",
        Accept: "image/*,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType && !contentType.startsWith("image/")) {
      throw new Error(`not image content-type (${contentType})`);
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > maxBytes) {
      throw new Error(`image too large (${contentLength} bytes)`);
    }

    const chunks = [];
    let total = 0;

    if (!response.body) {
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > maxBytes) throw new Error(`image too large (${raw.length} bytes)`);
      return raw;
    }

    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const buf = Buffer.from(value);
      total += buf.length;
      if (total > maxBytes) {
        throw new Error(`image too large (> ${maxBytes} bytes)`);
      }
      chunks.push(buf);
    }
    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timer);
  }
};

const validateCandidateUrl = async (url) => {
  const buf = await fetchImageBuffer(url);
  if (!buf.length) throw new Error("empty image");
  const meta = await sharp(buf).metadata();
  const width = Number(meta.width) || 0;
  const height = Number(meta.height) || 0;
  if (!width || !height) throw new Error("cannot detect dimensions");
  if (Math.min(width, height) < imageMinShortSide) {
    throw new Error(`short side < ${imageMinShortSide}px (${width}x${height})`);
  }
  return { width, height };
};

const csvEscape = (value) => {
  const text = value == null ? "" : String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
};

const toCsvLine = (row) => csvColumns.map((col) => csvEscape(row[col] ?? "")).join(",");

async function main() {
  try {
    await connectDB();

    const query = productModel.find({}, { name: 1, image: 1 }).sort({ _id: 1 });
    if (takeSkip > 0) query.skip(takeSkip);
    if (takeLimit > 0) query.limit(takeLimit);
    const products = await query.lean();

    console.log(`Scan ${products.length} products (skip=${takeSkip}, limit=${takeLimit || "all"})`);
    console.log(`Result limit/query=${resultLimit}, candidate/product=${candidateLimit}`);
    console.log(`Min short side=${imageMinShortSide}px, max bytes=${maxBytes}`);

    const rows = [];
    let successProducts = 0;
    let noCandidateProducts = 0;

    for (let i = 0; i < products.length; i += 1) {
      const product = products[i];
      const name = String(product?.name || "").trim();
      const queryText = `"${name}"`;
      const currentImages = Array.isArray(product?.image) ? product.image : [];
      const currentImg0 = pickSourceFromImageEntry(currentImages[0]);
      const accepted = [];
      const seen = new Set();

      if (!name) {
        noCandidateProducts += 1;
        rows.push({
          productId: String(product._id),
          productName: "",
          currentImg0,
          candidate1: "",
          candidate2: "",
          width: "",
          height: "",
          chosenUrl: "",
          approved: "",
        });
        console.log(`[${i + 1}/${products.length}] missing product name: ${product._id}`);
        continue;
      }

      let results = [];
      try {
        results = await searchGoogleImages(queryText);
      } catch (error) {
        console.warn(`[${i + 1}/${products.length}] search failed ${product._id}: ${error.message}`);
      }

      for (const item of results.slice(0, resultLimit)) {
        if (accepted.length >= candidateLimit) break;
        const rawUrl = typeof item?.url === "string" ? item.url.trim() : "";
        if (!rawUrl || !isHttpUrl(rawUrl)) continue;
        const dedupeKey = normalizeUrlForDedupe(rawUrl);
        if (!dedupeKey || seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        try {
          const { width, height } = await validateCandidateUrl(rawUrl);
          accepted.push({ url: rawUrl, width, height });
        } catch (error) {
          continue;
        }
      }

      if (accepted.length > 0) successProducts += 1;
      else noCandidateProducts += 1;

      rows.push({
        productId: String(product._id),
        productName: name,
        currentImg0,
        candidate1: accepted[0]?.url || "",
        candidate2: accepted[1]?.url || "",
        width: accepted[0]?.width || "",
        height: accepted[0]?.height || "",
        chosenUrl: accepted[0]?.url || "",
        approved: "",
      });

      console.log(
        `[${i + 1}/${products.length}] ${product._id} | candidates=${accepted.length} | ${name.slice(0, 80)}`
      );
    }

    const lines = [csvColumns.join(","), ...rows.map(toCsvLine)];
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");

    console.log("---- Summary ----");
    console.log(`Total products       : ${products.length}`);
    console.log(`Have candidates      : ${successProducts}`);
    console.log(`No valid candidates  : ${noCandidateProducts}`);
    console.log(`Output CSV           : ${outputPath}`);
    process.exit(0);
  } catch (error) {
    console.error("Prepare failed:", error);
    process.exit(1);
  }
}

main();

