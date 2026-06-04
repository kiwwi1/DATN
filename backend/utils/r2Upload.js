import fs from "fs";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { r2 } from "../config/r2.js";

const bucket = process.env.R2_BUCKET;
const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL; // e.g. https://your-domain.com or https://pub-xxxx.r2.dev

if (!bucket) {
  console.warn("R2_BUCKET is not set in environment variables.");
}

const IMAGE_MIN_SHORT_SIDE = Number(process.env.IMAGE_MIN_SHORT_SIDE || 500);
const IMAGE_MAIN_MAX_EDGE = Number(process.env.IMAGE_MAIN_MAX_EDGE || 1400);
const IMAGE_THUMB_EDGE = Number(process.env.IMAGE_THUMB_EDGE || 480);
const IMAGE_MAIN_QUALITY = Number(process.env.IMAGE_MAIN_QUALITY || 82);
const IMAGE_THUMB_QUALITY = Number(process.env.IMAGE_THUMB_QUALITY || 76);

const buildPublicUrl = (key) => {
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/+$/, "")}/${key}`;
  }
  return key;
};

const safeUnlink = (filePath) => {
  if (!filePath) return;
  try {
    fs.unlink(filePath, () => {});
  } catch (err) {
    console.warn("Failed to remove local temp file:", err.message);
  }
};

const toVariantKeyPrefix = (folder = "products") => {
  const clean = String(folder || "products").replace(/\/+$/, "");
  const baseId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    mainKey: `${clean}/main/${baseId}.webp`,
    thumbKey: `${clean}/thumb/${baseId}.webp`,
  };
};

const ensureInputImageSize = ({ width, height }) => {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const shortSide = Math.min(w, h);
  if (!w || !h) {
    throw Object.assign(new Error("Invalid image file"), { status: 400 });
  }
  if (shortSide < IMAGE_MIN_SHORT_SIDE) {
    throw Object.assign(
      new Error(
        `Image too small. Minimum short side is ${IMAGE_MIN_SHORT_SIDE}px (received ${w}x${h}).`
      ),
      { status: 400 }
    );
  }
  return { width: w, height: h };
};

const buildVariantBuffers = async (inputBuffer) => {
  const meta = await sharp(inputBuffer).metadata();
  const { width, height } = ensureInputImageSize(meta);

  const [mainBuffer, thumbBuffer] = await Promise.all([
    sharp(inputBuffer)
      .rotate()
      .resize({
        width: IMAGE_MAIN_MAX_EDGE,
        height: IMAGE_MAIN_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: IMAGE_MAIN_QUALITY })
      .toBuffer(),
    sharp(inputBuffer)
      .rotate()
      .resize({
        width: IMAGE_THUMB_EDGE,
        height: IMAGE_THUMB_EDGE,
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: IMAGE_THUMB_QUALITY })
      .toBuffer(),
  ]);

  return { width, height, mainBuffer, thumbBuffer };
};

const uploadVariantBuffers = async ({ mainBuffer, thumbBuffer, mainKey, thumbKey }) => {
  await Promise.all([
    r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: mainKey,
        Body: mainBuffer,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      })
    ),
    r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: thumbKey,
        Body: thumbBuffer,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      })
    ),
  ]);
};

/**
 * Upload image to R2 with normalized outputs:
 * - main: optimized WebP for product page
 * - thumb: square WebP for cards/lists
 * @param {Express.Multer.File} file
 * @param {string} folder
 * @returns {Promise<{main: string, thumb: string, width: number, height: number, format: string}>}
 */
export const uploadToR2 = async (file, folder = "products") => {
  if (!file) {
    throw new Error("No file provided for R2 upload");
  }

  const { mainKey, thumbKey } = toVariantKeyPrefix(folder);

  try {
    const inputBuffer = await fs.promises.readFile(file.path);
    const { width, height, mainBuffer, thumbBuffer } = await buildVariantBuffers(inputBuffer);
    await uploadVariantBuffers({ mainBuffer, thumbBuffer, mainKey, thumbKey });

    return {
      main: buildPublicUrl(mainKey),
      thumb: buildPublicUrl(thumbKey),
      width,
      height,
      format: "webp",
    };
  } finally {
    safeUnlink(file.path);
  }
};

const uploadRawToR2 = async (buffer, key, contentType) => {
  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    })
  );
  return buildPublicUrl(key);
};

const isOwnR2StorageUrl = (imageUrl) => {
  try {
    const u = new URL(imageUrl);
    const host = u.hostname.toLowerCase();
    if (host.includes(".r2.cloudflarestorage.com")) return true;
    const endpointHost = process.env.R2_ENDPOINT
      ? new URL(process.env.R2_ENDPOINT).hostname.toLowerCase()
      : "";
    return endpointHost ? host === endpointHost : false;
  } catch {
    return false;
  }
};

const bodyToBuffer = async (body) => {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (typeof body.transformToByteArray === "function") {
    const arr = await body.transformToByteArray();
    return Buffer.from(arr);
  }
  if (typeof body.getReader === "function") {
    const reader = body.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const loadFromOwnR2 = async (imageUrl) => {
  if (!bucket || !process.env.R2_ACCESS_KEY || !process.env.R2_SECRET_KEY || !process.env.R2_ENDPOINT) {
    return null;
  }
  if (!isOwnR2StorageUrl(imageUrl)) return null;

  const parsed = new URL(imageUrl);
  let key = parsed.pathname.replace(/^\/+/, "");
  if (!key) return null;
  if (bucket && key.startsWith(`${bucket}/`)) {
    key = key.slice(bucket.length + 1);
  }
  if (!key) return null;

  const result = await r2.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  return {
    buffer: await bodyToBuffer(result.Body),
    contentType: result.ContentType || "",
  };
};

const loadFromOwnR2Key = async (rawKey) => {
  if (!bucket || !process.env.R2_ACCESS_KEY || !process.env.R2_SECRET_KEY || !process.env.R2_ENDPOINT) {
    return null;
  }
  let key = String(rawKey || "").replace(/^\/+/, "");
  if (!key) return null;
  if (bucket && key.startsWith(`${bucket}/`)) {
    key = key.slice(bucket.length + 1);
  }
  if (!key) return null;

  const result = await r2.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  return {
    buffer: await bodyToBuffer(result.Body),
    contentType: result.ContentType || "",
  };
};

/**
 * Download image by URL and upload as {main, thumb} variants.
 * Useful for backfilling old product images.
 * @param {string} imageUrl
 * @param {string} [folder="products/migrated"]
 * @returns {Promise<{main: string, thumb: string, width: number, height: number, format: string}>}
 */
export const uploadImageUrlToR2Variants = async (imageUrl, folder = "products/migrated") => {
  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error("Invalid image URL");
  }
  const source = imageUrl.trim();
  if (!source) {
    throw new Error("Invalid image URL");
  }
  let inputBuffer;
  let contentType = "";

  const isHttpUrl = /^https?:\/\//i.test(source);

  try {
    if (!isHttpUrl) {
      const byKey = await loadFromOwnR2Key(source);
      if (!byKey) {
        throw new Error("Invalid image source (not URL and not accessible R2 key)");
      }
      inputBuffer = byKey.buffer;
      contentType = byKey.contentType;
    } else {
      const r2Source = await loadFromOwnR2(source);
      if (r2Source) {
        inputBuffer = r2Source.buffer;
        contentType = r2Source.contentType;
      } else {
        const response = await fetch(source, {
          redirect: "follow",
          headers: { "User-Agent": "Mozilla/5.0 (compatible; DATN-image-migrate/1.0)" },
        });
        if (!response.ok) {
          throw new Error(`Cannot fetch image: ${response.status}`);
        }
        inputBuffer = Buffer.from(await response.arrayBuffer());
        contentType = response.headers.get("content-type") || "";
      }
    }
  } catch (error) {
    throw new Error(`${source}: ${error.message}`);
  }

  if (contentType && !contentType.startsWith("image/")) {
    throw new Error(`URL is not an image (${contentType || "unknown content-type"})`);
  }
  if (!inputBuffer || inputBuffer.length === 0) {
    throw new Error("Cannot load image bytes");
  }

  const { width, height, mainBuffer, thumbBuffer } = await buildVariantBuffers(inputBuffer);
  const { mainKey, thumbKey } = toVariantKeyPrefix(folder);
  await uploadVariantBuffers({ mainBuffer, thumbBuffer, mainKey, thumbKey });

  return {
    main: buildPublicUrl(mainKey),
    thumb: buildPublicUrl(thumbKey),
    width,
    height,
    format: "webp",
  };
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

    return await uploadRawToR2(buf, key, ct);
  } catch (err) {
    console.warn(`[R2] uploadImageUrlToR2: ${err.message} — giữ URL gốc`);
    return imageUrl;
  }
};

