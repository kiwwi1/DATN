import express from 'express';
import {
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
} from '../controllers/userController.js';
import authUser from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';
const userRouter = express.Router();

userRouter.post('/login', loginUser);
userRouter.post('/register', registerUser);
userRouter.post('/admin', loginAdmin);
userRouter.post('/register-vendor', authUser, registerVendor);
userRouter.post('/profile', authUser, getUserProfile);
userRouter.post('/update-profile', authUser, updateUserProfile);
userRouter.post('/google', loginWithGoogle);
userRouter.post('/forgot-password', forgotPassword);
userRouter.post('/reset-password', resetPassword);
userRouter.delete('/delete/:id', adminAuth, deleteUser);
export default userRouter;
