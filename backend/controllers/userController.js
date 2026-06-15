import {
    loginUserService,
    loginWithGoogleService,
    registerUserService,
    verifyEmailService,
    registerVendorService,
    getUserProfileService,
    updateUserProfileService,
    requestPasswordResetService,
    resetPasswordWithTokenService,
    deleteUserService,
    refreshAccessTokenService,
    getNotificationPrefsService,
    updateNotificationPrefsService,
    changePasswordService,
} from "../services/userService.js";
import { revokeAuthSession } from "../services/authSessionService.js";

const toBoolean = (value, fallback = false) => {
    if (value === undefined || value === null || value === "") return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    return fallback;
};

const resolveSameSite = () => {
    const raw = String(process.env.COOKIE_SAME_SITE || "lax").trim().toLowerCase();
    if (raw === "strict" || raw === "lax" || raw === "none") return raw;
    return "lax";
};

const sameSite = resolveSameSite();
const secureByEnv = toBoolean(process.env.COOKIE_SECURE, process.env.NODE_ENV === "production");
const secure = sameSite === "none" ? true : secureByEnv;

const COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite,
    secure,
};

const clearAuthCookies = (res) => {
    res.clearCookie("accessToken", COOKIE_OPTIONS);
    res.clearCookie("refreshToken", COOKIE_OPTIONS);
};

const attachAuthCookies = (res, { accessToken, refreshToken }) => {
    const accessMaxAge = Number(process.env.JWT_ACCESS_COOKIE_MAX_AGE_MS || 15 * 60 * 1000);
    const refreshMaxAge = Number(process.env.JWT_REFRESH_COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000);

    res.cookie("accessToken", accessToken, { ...COOKIE_OPTIONS, maxAge: accessMaxAge });
    res.cookie("refreshToken", refreshToken, { ...COOKIE_OPTIONS, maxAge: refreshMaxAge });
};

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const tokens = await loginUserService(email, password);
        attachAuthCookies(res, tokens);
        res.json({ success: true, accessToken: tokens.accessToken });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const loginWithGoogle = async (req, res) => {
    try {
        const { credential } = req.body;
        const tokens = await loginWithGoogleService(credential);
        attachAuthCookies(res, tokens);
        res.json({ success: true, accessToken: tokens.accessToken });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const result = await registerUserService(name, email, password);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const verifyEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const tokens = await verifyEmailService(email, otp);
        attachAuthCookies(res, tokens);
        res.json({ success: true, accessToken: tokens.accessToken });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const registerVendor = async (req, res) => {
    try {
        const { shopName, shopAddress, phone } = req.body;
        const userId = req.userId;
        await registerVendorService(userId, shopName, shopAddress, phone);
        res.json({ success: true, message: "Vendor registered successfully" });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const getUserProfile = async (req, res) => {
    try {
        const user = await getUserProfileService(req.userId);
        res.json({ success: true, user });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const updateUserProfile = async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        const userId = req.userId;
        await updateUserProfileService(userId, { name, email, phone }, req.file);
        const user = await getUserProfileService(userId);
        res.json({ success: true, message: "Profile updated successfully", user });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        await requestPasswordResetService(email);
        res.json({
            success: true,
            message:
                "Nếu email đã đăng ký, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.",
        });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        await resetPasswordWithTokenService(token, password);
        res.json({ success: true, message: "Đặt lại mật khẩu thành công." });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const deleteUser = async (req, res) => {
    try {
        await deleteUserService(req.params.id);
        res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const refreshAuth = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        const tokens = await refreshAccessTokenService(refreshToken);
        attachAuthCookies(res, tokens);
        res.json({ success: true, accessToken: tokens.accessToken });
    } catch (error) {
        clearAuthCookies(res);
        res.status(401).json({ success: false, message: error.message });
    }
};

const logoutUser = async (req, res) => {
    await revokeAuthSession({
        accessToken: req.cookies?.accessToken || req.headers?.token,
        refreshToken: req.cookies?.refreshToken,
    }).catch(() => {});
    clearAuthCookies(res);
    res.json({ success: true, message: "Logged out successfully" });
};

const changePassword = async (req, res) => {
    try {
        const userId = req.userId;
        const { currentPassword, newPassword } = req.body;
        await changePasswordService(userId, currentPassword, newPassword);
        res.json({ success: true, message: "Đổi mật khẩu thành công" });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const getNotificationPrefs = async (req, res) => {
    try {
        const userId = req.userId;
        const prefs = await getNotificationPrefsService(userId);
        res.json({ success: true, prefs });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

const updateNotificationPrefs = async (req, res) => {
    try {
        const userId = req.userId;
        const prefs = await updateNotificationPrefsService(userId, req.body);
        res.json({ success: true, prefs });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

export {
    loginUser,
    registerUser,
    verifyEmail,
    registerVendor,
    getUserProfile,
    updateUserProfile,
    loginWithGoogle,
    forgotPassword,
    resetPassword,
    deleteUser,
    refreshAuth,
    logoutUser,
    getNotificationPrefs,
    updateNotificationPrefs,
    changePassword,
};
