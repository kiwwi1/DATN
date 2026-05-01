import fs from "fs";
import path from "path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "../config/r2.js";

const bucket = process.env.R2_BUCKET;
const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL; // e.g. https://your-domain.com or https://pub-xxxx.r2.dev

if (!bucket) {
  console.warn("R2_BUCKET is not set in environment variables.");
}

/**
 * Upload a single file (from multer) to Cloudflare R2
 * @param {Express.Multer.File} file
 * @param {string} folder
 * @returns {Promise<string>} public URL or object key
 */
export const uploadToR2 = async (file, folder = "products") => {
  if (!file) {
    throw new Error("No file provided for R2 upload");
  }

  const fileStream = fs.createReadStream(file.path);
  const ext = path.extname(file.originalname) || "";
  const key = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}${ext}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileStream,
      ContentType: file.mimetype || "application/octet-stream",
    })
  );

  // Optional: remove local temp file after upload
  try {
    fs.unlink(file.path, () => {});
  } catch (err) {
    console.warn("Failed to remove local temp file:", err.message);
  }

  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/+$/, "")}/${key}`;
  }

  return key;
};

/**
 * Tải ảnh từ URL và upload lên R2 (dùng cho seed/import).
 * Nếu thiếu cấu hình R2 hoặc lỗi — trả về URL gốc.
 * @param {string} imageUrl
 * @param {string} [folder="products/import"]
 * @returns {Promise<string>} URL public hoặc URL gốc
 */
export const uploadImageUrlToR2 = async (imageUrl, folder = "products/import") => {
  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error("Invalid image URL");
  }
  if (!bucket || !process.env.R2_ACCESS_KEY || !process.env.R2_ENDPOINT) {
    return imageUrl;
  }

  try {
    const res = await fetch(imageUrl, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DATN-import/1.0)" },
    });
    if (!res.ok) {
      console.warn(`[R2] GET ${imageUrl} → ${res.status}, giữ URL gốc`);
      return imageUrl;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "image/jpeg";
    let ext = ".jpg";
    if (ct.includes("png")) ext = ".png";
    else if (ct.includes("webp")) ext = ".webp";
    else if (ct.includes("gif")) ext = ".gif";
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buf,
        ContentType: ct,
      })
    );

    if (publicBaseUrl) {
      return `${publicBaseUrl.replace(/\/+$/, "")}/${key}`;
    }
    return key;
  } catch (err) {
    console.warn(`[R2] uploadImageUrlToR2: ${err.message} — giữ URL gốc`);
    return imageUrl;
  }
};

