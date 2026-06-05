export const deliveryFee = 30000;
export const FREE_SHIPPING_THRESHOLD = Number(process.env.FREE_SHIPPING_THRESHOLD || 500000);
export const PAYMENT_RESERVATION_TTL_MIN = Number(process.env.PAYMENT_RESERVATION_TTL_MIN || 15);
export const PAYMENT_RESERVATION_TTL_MS = Math.max(1, PAYMENT_RESERVATION_TTL_MIN) * 60 * 1000;
