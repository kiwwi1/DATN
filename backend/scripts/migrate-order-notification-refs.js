/**
 * Chạy một lần nếu DB cũ đang lưu order.userId / notification.orderId dạng string.
 * Sau khi đổi schema sang ObjectId + ref, query theo userId ObjectId sẽ không khớp BSON string.
 *
 *   npm run migrate-refs
 */
import mongoose from "mongoose";
import "dotenv/config";
import connectDB from "../config/mongodb.js";

const isHexObjectId = (v) =>
    typeof v === "string" && /^[a-fA-F0-9]{24}$/.test(v);

async function migrate() {
    await connectDB();
    const db = mongoose.connection.db;

    const orders = db.collection("orders");
    let ordersUpdated = 0;
    const orderCursor = orders.find({ userId: { $type: "string" } });
    for await (const doc of orderCursor) {
        if (!isHexObjectId(doc.userId)) continue;
        await orders.updateOne(
            { _id: doc._id },
            { $set: { userId: new mongoose.Types.ObjectId(doc.userId) } }
        );
        ordersUpdated += 1;
    }
    console.log(`orders: đã chuyển userId string → ObjectId: ${ordersUpdated} bản ghi`);

    const notifs = db.collection("notifications");
    let notifsUpdated = 0;
    const notifCursor = notifs.find({ orderId: { $type: "string" } });
    for await (const doc of notifCursor) {
        if (!doc.orderId || !isHexObjectId(doc.orderId)) continue;
        await notifs.updateOne(
            { _id: doc._id },
            { $set: { orderId: new mongoose.Types.ObjectId(doc.orderId) } }
        );
        notifsUpdated += 1;
    }
    console.log(`notifications: đã chuyển orderId string → ObjectId: ${notifsUpdated} bản ghi`);

    await mongoose.disconnect();
    process.exit(0);
}

migrate().catch((e) => {
    console.error(e);
    process.exit(1);
});
