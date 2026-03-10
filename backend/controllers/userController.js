import userModel from "../models/userModel.js";
import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { OAuth2Client } from "google-auth-library";

const createToken = (id) => {
    return jwt.sign(
        {id},process.env.JWT_SECRET
    )
}
// Route for user login
const loginUser = async (req,res) =>{
    try {
        const {email,password} = req.body;
    const user = await userModel.findOne({email})
    if(!user){
        return res.json({success:false, message: 'User does not exist'})
    }
    const isMatch = await bcrypt.compare(password,user.password)
    if(isMatch){
        const token = createToken(user._id)
        return res.json({success:true, token})
    }
    else{
        res.json({success:false, message: 'Invalid credentials'})
    }
        
    } catch (error) {
        console.log(error)
        res.json({success:false, message:error.message}) 
    }
    
    


}

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const loginWithGoogle = async (req, res) => {
    try {
        const { credential } = req.body; // Google ID token từ frontend
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const { sub: googleId, email, name, picture } = ticket.getPayload();
        // Tìm hoặc tạo user
        let user = await userModel.findOne({ $or: [{ googleId }, { email }] });
        if (!user) {
            user = await userModel.create({
                name,
                email,
                googleId,
                password: await bcrypt.hash(googleId + Date.now(), 10), // dummy password
            });
        } else if (!user.googleId) {
            // User đã đăng ký bằng email → liên kết Google
            user.googleId = googleId;
            await user.save();
        }
        const token = createToken(user._id);
        res.json({ success: true, token });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Route for user registration
const registerUser = async (req,res) =>{
    try {
        const{name,email,password} = req.body;
        // checking user already exists
        const exists = await userModel.findOne({email})
        if(exists){
            return res.json({success:false, message: 'User already exists'})
        }
        // validating email format and strong password
        if(!validator.isEmail(email)){
            return res.json({success:false, message: 'Please enter a valid email'})
        }
        if(password.length < 8){
            return res.json({success:false, message: 'Please enter a strong password'})
        }

        // hashing user password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        // creating user
        const newUser = new userModel({
            name,
            email,
            password: hashedPassword
        })

        const user = await newUser.save();
        //gen bang id cua user
        const token = createToken(user._id)

        res.json({success:true,token})



    } catch (error) {
        console.log(error)
        res.json({success:false, message:error.message})
    }
}

const registerVendor = async (req,res) =>{
    try {
        const {shopName,shopAddress,phone,userId} = req.body;
        
        // Kiểm tra user có tồn tại không
        const user = await userModel.findById(userId);
        if(!user){
            return res.json({success:false, message: 'User not found'})
        }
        
        // Kiểm tra shopName đã tồn tại chưa (loại trừ user hiện tại)
        const existingShop = await userModel.findOne({
            shopName: shopName,
            _id: { $ne: userId } // Loại trừ user hiện tại
        });
        
        if(existingShop){
            return res.json({success:false, message: 'Tên cửa hàng đã tồn tại, vui lòng chọn tên khác'})
        }
        
        user.shopName = shopName;
        user.shopAddress = shopAddress;
        user.phone = phone;
        user.role = 'vendor'; // Cập nhật role thành vendor
        await user.save();  
        res.json({success:true, message: 'Vendor registered successfully'})
    } catch (error) {
        console.log(error)
        res.json({success:false, message:error.message})
    }    
}

// Route to get user profile
const getUserProfile = async (req, res) => {
    try {
        const user = await userModel.findById(req.body.userId).select('-password');
        if (!user) {
            return res.json({success: false, message: 'User not found'});
        }
        res.json({success: true, user});
    } catch (error) {
        console.log(error);
        res.json({success: false, message: error.message});
    }
}


const updateUserProfile = async (req,res) =>{
    try {
        const {name,email,phone} = req.body;
        const user = await userModel.findById(req.body.userId);
        if(name){
            user.name = name;
        }
        if(email){
            user.email = email;
        }
        if(phone){
            user.phone = phone;
        }
        await user.save();
        
        if(!user){
            return res.json({success: false, message: 'User not found'});
        }
    }
    catch (error) {
        console.log(error);
        res.json({success: false, message: error.message});
    }
}

// Route for admin login
const loginAdmin = async (req,res) =>{
    try {
       const {email,password} = req.body;
       if(email == process.env.ADMIN_EMAIL && password == process.env.ADMIN_PASSWORD){
        const token = jwt.sign(email+password,process.env.JWT_SECRET)
        res.json({success:true, token})
    }
    else{
        res.json({success:false, message: 'Invalid credentials'})
    }
    } catch (error) {
        console.log(error)
        res.json({success:false, message:error.message})
    }
}


export {loginUser, registerUser ,loginAdmin, registerVendor, getUserProfile, updateUserProfile, loginWithGoogle}