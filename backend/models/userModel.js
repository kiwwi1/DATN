import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {type: String, required: true},
    email: {type: String, required: true, unique: true},
    googleId: {type: String, required: false},
    password: {type: String, required: false},
    cartData: {type: Object, default: {}},
    avatar: {
        main: { type: String },
        thumb: { type: String },
        width: { type: Number },
        height: { type: Number },
        format: { type: String },
    },
    role: {type: String, enum: ['user', 'vendor'], default: 'user'},
    // Vendor-specific fields (only used when role is 'vendor')
    shopName: {type: String},
    shopAddress: {type: String},
    phone: {type: String},
    telegramChatId: {type: String},
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
},{minimize: false})
// {minimize: false} is used to allow empty objects in the schema
const userModel = mongoose.model.user || mongoose.model('user', userSchema)
export default userModel;
