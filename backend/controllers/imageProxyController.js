import { isAllowedImageHost } from "../utils/imageProxyAllowlist.js";

/**
 * GET /api/image-proxy?url=https%3A%2F%2F...
 * Tải ảnh từ CDN bên thứ ba (Pexels, DummyJSON, …) để tránh chặn hotlink trên <img>.
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

    const ct = upstream.headers.get("content-type") || "image/jpeg";
    res.setHeader(
      "Content-Type",
      ct.startsWith("image/") ? ct : "image/jpeg"
    );
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.send(buf);
  } catch (e) {
    console.warn("image-proxy:", e.message);
    return res.status(500).end();
  }
};
