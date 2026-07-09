import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import connectDB from "../config/mongodb.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

await connectDB();
const notifications = await mongoose.connection.collection("notifications")
  .find({ title: /1F04C6/i }, { projection: { title: 1, message: 1, type: 1 } })
  .toArray();
console.log(JSON.stringify(notifications, null, 2));
await mongoose.disconnect();
