import express from 'express';
import { loginUser,registerUser,loginAdmin, registerVendor, getUserProfile, updateUserProfile, loginWithGoogle } from '../controllers/userController.js';
import authUser from '../middleware/auth.js';
const userRouter = express.Router();

userRouter.post('/login', loginUser);
userRouter.post('/register', registerUser);
userRouter.post('/admin', loginAdmin);
userRouter.post('/register-vendor', authUser, registerVendor);
userRouter.post('/profile', authUser, getUserProfile);
userRouter.post('/update-profile', authUser, updateUserProfile);
userRouter.post('/google', loginWithGoogle);
export default userRouter;
