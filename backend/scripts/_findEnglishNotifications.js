import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import connectDB from "../config/mongodb.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

await connectDB();
const notifications = await mongoose.connection.collection("notifications")
  .find({ $or: [ { title: /buyer confirmed receipt/i }, { message: /the buyer confirmed receipt/i }, { title: /order update/i }, { message: /your order .* is now/i } ] })
  .toArray();
console.log(JSON.stringify(notifications, null, 2));
await mongoose.disconnect();
