import crypto from "crypto";
import userModel from "../models/userModel.js";
import { sanitizeCartData } from "./cartService.js";
import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { sendPasswordResetEmail } from "../utils/sendResetEmail.js";
import { ensureUserDeletable } from "./deletionGuardService.js";

const createToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET);

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const loginUserService = async (email, password) => {
    const user = await userModel.findOne({ email });
    if (!user) throw new Error("User does not exist");
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error("Invalid credentials");
    return createToken(user._id);
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
    return createToken(user._id);
};

export const registerUserService = async (name, email, password) => {
    const exists = await userModel.findOne({ email });
    if (exists) throw new Error("User already exists");
    if (!validator.isEmail(email)) throw new Error("Please enter a valid email");
    if (password.length < 8) throw new Error("Please enter a strong password");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = await userModel.create({ name, email, password: hashedPassword });
    return createToken(user._id);
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

export const updateUserProfileService = async (userId, { name, email, phone }) => {
    const user = await userModel.findById(userId);
    if (!user) throw new Error("User not found");
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    await user.save();
    return user;
};

export const loginAdminService = (email, password) => {
    if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
        throw new Error("Invalid credentials");
    }
    return jwt.sign(email + password, process.env.JWT_SECRET);
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
    if (!newPassword || newPassword.length < 8) {
        throw new Error("Mật khẩu tối thiểu 8 ký tự");
    }
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
