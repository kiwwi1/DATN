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

