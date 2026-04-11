import {
    loginUserService,
    loginWithGoogleService,
    registerUserService,
    registerVendorService,
    getUserProfileService,
    updateUserProfileService,
    loginAdminService,
    requestPasswordResetService,
    resetPasswordWithTokenService,
    deleteUserService,
} from "../services/userService.js";

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const token = await loginUserService(email, password);
        res.json({ success: true, token });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const loginWithGoogle = async (req, res) => {
    try {
        const { credential } = req.body;
        const token = await loginWithGoogleService(credential);
        res.json({ success: true, token });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const token = await registerUserService(name, email, password);
        res.json({ success: true, token });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const registerVendor = async (req, res) => {
    try {
        const { shopName, shopAddress, phone, userId } = req.body;
        await registerVendorService(userId, shopName, shopAddress, phone);
        res.json({ success: true, message: "Vendor registered successfully" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const getUserProfile = async (req, res) => {
    try {
        const user = await getUserProfileService(req.body.userId);
        res.json({ success: true, user });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const updateUserProfile = async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        await updateUserProfileService(req.body.userId, { name, email, phone });
        res.json({ success: true, message: "Profile updated successfully" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const token = loginAdminService(email, password);
        res.json({ success: true, token });
    } catch (error) {
        res.json({ success: false, message: error.message });
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
        res.json({ success: false, message: error.message });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        await resetPasswordWithTokenService(token, password);
        res.json({ success: true, message: "Đặt lại mật khẩu thành công." });
    } catch (error) {
        res.json({ success: false, message: error.message });
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

export {
    loginUser,
    registerUser,
    loginAdmin,
    registerVendor,
    getUserProfile,
    updateUserProfile,
    loginWithGoogle,
    forgotPassword,
    resetPassword,
    deleteUser,
};
