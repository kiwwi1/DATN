import { isAllowedImageHost } from "../utils/imageProxyAllowlist.js";
import sharp from "sharp";

const MAX_DIMENSION = 3000;
const DEFAULT_QUALITY = 80;

const toPositiveInt = (value, max) => {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (typeof max === "number") return Math.min(n, max);
  return n;
};

const pickFit = (value) => {
  const fit = String(value || "").toLowerCase();
  if (fit === "cover" || fit === "contain" || fit === "inside") return fit;
  return "cover";
};

const pickFormat = (value) => {
  const fm = String(value || "").toLowerCase();
  if (fm === "webp" || fm === "avif" || fm === "jpeg" || fm === "png") return fm;
  return "";
};

/**
 * GET /api/image-proxy?url=...&w=...&h=...&q=...&fit=cover|contain|inside&fm=webp|avif|jpeg|png
 * Proxy + optional transform for remote images.
 */
export const getImageProxy = async (req, res) => {
  try {
    let raw = req.query.url;
    if (Array.isArray(raw)) raw = raw[0];
    if (!raw || typeof raw !== "string") {
      return res.status(400).end();
    }

    // Express đã decode query 1 lần; thử parse trực tiếp, lỗi mới decode thêm
    let target;
    try {
      target = new URL(raw);
    } catch {
      try {
        target = new URL(decodeURIComponent(raw));
      } catch {
        return res.status(400).end();
      }
    }

    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return res.status(400).end();
    }

    if (!isAllowedImageHost(target.hostname)) {
      console.warn("image-proxy: host not allowed:", target.hostname);
      return res.status(403).end();
    }

    const upstream = await fetch(target.href, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DATN-image-proxy/1.0)",
        Accept: "image/*,*/*;q=0.8",
      },
    });

    if (!upstream.ok) {
      return res.status(502).end();
    }

    const sourceContentType = upstream.headers.get("content-type") || "image/jpeg";
    const sourceIsImage = sourceContentType.startsWith("image/");
    const width = toPositiveInt(req.query.w, MAX_DIMENSION);
    const height = toPositiveInt(req.query.h, MAX_DIMENSION);
    const quality = toPositiveInt(req.query.q, 100) || DEFAULT_QUALITY;
    const fit = pickFit(req.query.fit);
    const format = pickFormat(req.query.fm);

    const shouldTransform =
      sourceIsImage && (Boolean(width) || Boolean(height) || Boolean(format) || req.query.q !== undefined || req.query.fit !== undefined);

    let outputBuffer = Buffer.from(await upstream.arrayBuffer());
    let outputContentType = sourceIsImage ? sourceContentType : "image/jpeg";

    if (shouldTransform) {
      let transformer = sharp(outputBuffer, { failOnError: false }).rotate();
      if (width || height) {
        transformer = transformer.resize({
          width,
          height,
          fit,
          withoutEnlargement: true,
        });
      }

      if (format === "avif") {
        transformer = transformer.avif({ quality });
        outputContentType = "image/avif";
      } else if (format === "webp") {
        transformer = transformer.webp({ quality });
        outputContentType = "image/webp";
      } else if (format === "png") {
        transformer = transformer.png({ quality });
        outputContentType = "image/png";
      } else if (format === "jpeg" || req.query.q !== undefined) {
        transformer = transformer.jpeg({ quality, mozjpeg: true });
        outputContentType = "image/jpeg";
      }

      outputBuffer = await transformer.toBuffer();
    }

    res.setHeader("Content-Type", outputContentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    return res.send(outputBuffer);
  } catch (e) {
    console.warn("image-proxy:", e.message);
    return res.status(500).end();
  }
};
