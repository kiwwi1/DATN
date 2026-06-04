import crypto from "crypto";
import querystring from "querystring";

const pad = (n) => String(n).padStart(2, "0");

/** Format Date thành yyyyMMddHHmmss theo múi giờ UTC+7 (Việt Nam) */
const formatVNDate = (date) => {
    const d = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return (
        `${d.getUTCFullYear()}` +
        `${pad(d.getUTCMonth() + 1)}` +
        `${pad(d.getUTCDate())}` +
        `${pad(d.getUTCHours())}` +
        `${pad(d.getUTCMinutes())}` +
        `${pad(d.getUTCSeconds())}`
    );
};

/** Ký HMAC-SHA512 và trả về chuỗi hex */
const hmacSHA512 = (key, data) =>
    crypto.createHmac("sha512", key).update(Buffer.from(data, "utf-8")).digest("hex");

/** Chuẩn sortObject theo mẫu VNPay Node */
const sortObject = (obj) => {
    const cleaned = {};
    for (const [k, v] of Object.entries(obj || {})) {
        if (v === undefined || v === null || v === "") continue;
        cleaned[k] = v;
    }

    const sortedKeys = Object.keys(cleaned).sort();
    const result = {};
    for (const key of sortedKeys) {
        const encodedKey = encodeURIComponent(key).replace(/%20/g, "+");
        const encodedVal = encodeURIComponent(String(cleaned[key])).replace(/%20/g, "+");
        result[encodedKey] = encodedVal;
    }
    return result;
};

/**
 * Xây dựng URL thanh toán VNPay.
 * @param {{ amount: number, orderId: string, ipAddr: string, orderInfo?: string }} opts
 * @returns {{ paymentUrl: string, txnRef: string }}
 */
export const buildVNPayUrl = ({ amount, orderId, ipAddr, orderInfo = "Thanh toan don hang" }) => {
    const tmnCode = process.env.VNP_TMN_CODE;
    const secretKey = process.env.VNP_HASH_SECRET;
    const vnpUrl = process.env.VNP_URL;
    const returnUrl = process.env.VNP_RETURN_URL;

    if (!tmnCode || !secretKey || !vnpUrl || !returnUrl) {
        throw new Error("Thiếu cấu hình VNPay trong .env (VNP_TMN_CODE, VNP_HASH_SECRET, VNP_URL, VNP_RETURN_URL)");
    }

    const now = new Date();
    const txnRef = `${orderId}_${now.getTime()}`;
    const createDate = formatVNDate(now);

    const params = {
        vnp_Version: "2.1.0",
        vnp_Command: "pay",
        vnp_TmnCode: tmnCode,
        vnp_Amount: String(Math.round(amount) * 100),
        vnp_CreateDate: createDate,
        vnp_CurrCode: "VND",
        vnp_IpAddr: String(ipAddr || "127.0.0.1").replace("::ffff:", ""),
        vnp_Locale: "vn",
        vnp_OrderInfo: orderInfo.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 255),
        vnp_OrderType: "other",
        vnp_ReturnUrl: returnUrl,
        vnp_TxnRef: txnRef,
    };

    const sorted = sortObject(params);
    // Theo mẫu VNPay: stringify không encode lại lần nữa
    const signData = querystring.stringify(sorted, undefined, undefined, { encodeURIComponent: (s) => s });
    const secureHash = hmacSHA512(secretKey, signData);
    const query = `${signData}&vnp_SecureHash=${secureHash}`;
    const paymentUrl = `${vnpUrl}?${query}`;
    return { paymentUrl, txnRef };
};

/**
 * Xác minh chữ ký VNPay từ query params callback.
 * @param {Record<string, string>} query - req.query từ Express
 * @returns {boolean}
 */
export const verifyVNPaySignature = (query) => {
    const { vnp_SecureHash, vnp_SecureHashType, ...rest } = query;
    if (!vnp_SecureHash) return false;

    const sorted = sortObject(rest);
    const signData = querystring.stringify(sorted, undefined, undefined, { encodeURIComponent: (s) => s });
    const expected = hmacSHA512(process.env.VNP_HASH_SECRET, signData);

    return expected.toLowerCase() === vnp_SecureHash.toLowerCase();
};
