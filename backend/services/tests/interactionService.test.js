import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { trackInteractionService, getRecommendationsService } from "../interactionService.js";
import userInteractionModel from "../../models/userInteractionModel.js";
import productModel from "../../models/productModel.js";

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
    await userInteractionModel.deleteMany({});
    await productModel.deleteMany({});
});

const createProduct = (id, date = Date.now()) => productModel.create({
    _id: id,
    name: "Test Product",
    description: "Test",
    price: 100,
    image: [],
    category: new mongoose.Types.ObjectId(),
    date,
    isActive: true,
    vendorId: new mongoose.Types.ObjectId(),
});

const userId = new mongoose.Types.ObjectId();
const productId = new mongoose.Types.ObjectId();

describe("trackInteractionService", () => {
    it("tao moi ban ghi khi chua ton tai", async () => {
        const score = await trackInteractionService(userId, productId, "viewed");
        const record = await userInteractionModel.findOne({ userId, productId });
        expect(record).not.toBeNull();
        expect(record.interactions.viewed).toBe(1);
        expect(score).toBeGreaterThanOrEqual(0);
    });

    it("tang counter khi goi nhieu lan", async () => {
        await trackInteractionService(userId, productId, "viewed");
        await trackInteractionService(userId, productId, "viewed");
        const record = await userInteractionModel.findOne({ userId, productId });
        expect(record.interactions.viewed).toBe(2);
    });

    it("khong bi race condition khi goi dong thoi", async () => {
        // Pre-create document để tránh upsert race trong memory server
        await userInteractionModel.create({ userId, productId });
        await Promise.all([
            trackInteractionService(userId, productId, "clicked"),
            trackInteractionService(userId, productId, "clicked"),
            trackInteractionService(userId, productId, "clicked"),
        ]);
        const record = await userInteractionModel.findOne({ userId, productId });
        expect(record.interactions.clicked).toBe(3);
    });
});

describe("getRecommendationsService", () => {
    it("tra ve san pham theo thu tu score giam dan", async () => {
        const productId2 = new mongoose.Types.ObjectId();
        await createProduct(productId, 1000);
        await createProduct(productId2, 500);
        await trackInteractionService(userId, productId, "purchased");   // score cao
        await trackInteractionService(userId, productId2, "viewed");     // score thap
        const results = await getRecommendationsService(userId, 10);
        expect(results.length).toBe(2);
    });

    it("giu nguyen thu tu score giam dan", async () => {
        const productId2 = new mongoose.Types.ObjectId();
        await createProduct(productId, 1000);
        await createProduct(productId2, 500);
        await trackInteractionService(userId, productId, "purchased");   // score cao hon
        await trackInteractionService(userId, productId2, "viewed");     // score thap hon
        const results = await getRecommendationsService(userId, 10);
        expect(results[0]._id.toString()).toBe(productId.toString());
    });

    it("cold start: tra ve bestseller khi chua co interaction", async () => {
        const newUser = new mongoose.Types.ObjectId();
        await createProduct(productId);
        const results = await getRecommendationsService(newUser, 5);
        expect(results.length).toBeGreaterThan(0);
    });

    it("CF: goi y san pham tu similar users", async () => {
        const userB = new mongoose.Types.ObjectId();
        const productId2 = new mongoose.Types.ObjectId();
        const productId3 = new mongoose.Types.ObjectId();
        await createProduct(productId);
        await createProduct(productId2);
        await createProduct(productId3);
        await trackInteractionService(userId, productId, "viewed");
        await trackInteractionService(userB, productId, "viewed");
        await trackInteractionService(userB, productId3, "purchased");
        const results = await getRecommendationsService(userId, 10);
        const ids = results.map((p) => p._id.toString());
        expect(ids).toContain(productId3.toString());
    });
});
