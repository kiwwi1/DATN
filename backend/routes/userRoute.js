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
    deleteUser,
    refreshAuth,
    logoutUser,
} from '../controllers/userController.js';
import authUser from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';
import {
    loginRateLimit,
    verifyEmailRateLimit,
    forgotPasswordRateLimit,
    resetPasswordRateLimit,
    refreshAuthRateLimit,
} from '../middleware/authRateLimit.js';
const userRouter = express.Router();

userRouter.post('/login', ...loginRateLimit, loginUser);
userRouter.post('/register', registerUser);
userRouter.post('/verify-email', ...verifyEmailRateLimit, verifyEmail);
userRouter.post('/register-vendor', authUser, registerVendor);
userRouter.post('/profile', authUser, getUserProfile);
userRouter.post('/update-profile', authUser, updateUserProfile);
userRouter.post('/google', loginWithGoogle);
userRouter.post('/forgot-password', ...forgotPasswordRateLimit, forgotPassword);
userRouter.post('/reset-password', ...resetPasswordRateLimit, resetPassword);
userRouter.post('/refresh', ...refreshAuthRateLimit, refreshAuth);
userRouter.post('/logout', logoutUser);
userRouter.delete('/delete/:id', adminAuth, deleteUser);
export default userRouter;
