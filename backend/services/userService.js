import crypto from "crypto";
import userModel from "../models/userModel.js";
import { sanitizeCartData } from "./cartService.js";
import validator from "validator";
import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import { sendPasswordResetEmail, sendVerificationEmail } from "../utils/sendResetEmail.js";
import { ensureUserDeletable } from "./deletionGuardService.js";
import { uploadToR2 } from "../utils/r2Upload.js";
import {
    issueAuthSessionTokens,
    refreshAuthSessionTokens,
} from "./authSessionService.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const normalizeShopName = (shopName) =>
    String(shopName || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();

// Lỗi chung cho cả email không tồn tại lẫn sai mật khẩu — không tiết lộ
// trường nào sai để chống dò tìm tài khoản (đặc tả UC1, luồng ngoại lệ).
const buildInvalidCredentialsError = () =>
    Object.assign(new Error("Invalid credentials"), { status: 401, code: "INVALID_CREDENTIALS" });

export const loginUserService = async (email, password) => {
    const user = await userModel.findOne({ email }).select("+emailVerified");
    if (!user) throw buildInvalidCredentialsError();
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw buildInvalidCredentialsError();
    if (!user.emailVerified) {
        throw Object.assign(
            new Error("Email chưa được xác minh. Vui lòng kiểm tra hộp thư và nhập mã OTP."),
            { status: 403, code: "EMAIL_NOT_VERIFIED" }
        );
    }
    return issueAuthSessionTokens(user._id);
};

export const loginWithGoogleService = async (credential) => {
    const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { sub: googleId, email, name } = ticket.getPayload();
    let user = await userModel.findOne({ $or: [{ googleId }, { email }] });
    if (!user) {
        user = await userModel.create({
            name,
            email,
            googleId,
            password: await bcrypt.hash(googleId + Date.now(), 10),
        });
    } else if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
    }
    return issueAuthSessionTokens(user._id);
};

const OTP_EXPIRE_MS = 15 * 60 * 1000; // 15 phút

const generateOtp = () =>
    String(Math.floor(100000 + Math.random() * 900000));

const validatePasswordOrThrow = (password) => {
    if (!password || password.length < 8) {
        throw Object.assign(new Error("Mật khẩu phải có ít nhất 8 ký tự"), { status: 400 });
    }
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);
    if (!hasLetter || !hasNumber) {
        throw Object.assign(new Error("Mật khẩu cần gồm cả chữ và số"), { status: 400 });
    }
};

export const registerUserService = async (name, email, password) => {
    if (!validator.isEmail(email)) throw Object.assign(new Error("Địa chỉ email không hợp lệ"), { status: 400 });
    validatePasswordOrThrow(password);

    const exists = await userModel
        .findOne({ email })
        .select("+emailVerified +emailVerificationToken +emailVerificationExpires");

    if (exists) {
        if (exists.emailVerified) throw Object.assign(new Error("Email này đã được đăng ký"), { status: 409, code: "EMAIL_TAKEN" });
        // Tài khoản tồn tại nhưng chưa xác minh → gửi lại OTP
        const otp = generateOtp();
        exists.emailVerificationToken = otp;
        exists.emailVerificationExpires = new Date(Date.now() + OTP_EXPIRE_MS);
        await exists.save();
        await sendVerificationEmail(email, otp);
        return { requiresVerification: true };
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const otp = generateOtp();

    await userModel.create({
        name,
        email,
        password: hashedPassword,
        emailVerified: false,
        emailVerificationToken: otp,
        emailVerificationExpires: new Date(Date.now() + OTP_EXPIRE_MS),
    });

    await sendVerificationEmail(email, otp);
    return { requiresVerification: true };
};

export const verifyEmailService = async (email, otp) => {
    const user = await userModel
        .findOne({ email })
        .select("+emailVerified +emailVerificationToken +emailVerificationExpires");

    if (!user) throw Object.assign(new Error("Email không tồn tại"), { status: 404 });
    if (user.emailVerified) throw Object.assign(new Error("Email đã được xác minh trước đó"), { status: 400 });
    if (!user.emailVerificationToken || user.emailVerificationToken !== otp) {
        throw Object.assign(new Error("Mã OTP không đúng"), { status: 400, code: "INVALID_OTP" });
    }
    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
        throw Object.assign(new Error("Mã OTP đã hết hạn. Vui lòng đăng ký lại để nhận mã mới"), { status: 400, code: "OTP_EXPIRED" });
    }

    await userModel.updateOne(
        { _id: user._id },
        {
            $set: { emailVerified: true },
            $unset: { emailVerificationToken: "", emailVerificationExpires: "" },
        }
    );

    return issueAuthSessionTokens(user._id);
};

