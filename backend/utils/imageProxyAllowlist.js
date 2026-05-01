/** Hostname được phép fetch (chống SSRF). */

const SUFFIXES = [
  "images.pexels.com",
  "cdn.dummyjson.com",
  "placehold.co",
  "dummyjson.com",
  "picsum.photos",
  "www.pexels.com",
];

export function isAllowedImageHost(hostname) {
  if (!hostname || typeof hostname !== "string") return false;
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return false;
  return SUFFIXES.some((s) => h === s || h.endsWith("." + s));
}
