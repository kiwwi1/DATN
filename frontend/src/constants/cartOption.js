export const DEFAULT_CART_OPTION_KEY = "__default__";

export const normalizeCartOptionKey = (optionKey) => {
  const normalized = String(optionKey ?? "").trim();
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return DEFAULT_CART_OPTION_KEY;
  }
  return normalized;
};

export const isDefaultCartOptionKey = (optionKey) =>
  normalizeCartOptionKey(optionKey) === DEFAULT_CART_OPTION_KEY;