export const registerVendorService = async (userId, shopName, shopAddress, phone) => {
    const trimmedShopName = String(shopName || "").trim().replace(/\s+/g, " ");
    const normalizedShopName = normalizeShopName(trimmedShopName);
    if (!trimmedShopName) throw Object.assign(new Error("Shop name is required"), { status: 400 });

    const user = await userModel.findById(userId);
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    if (user.role === "vendor") {
        throw Object.assign(
            new Error("Tài khoản đã là nhà bán hàng. Vui lòng truy cập Vendor Dashboard."),
            { status: 400, code: "ALREADY_VENDOR" }
        );
    }
    const buildShopNameTakenError = () =>
        Object.assign(
            new Error("Tên cửa hàng đã tồn tại, vui lòng chọn tên khác"),
            { status: 409, code: "SHOP_NAME_TAKEN" }
        );
    const existingShop = await userModel.findOne({
        shopNameNormalized: normalizedShopName,
        _id: { $ne: userId },
    });
    if (existingShop) throw buildShopNameTakenError();
    user.shopName = trimmedShopName;
    user.shopNameNormalized = normalizedShopName;
    user.shopAddress = String(shopAddress || "").trim();
    user.phone = String(phone || "").trim();
    user.role = "vendor";
    try {
        await user.save();
    } catch (error) {
        if (error?.code === 11000 && error?.keyPattern?.shopNameNormalized) {
            throw buildShopNameTakenError();
        }
        throw error;
    }
};

export const getUserProfileService = async (userId) => {
    const user = await userModel.findById(userId).select("-password").lean();
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    const cleanCart = await sanitizeCartData(user.cartData || {});
    if (Object.keys(cleanCart).length !== Object.keys(user.cartData || {}).length) {
        await userModel.findByIdAndUpdate(userId, { $set: { cartData: cleanCart } });
    }
    return { ...user, cartData: cleanCart };
};

export const updateUserProfileService = async (userId, { name, email, phone }, avatarFile) => {
    const user = await userModel.findById(userId);
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (avatarFile) {
        const avatar = await uploadToR2(avatarFile, "avatars");
        user.avatar = avatar;
    }
    await user.save();
    return user;
};

export const refreshAccessTokenService = async (refreshToken) => {
    if (!refreshToken) throw Object.assign(new Error("Unauthorized"), { status: 401, code: "UNAUTHORIZED" });
    const tokens = await refreshAuthSessionTokens(refreshToken);
    const user = await userModel.findById(tokens.userId).select("_id");
    if (!user) throw Object.assign(new Error("Unauthorized"), { status: 401, code: "UNAUTHORIZED" });
    return tokens;
};

const RESET_EXPIRE_MS = 60 * 60 * 1000; // 1 giờ

/** Luôn trả thành công (không lộ email có tồn tại hay không) */
export const requestPasswordResetService = async (email) => {
    const trimmed = email?.trim();
    if (!trimmed || !validator.isEmail(trimmed)) return;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const user = await userModel.findOne({
        email: new RegExp(`^${escaped}$`, "i"),
    });
    if (!user) return;

    const token = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = token;
    user.passwordResetExpires = new Date(Date.now() + RESET_EXPIRE_MS);
    await user.save();

    const rawBase = process.env.FRONTEND_URL?.replace(/\/$/, "") || "http://localhost:5173";
    try {
        const parsed = new URL(rawBase);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            throw new Error("invalid protocol");
        }
    } catch {
        throw Object.assign(new Error("FRONTEND_URL không hợp lệ"), { status: 500 });
    }
    const base = rawBase;
    const resetUrl = `${base}/reset-password?token=${token}`;

    try {
        await sendPasswordResetEmail(user.email, resetUrl);
    } catch (e) {
        await userModel.updateOne(
            { _id: user._id },
            { $unset: { passwordResetToken: "", passwordResetExpires: "" } }
        );
        throw e;
    }
};

export const resetPasswordWithTokenService = async (token, newPassword) => {
    if (!token || typeof token !== "string") throw Object.assign(new Error("Token không hợp lệ"), { status: 400 });
    validatePasswordOrThrow(newPassword);
    const user = await userModel
        .findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: new Date() },
        })
        .select("+passwordResetToken +passwordResetExpires password");
    if (!user) throw Object.assign(new Error("Liên kết không hợp lệ hoặc đã hết hạn"), { status: 400, code: "RESET_TOKEN_INVALID" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await userModel.updateOne(
        { _id: user._id },
        {
            $set: { password: hashed },
            $unset: { passwordResetToken: "", passwordResetExpires: "" },
        }
    );
};

export const deleteUserService = async (userId) => {
    const user = await userModel.findById(userId);
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

    await ensureUserDeletable(userId);
    await userModel.findByIdAndDelete(userId);
};

export const changePasswordService = async (userId, currentPassword, newPassword) => {
    validatePasswordOrThrow(newPassword);
    const user = await userModel.findById(userId).select("+password");
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    if (!user.password) throw Object.assign(new Error("Tài khoản này đăng nhập bằng Google, không có mật khẩu để đổi"), { status: 400 });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw Object.assign(new Error("Mật khẩu hiện tại không đúng"), { status: 400 });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
};

export const getNotificationPrefsService = async (userId) => {
    const user = await userModel.findById(userId).select("notificationPrefs").lean();
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    return user.notificationPrefs ?? { emailPriceDrop: true };
};

export const updateNotificationPrefsService = async (userId, prefs) => {
    const allowed = ["emailPriceDrop"];
    const update = {};
    for (const key of allowed) {
        if (typeof prefs[key] === "boolean") {
            update[`notificationPrefs.${key}`] = prefs[key];
        }
    }
    if (!Object.keys(update).length) throw Object.assign(new Error("Không có tuỳ chọn hợp lệ"), { status: 400 });
    const user = await userModel.findByIdAndUpdate(
        userId,
        { $set: update },
        { new: true, select: "notificationPrefs" }
    ).lean();
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    return user.notificationPrefs;
};
