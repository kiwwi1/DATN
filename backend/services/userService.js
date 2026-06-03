import crypto from "crypto";
import userModel from "../models/userModel.js";
import { sanitizeCartData } from "./cartService.js";
import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { sendPasswordResetEmail, sendVerificationEmail } from "../utils/sendResetEmail.js";
import { ensureUserDeletable } from "./deletionGuardService.js";
import { uploadToR2 } from "../utils/r2Upload.js";

const ACCESS_TOKEN_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_TOKEN_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "7d";

const createAccessToken = (id) =>
    jwt.sign({ id, type: "access" }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });

const createRefreshToken = (id) =>
    jwt.sign({ id, type: "refresh" }, process.env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES });

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const loginUserService = async (email, password) => {
    const user = await userModel.findOne({ email }).select("+emailVerified");
    if (!user) throw new Error("User does not exist");
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error("Invalid credentials");
    if (!user.emailVerified) throw new Error("Email chưa được xác minh. Vui lòng kiểm tra hộp thư và nhập mã OTP.");
    return {
        accessToken: createAccessToken(user._id),
        refreshToken: createRefreshToken(user._id),
    };
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
    return {
        accessToken: createAccessToken(user._id),
        refreshToken: createRefreshToken(user._id),
    };
};

const OTP_EXPIRE_MS = 15 * 60 * 1000; // 15 phút

const generateOtp = () =>
    String(Math.floor(100000 + Math.random() * 900000));

const validatePasswordOrThrow = (password) => {
    if (!password || password.length < 8) {
        throw new Error("Mật khẩu phải có ít nhất 8 ký tự");
    }
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);
    if (!hasLetter || !hasNumber) {
        throw new Error("Mật khẩu cần gồm cả chữ và số");
    }
};

export const registerUserService = async (name, email, password) => {
    if (!validator.isEmail(email)) throw new Error("Địa chỉ email không hợp lệ");
    validatePasswordOrThrow(password);

    const exists = await userModel
        .findOne({ email })
        .select("+emailVerified +emailVerificationToken +emailVerificationExpires");

    if (exists) {
        if (exists.emailVerified) throw new Error("Email này đã được đăng ký");
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

    if (!user) throw new Error("Email không tồn tại");
    if (user.emailVerified) throw new Error("Email đã được xác minh trước đó");
    if (!user.emailVerificationToken || user.emailVerificationToken !== otp) {
        throw new Error("Mã OTP không đúng");
    }
    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
        throw new Error("Mã OTP đã hết hạn. Vui lòng đăng ký lại để nhận mã mới");
    }

    await userModel.updateOne(
        { _id: user._id },
        {
            $set: { emailVerified: true },
            $unset: { emailVerificationToken: "", emailVerificationExpires: "" },
        }
    );

    return {
        accessToken: createAccessToken(user._id),
        refreshToken: createRefreshToken(user._id),
    };
};

export const registerVendorService = async (userId, shopName, shopAddress, phone) => {
    const user = await userModel.findById(userId);
    if (!user) throw new Error("User not found");
    const existingShop = await userModel.findOne({ shopName, _id: { $ne: userId } });
    if (existingShop) throw new Error("Tên cửa hàng đã tồn tại, vui lòng chọn tên khác");
    user.shopName = shopName;
    user.shopAddress = shopAddress;
    user.phone = phone;
    user.role = "vendor";
    await user.save();
};

export const getUserProfileService = async (userId) => {
    const user = await userModel.findById(userId).select("-password").lean();
    if (!user) throw new Error("User not found");
    const cleanCart = await sanitizeCartData(user.cartData || {});
    if (Object.keys(cleanCart).length !== Object.keys(user.cartData || {}).length) {
        await userModel.findByIdAndUpdate(userId, { $set: { cartData: cleanCart } });
    }
    return { ...user, cartData: cleanCart };
};

export const updateUserProfileService = async (userId, { name, email, phone }, avatarFile) => {
    const user = await userModel.findById(userId);
    if (!user) throw new Error("User not found");
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
    if (!refreshToken) throw new Error("Unauthorized");

    let decoded;
    try {
        decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
        throw new Error("Invalid refresh token");
    }

    if (decoded?.type !== "refresh" || !decoded?.id) {
        throw new Error("Invalid refresh token");
    }

    const user = await userModel.findById(decoded.id).select("_id");
    if (!user) throw new Error("User not found");

    return createAccessToken(user._id);
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

    const base =
        process.env.FRONTEND_URL?.replace(/\/$/, "") ||
        "http://localhost:5173";
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
    if (!token || typeof token !== "string") throw new Error("Token không hợp lệ");
    validatePasswordOrThrow(newPassword);
    const user = await userModel
        .findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: new Date() },
        })
        .select("+passwordResetToken +passwordResetExpires password");
    if (!user) throw new Error("Liên kết không hợp lệ hoặc đã hết hạn");

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
