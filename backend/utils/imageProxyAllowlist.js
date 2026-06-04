/** Hostnames allowed for image proxy fetch (SSRF guard). */

const STATIC_SUFFIXES = [
  "images.pexels.com",
  "cdn.dummyjson.com",
  "placehold.co",
  "dummyjson.com",
  "picsum.photos",
  "www.pexels.com",
  "r2.dev",
  "r2.cloudflarestorage.com",
];

const fromEnv = (() => {
  const values = [process.env.R2_PUBLIC_BASE_URL, process.env.FRONTEND_URL]
    .filter(Boolean)
    .map((item) => {
      try {
        return new URL(item).hostname.toLowerCase();
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  return Array.from(new Set(values));
})();

const ALLOWLIST_SUFFIXES = Array.from(new Set([...STATIC_SUFFIXES, ...fromEnv]));

export function isAllowedImageHost(hostname) {
  if (!hostname || typeof hostname !== "string") return false;
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return false;
  return ALLOWLIST_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}
