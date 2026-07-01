import connectDB from '../config/mongodb.js';
import userModel from '../models/userModel.js';
import categoryModel from '../models/categoryModel.js';

await connectDB();

const apple = await userModel.findOne({ shopName: { $regex: /apple/i } }).lean();
console.log('Apple vendor:', JSON.stringify({
  _id: apple?._id,
  name: apple?.name,
  shopName: apple?.shopName,
  email: apple?.email,
  role: apple?.role
}, null, 2));

const cats = await categoryModel.find({ level: 1 }).select('_id name').lean();
console.log('Level-1 categories:', JSON.stringify(cats.map(c => ({ _id: c._id, name: c.name })), null, 2));

process.exit(0);
