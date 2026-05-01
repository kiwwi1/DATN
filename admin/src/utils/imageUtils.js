export const asImageArray = (image) => {
  if (image == null) return [];
  if (Array.isArray(image)) {
    return image.filter((x) => x != null && String(x).trim() !== "");
  }
  if (typeof image === "string") {
    const t = image.trim();
    return t ? [t] : [];
  }
  return [];
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
      host === "images.unsplash.com" ||
      host.endsWith(".unsplash.com") ||
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

export const formatImageUrl = (input) => {
  let raw = input;

  if (raw == null || raw === "") return "";

  if (Array.isArray(raw)) {
    raw = raw.find((x) => x != null && String(x).trim() !== "") ?? raw[0];
  }

  if (raw == null || raw === "") return "";

  if (typeof raw === "object" && raw !== null && typeof raw.url === "string") {
    raw = raw.url;
  } else if (typeof raw !== "string") {
    raw = String(raw);
  }

  raw = raw.trim();
  if (!raw) return "";

  if (raw.startsWith("//")) {
    raw = `https:${raw}`;
  }

  if (raw.includes("/api/image-proxy")) {
    return raw;
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    raw = normalizeR2StorageUrl(raw);
    const backend = getBackendBaseUrl();
    if (backend && shouldProxyExternalImageUrl(raw)) {
      return `${backend}/api/image-proxy?url=${encodeURIComponent(raw)}`;
    }
    return raw;
  }

  const publicBaseUrl = import.meta.env.VITE_R2_PUBLIC_BASE_URL || "";
  const bucketName = import.meta.env.VITE_R2_BUCKET || "";

  if (publicBaseUrl) {
    const base = publicBaseUrl.replace(/\/+$/, "");
    const key = raw.replace(/^\/+/, "");

    if (base.includes(".r2.cloudflarestorage.com") && bucketName) {
      return `${base}/${bucketName}/${key}`;
    }

    return `${base}/${key}`;
  }

  return raw;
};
