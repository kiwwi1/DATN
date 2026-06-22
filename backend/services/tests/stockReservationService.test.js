import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import productModel from "../../models/productModel.js";
import orderModel from "../../models/orderModel.js";
import {
    reserveStockByUnits,
    releaseStockByItems,
} from "../order/stockReservationService.js";

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await orderModel.syncIndexes();
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    await productModel.deleteMany({});
    await orderModel.deleteMany({});
});

const createProduct = (overrides = {}) => productModel.create({
    name: "Atomic Product",
    description: "Test product",
    price: 100000,
    image: [],
    category: new mongoose.Types.ObjectId(),
    vendorId: new mongoose.Types.ObjectId(),
    date: Date.now(),
    isActive: true,
    stock: 1,
    ...overrides,
});

describe("reserveStockByUnits", () => {
    it("allows only one competing reservation when stock is one", async () => {
        const product = await createProduct({ stock: 1 });
        const unit = {
            productId: product._id.toString(),
            variantKey: "",
            quantity: 1,
            itemName: product.name,
        };

        const results = await Promise.allSettled([
            reserveStockByUnits([unit]),
            reserveStockByUnits([unit]),
        ]);

        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        const rejected = results.find((result) => result.status === "rejected");
        expect(rejected?.reason?.code).toBe("OUT_OF_STOCK");

        const updated = await productModel.findById(product._id).lean();
        expect(updated.stock).toBe(0);
    });

    it("rolls back previously reserved units when a later item is out of stock", async () => {
        const available = await createProduct({
            _id: new mongoose.Types.ObjectId("000000000000000000000001"),
            stock: 5,
        });
        const unavailable = await createProduct({
            _id: new mongoose.Types.ObjectId("000000000000000000000002"),
            name: "Unavailable Product",
            stock: 0,
        });

        await expect(reserveStockByUnits([
            {
                productId: available._id.toString(),
                variantKey: "",
                quantity: 2,
                itemName: available.name,
            },
            {
                productId: unavailable._id.toString(),
                variantKey: "",
                quantity: 1,
                itemName: unavailable.name,
            },
        ])).rejects.toMatchObject({ code: "OUT_OF_STOCK" });

        const restored = await productModel.findById(available._id).lean();
        expect(restored.stock).toBe(5);
    });

    it("releases both total stock and variant stock for variant items", async () => {
        const product = await createProduct({
            stock: 3,
            variants: [
                {
                    combination: { Color: "Red" },
                    variantKey: "Color:Red",
                    price: 100000,
                    stock: 3,
                },
            ],
        });

        const items = [{
            _id: product._id.toString(),
            variantKey: "Color:Red",
            quantity: 2,
        }];

        await reserveStockByUnits([{
            productId: product._id.toString(),
            variantKey: "Color:Red",
            quantity: 2,
            itemName: product.name,
        }]);
        await releaseStockByItems(items);

        const updated = await productModel.findById(product._id).lean();
        expect(updated.stock).toBe(3);
        expect(updated.variants[0].stock).toBe(3);
    });
});

describe("order idempotency index", () => {
    it("rejects duplicate idempotency keys for the same user", async () => {
        const userId = new mongoose.Types.ObjectId();
        const baseOrder = {
            userId,
            items: [],
            amount: 100000,
            address: { name: "Test User" },
            paymentMethod: "COD",
            payment: false,
            date: Date.now(),
            idempotencyKey: "checkout-test-key",
        };

        await orderModel.create(baseOrder);
        await expect(orderModel.create(baseOrder)).rejects.toMatchObject({ code: 11000 });
    });
});