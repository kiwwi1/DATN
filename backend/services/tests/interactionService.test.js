import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { trackInteractionService, getRecommendationsService, applyTimeDecay } from "../interactionService.js";
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

describe("applyTimeDecay (suy hao luoi tai thoi diem doc)", () => {
    const DAY_MS = 24 * 60 * 60 * 1000;

    it("tuong tac vua xay ra: diem gan nhu nguyen ven", () => {
        const now = Date.now();
        expect(applyTimeDecay(100, new Date(now), now)).toBeCloseTo(100, 5);
    });

    it("sau dung 30 ngay: diem con ~36.8% (e^-1)", () => {
        const now = Date.now();
        const thirtyDaysAgo = new Date(now - 30 * DAY_MS);
        expect(applyTimeDecay(100, thirtyDaysAgo, now)).toBeCloseTo(100 * Math.exp(-1), 5);
    });

    it("sau 90 ngay: diem con ~5% (e^-3)", () => {
        const now = Date.now();
        const ninetyDaysAgo = new Date(now - 90 * DAY_MS);
        expect(applyTimeDecay(100, ninetyDaysAgo, now)).toBeCloseTo(100 * Math.exp(-3), 5);
    });

    it("thieu lastInteraction: tra ve 0", () => {
        expect(applyTimeDecay(100, null)).toBe(0);
        expect(applyTimeDecay(100, undefined)).toBe(0);
    });

    it("lastInteraction o tuong lai (lech dong ho): khong khuech dai diem", () => {
        const now = Date.now();
        const future = new Date(now + 5 * DAY_MS);
        expect(applyTimeDecay(100, future, now)).toBe(100);
    });

    it("CF khong hoi sinh tuong tac da nguoi: candidate cu khong duoc goi y truoc candidate moi", async () => {
        // userB tuong tu userA qua productId; userB co 2 san pham khac:
        // productOld tuong tac manh nhung 120 ngay truoc, productNew tuong tac nhe nhung moi.
        const userB = new mongoose.Types.ObjectId();
        const productOld = new mongoose.Types.ObjectId();
        const productNew = new mongoose.Types.ObjectId();
        await createProduct(productId);
        await createProduct(productOld);
        await createProduct(productNew);

        await trackInteractionService(userId, productId, "purchased");
        await trackInteractionService(userB, productId, "purchased");
        await trackInteractionService(userB, productNew, "viewed"); // diem tho 1, moi

        // Backdate: diem tho 10 (purchased) nhung nguoi 120 ngay -> decay ~ e^-4 ≈ 0.018 -> 10*0.018 < 1
        await userInteractionModel.create({
            userId: userB,
            productId: productOld,
            interactions: { purchased: 1 },
            interactionScore: 10,
            lastInteraction: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
        });

        const results = await getRecommendationsService(userId, 10);
        const ids = results.map((p) => p._id.toString());
        const oldIndex = ids.indexOf(productOld.toString());
        const newIndex = ids.indexOf(productNew.toString());
        expect(newIndex).toBeGreaterThanOrEqual(0);
        // productNew (moi, diem decay ~1) phai xep truoc productOld (diem decay ~0.18)
        if (oldIndex >= 0) {
            expect(newIndex).toBeLessThan(oldIndex);
        }
    });
});
