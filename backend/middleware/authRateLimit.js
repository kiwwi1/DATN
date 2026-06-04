import { incrWithWindow } from "../config/redis.js";

const fallbackStore = new Map();

const getIp = (req) => {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
        return forwarded.split(",")[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || "unknown";
};

const getEmail = (req) => {
    const value = req.body?.email;
    if (typeof value !== "string") return "";
    return value.trim().toLowerCase();
};

const fallbackIncrWithWindow = (key, windowSec) => {
    const now = Date.now();
    const existing = fallbackStore.get(key);
    if (!existing || existing.expiresAt <= now) {
        const expiresAt = now + windowSec * 1000;
        fallbackStore.set(key, { count: 1, expiresAt });
        return { count: 1, ttl: windowSec };
    }

    existing.count += 1;
    fallbackStore.set(key, existing);
    const ttl = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
    return { count: existing.count, ttl };
};

const createLimiter = ({ keyBuilder, max, windowSec, message }) => {
    return async (req, res, next) => {
        try {
            const key = keyBuilder(req);
            if (!key) return next();

            let result = await incrWithWindow(key, windowSec);
            if (!result) {
                result = fallbackIncrWithWindow(key, windowSec);
            }

            res.setHeader("X-RateLimit-Limit", String(max));
            res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - result.count)));
            res.setHeader("X-RateLimit-Reset", String(result.ttl));

            if (result.count > max) {
                return res.status(429).json({
                    success: false,
                    message,
                    retryAfterSec: result.ttl,
                });
            }

            next();
        } catch (error) {
            console.error("[rate-limit] Error:", error.message);
            next();
        }
    };
};

const WINDOW_SEC = Number(process.env.AUTH_RL_WINDOW_SEC || 15 * 60);
const MAX_LOGIN_IP = Number(process.env.AUTH_RL_MAX_LOGIN_IP || 20);
const MAX_LOGIN_EMAIL = Number(process.env.AUTH_RL_MAX_LOGIN_EMAIL || 10);
const MAX_VERIFY_EMAIL_IP = Number(process.env.AUTH_RL_MAX_VERIFY_IP || 30);
const MAX_VERIFY_EMAIL_EMAIL = Number(process.env.AUTH_RL_MAX_VERIFY_EMAIL || 10);
const MAX_FORGOT_PASSWORD_IP = Number(process.env.AUTH_RL_MAX_FORGOT_IP || 15);
const MAX_FORGOT_PASSWORD_EMAIL = Number(process.env.AUTH_RL_MAX_FORGOT_EMAIL || 5);
const MAX_RESET_PASSWORD_IP = Number(process.env.AUTH_RL_MAX_RESET_IP || 20);
const MAX_REFRESH_IP = Number(process.env.AUTH_RL_MAX_REFRESH_IP || 120);
const MAX_REGISTER_IP = Number(process.env.AUTH_RL_MAX_REGISTER_IP || 10);
const MAX_REGISTER_VENDOR_IP = Number(process.env.AUTH_RL_MAX_REGISTER_VENDOR_IP || 10);
const MAX_VENDOR_STATS_IP = Number(process.env.AUTH_RL_MAX_VENDOR_STATS_IP || 120);
const MAX_VENDOR_LIST_IP = Number(process.env.AUTH_RL_MAX_VENDOR_LIST_IP || 120);
const MAX_REGISTER_EMAIL = Number(process.env.AUTH_RL_MAX_REGISTER_EMAIL || 3);

export const loginRateLimit = [
    createLimiter({
        keyBuilder: (req) => `rl:login:ip:${getIp(req)}`,
        max: MAX_LOGIN_IP,
        windowSec: WINDOW_SEC,
        message: "Too many login attempts from this IP. Please try again later.",
    }),
    createLimiter({
        keyBuilder: (req) => {
            const email = getEmail(req);
            return email ? `rl:login:email:${email}` : "";
        },
        max: MAX_LOGIN_EMAIL,
        windowSec: WINDOW_SEC,
        message: "Too many login attempts for this account. Please try again later.",
    }),
];

export const verifyEmailRateLimit = [
    createLimiter({
        keyBuilder: (req) => `rl:verify-email:ip:${getIp(req)}`,
        max: MAX_VERIFY_EMAIL_IP,
        windowSec: WINDOW_SEC,
        message: "Too many verification attempts. Please try again later.",
    }),
    createLimiter({
        keyBuilder: (req) => {
            const email = getEmail(req);
            return email ? `rl:verify-email:email:${email}` : "";
        },
        max: MAX_VERIFY_EMAIL_EMAIL,
        windowSec: WINDOW_SEC,
        message: "Too many verification attempts for this account. Please try again later.",
    }),
];

export const forgotPasswordRateLimit = [
    createLimiter({
        keyBuilder: (req) => `rl:forgot-password:ip:${getIp(req)}`,
        max: MAX_FORGOT_PASSWORD_IP,
        windowSec: WINDOW_SEC,
        message: "Too many password reset requests. Please try again later.",
    }),
    createLimiter({
        keyBuilder: (req) => {
            const email = getEmail(req);
            return email ? `rl:forgot-password:email:${email}` : "";
        },
        max: MAX_FORGOT_PASSWORD_EMAIL,
        windowSec: WINDOW_SEC,
        message: "Too many password reset requests for this account. Please try again later.",
    }),
];

export const resetPasswordRateLimit = [
    createLimiter({
        keyBuilder: (req) => `rl:reset-password:ip:${getIp(req)}`,
        max: MAX_RESET_PASSWORD_IP,
        windowSec: WINDOW_SEC,
        message: "Too many reset attempts. Please try again later.",
    }),
];

export const refreshAuthRateLimit = [
    createLimiter({
        keyBuilder: (req) => `rl:refresh:ip:${getIp(req)}`,
        max: MAX_REFRESH_IP,
        windowSec: WINDOW_SEC,
        message: "Too many refresh attempts. Please try again later.",
    }),
];

export const registerRateLimit = [
    createLimiter({
        keyBuilder: (req) => `rl:register:ip:${getIp(req)}`,
        max: MAX_REGISTER_IP,
        windowSec: WINDOW_SEC,
        message: "Too many registration attempts from this IP. Please try again later.",
    }),
    createLimiter({
        keyBuilder: (req) => {
            const email = getEmail(req);
            return email ? `rl:register:email:${email}` : "";
        },
        max: MAX_REGISTER_EMAIL,
        windowSec: WINDOW_SEC,
        message: "Too many registration attempts for this email. Please try again later.",
    }),
];

export const registerVendorRateLimit = [
    createLimiter({
        keyBuilder: (req) => `rl:register-vendor:ip:${getIp(req)}`,
        max: MAX_REGISTER_VENDOR_IP,
        windowSec: WINDOW_SEC,
        message: "Quá nhiều yêu cầu đăng ký người bán. Vui lòng thử lại sau.",
    }),
];

export const vendorStatsRateLimit = [
    createLimiter({
        keyBuilder: (req) => `rl:vendor-stats:ip:${getIp(req)}`,
        max: MAX_VENDOR_STATS_IP,
        windowSec: WINDOW_SEC,
        message: "Quá nhiều yêu cầu thống kê gian hàng. Vui lòng thử lại sau.",
    }),
];

export const vendorListRateLimit = [
    createLimiter({
        keyBuilder: (req) => `rl:vendor-list:ip:${getIp(req)}`,
        max: MAX_VENDOR_LIST_IP,
        windowSec: WINDOW_SEC,
        message: "Quá nhiều yêu cầu danh sách dành cho nhà bán. Vui lòng thử lại sau.",
    }),
];
