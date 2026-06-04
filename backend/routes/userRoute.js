import express from 'express';
import {
    loginUser,
    registerUser,
    verifyEmail,
    registerVendor,
    getUserProfile,
    updateUserProfile,
    loginWithGoogle,
    forgotPassword,
    resetPassword,
    refreshAuth,
    logoutUser,
} from '../controllers/userController.js';
import authUser from '../middleware/auth.js';
import upload from '../middleware/multer.js';
import {
    loginRateLimit,
    verifyEmailRateLimit,
    forgotPasswordRateLimit,
    resetPasswordRateLimit,
    refreshAuthRateLimit,
    registerRateLimit,
    registerVendorRateLimit,
} from '../middleware/authRateLimit.js';
const userRouter = express.Router();

userRouter.post('/login', ...loginRateLimit, loginUser);
userRouter.post('/register', ...registerRateLimit, registerUser);
userRouter.post('/verify-email', ...verifyEmailRateLimit, verifyEmail);
userRouter.post('/register-vendor', authUser, ...registerVendorRateLimit, registerVendor);
userRouter.post('/profile', authUser, getUserProfile);
userRouter.post('/update-profile', authUser, upload.single('avatar'), updateUserProfile);
userRouter.post('/google', loginWithGoogle);
userRouter.post('/forgot-password', ...forgotPasswordRateLimit, forgotPassword);
userRouter.post('/reset-password', ...resetPasswordRateLimit, resetPassword);
userRouter.post('/refresh', ...refreshAuthRateLimit, refreshAuth);
userRouter.post('/logout', logoutUser);
export default userRouter;
