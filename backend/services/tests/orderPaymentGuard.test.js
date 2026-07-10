import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { markStripeOrderPaid } from "../orderService.js";
import orderModel from "../../models/orderModel.js";
import productModel from "../../models/productModel.js";
import notificationModel from "../../models/notificationModel.js";

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    await orderModel.deleteMany({});
    await productModel.deleteMany({});
    await notificationModel.deleteMany({});
});

const userId = new mongoose.Types.ObjectId();
const productId = new mongoose.Types.ObjectId();

const createStripeOrder = (overrides = {}) => orderModel.create({
    userId,
    items: [{ _id: String(productId), name: "SP test", price: 100000, quantity: 1 }],
    amount: 100000,
    address: {},
    paymentMethod: "Stripe",
    payment: false,
    date: Date.now(),
    status: "Order Placed",
    ...overrides,
});

describe("markStripeOrderPaid — guard don da huy (loi thanh toan tre)", () => {
    it("don da Cancelled: KHONG danh dau paid, khong tang sold", async () => {
        await productModel.create({
            _id: productId,
            name: "SP test",
            description: "t",
            price: 100000,
            image: [],
            category: new mongoose.Types.ObjectId(),
            date: Date.now(),
            isActive: true,
            vendorId: new mongoose.Types.ObjectId(),
            sold: 0,
        });
        const order = await createStripeOrder({
            status: "Cancelled",
            cancelReason: "Payment timeout",
            cancelledBy: "system",
            stockReleasedAt: Date.now(),
        });

        const changed = await markStripeOrderPaid(order);

        expect(changed).toBe(false);
        const fresh = await orderModel.findById(order._id);
        expect(fresh.payment).toBe(false);
        expect(fresh.status).toBe("Cancelled");
        const product = await productModel.findById(productId);
        expect(product.sold).toBe(0);
    });

    it("don da Cancelled: gui thong bao hoan tien cho khach", async () => {
        const order = await createStripeOrder({ status: "Cancelled" });
        await markStripeOrderPaid(order);

        const notification = await notificationModel.findOne({ userId });
        expect(notification).not.toBeNull();
        expect(notification.type).toBe("order_cancelled");
        expect(notification.message).toMatch(/hủy|hoàn/i);
    });

    it("don da paid tu truoc: tra ve false, khong lam gi them", async () => {
        const order = await createStripeOrder({ payment: true });
        const changed = await markStripeOrderPaid(order);
        expect(changed).toBe(false);
        const notifications = await notificationModel.find({});
        expect(notifications.length).toBe(0);
    });

    it("don binh thuong: van danh dau paid nhu cu", async () => {
        await productModel.create({
            _id: productId,
            name: "SP test",
            description: "t",
            price: 100000,
            image: [],
            category: new mongoose.Types.ObjectId(),
            date: Date.now(),
            isActive: true,
            vendorId: new mongoose.Types.ObjectId(),
            sold: 0,
        });
        const order = await createStripeOrder();
        const changed = await markStripeOrderPaid(order);

        expect(changed).toBe(true);
        const fresh = await orderModel.findById(order._id);
        expect(fresh.payment).toBe(true);
        const product = await productModel.findById(productId);
        expect(product.sold).toBe(1);
    });
});
