/**
 * Normalize product image payload from backend.
 * Supports:
 * - string URL/key
 * - object { main, thumb, url, original }
 * - array of above
 */
export const asImageArray = (image) => {
  if (image == null) return [];
  const source = Array.isArray(image) ? image : [image];

  return source
    .map((item) => {
      if (item == null) return null;
      if (typeof item === "string") {
        const value = item.trim();
        return value ? value : null;
      }
      if (typeof item === "object") {
        const hasCandidate =
          typeof item.main === "string" ||
          typeof item.thumb === "string" ||
          typeof item.url === "string" ||
          typeof item.original === "string" ||
          typeof item.src === "string";
        return hasCandidate ? item : null;
      }
      const text = String(item).trim();
      return text ? text : null;
    })
    .filter(Boolean);
};

function getBackendBaseUrl() {
  const fromEnv = import.meta.env.VITE_BACKEND_URL?.replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined" && import.meta.env.DEV) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:4000`;
  }
  return "";
}

function shouldProxyExternalImageUrl(href) {
  try {
    const u = new URL(href);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host.includes("r2.dev") || host.includes("cloudflarestorage.com")) {
      return false;
    }
    return (
      host === "images.pexels.com" ||
      host === "www.pexels.com" ||
      host.endsWith(".pexels.com") ||
      host === "cdn.dummyjson.com" ||
      host.endsWith(".dummyjson.com") ||
      host === "placehold.co" ||
      host.endsWith(".placehold.co") ||
      host === "picsum.photos"
    );
  } catch {
    return false;
  }
}

function normalizeR2StorageUrl(raw) {
  if (!raw || typeof raw !== "string") return raw;
  const publicBaseUrl = import.meta.env.VITE_R2_PUBLIC_BASE_URL || "";
  if (!publicBaseUrl) return raw;

  try {
    const src = new URL(raw);
    if (!src.hostname.toLowerCase().includes(".r2.cloudflarestorage.com")) {
      return raw;
    }

    const base = publicBaseUrl.replace(/\/+$/, "");
    const bucketName = import.meta.env.VITE_R2_BUCKET || "";
    let keyPath = src.pathname.replace(/^\/+/, "");

    if (bucketName && keyPath.startsWith(`${bucketName}/`)) {
      keyPath = keyPath.slice(bucketName.length + 1);
    }

    if (!keyPath) return raw;
    return `${base}/${keyPath}`;
  } catch {
    return raw;
  }
}

const pickImageSource = (input, variant = "main") => {
  let raw = input;
  if (Array.isArray(raw)) {
    const normalized = asImageArray(raw);
    raw = normalized[0];
  }
  if (raw == null || raw === "") return "";

  if (typeof raw === "object") {
    const direct = typeof raw[variant] === "string" ? raw[variant].trim() : "";
    if (direct) return direct;

    const fallbackKeys = ["main", "url", "original", "thumb", "src"];
    for (const key of fallbackKeys) {
      const value = typeof raw[key] === "string" ? raw[key].trim() : "";
      if (value) return value;
    }
    return "";
  }

  if (typeof raw !== "string") return String(raw).trim();
  return raw.trim();
};

const buildProxyUrl = (backend, rawUrl, options) => {
  const url = new URL(`${backend}/api/image-proxy`);
  url.searchParams.set("url", rawUrl);

  if (options?.width) url.searchParams.set("w", String(options.width));
  if (options?.height) url.searchParams.set("h", String(options.height));
  if (options?.quality) url.searchParams.set("q", String(options.quality));
  if (options?.fit) url.searchParams.set("fit", options.fit);
  if (options?.format) url.searchParams.set("fm", options.format);

  return url.toString();
};

/**
 * Build display image URL with optional optimization params.
 * @param {*} input image value from API/model
 * @param {{variant?: "main"|"thumb", width?: number, height?: number, quality?: number, fit?: "cover"|"contain"|"inside", format?: "webp"|"avif"|"jpeg"|"png"}} options
 */
export const formatImageUrl = (input, options = {}) => {
  const variant = options.variant || "main";
  let raw = pickImageSource(input, variant);
  if (!raw) return "";

  if (raw.startsWith("//")) {
    raw = `https:${raw}`;
  }

  if (raw.includes("/api/image-proxy")) {
    return raw;
  }

  const shouldTransform =
    Boolean(options.width) ||
    Boolean(options.height) ||
    Boolean(options.quality) ||
    Boolean(options.fit) ||
    Boolean(options.format);

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    raw = normalizeR2StorageUrl(raw);
    const backend = getBackendBaseUrl();
    const mustProxy = shouldProxyExternalImageUrl(raw) || shouldTransform;
    if (backend && mustProxy) {
      return buildProxyUrl(backend, raw, options);
    }
    return raw;
  }

  const publicBaseUrl = import.meta.env.VITE_R2_PUBLIC_BASE_URL || "";
  const bucketName = import.meta.env.VITE_R2_BUCKET || "";

  if (publicBaseUrl) {
    const base = publicBaseUrl.replace(/\/+$/, "");
    const key = raw.replace(/^\/+/, "");

    let absoluteUrl = "";
    if (base.includes(".r2.cloudflarestorage.com") && bucketName) {
      absoluteUrl = `${base}/${bucketName}/${key}`;
    } else {
      absoluteUrl = `${base}/${key}`;
    }

    const backend = getBackendBaseUrl();
    if (backend && shouldTransform) {
      return buildProxyUrl(backend, absoluteUrl, options);
    }
    return absoluteUrl;
  }

  return raw;
};
