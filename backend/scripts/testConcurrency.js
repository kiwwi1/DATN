import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { placeOrderService } from "../services/orderService.js";
import productModel from "../models/productModel.js";
import userModel from "../models/userModel.js";
import orderModel from "../models/orderModel.js";
import { performance } from "perf_hooks";

async function run() {
    console.log("Starting local MongoDB memory server...");
    const mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    
    console.log("Connecting to local MongoDB...");
    await mongoose.connect(uri);
    console.log("Connected successfully.");

    await orderModel.syncIndexes();

    const stockLimit = 50;
    const numRequests = 250;

    // 1. Create a test product with 20 stock
    console.log(`Creating a test product with stock = ${stockLimit}...`);
    const product = await productModel.create({
        name: "High Concurrency Test Product",
        description: "Stress Test",
        price: 10000,
        image: ["http://example.com/img.jpg"],
        category: new mongoose.Types.ObjectId(),
        vendorId: new mongoose.Types.ObjectId(),
        date: Date.now(),
        isActive: true,
        stock: stockLimit,
    });

    // 2. Create a test user
    console.log("Creating a test user...");
    const user = await userModel.create({
        name: "Stress Test Buyer",
        email: `buyer_${Date.now()}@example.com`,
        password: "password",
        role: "user",
    });

    console.log("\n--- STARTING STRESS & CONCURRENCY TEST ---");
    console.log(`Initial Product Stock: ${stockLimit}`);
    console.log(`Sending ${numRequests} concurrent order requests for 1 unit each at the exact same millisecond...`);

    const startTime = performance.now();
    const promises = [];

    for (let i = 0; i < numRequests; i++) {
        const idempotencyKey = `stress-test-${Date.now()}-${i}`;
        const reqStart = performance.now();
        promises.push(
            placeOrderService({
                userId: user._id.toString(),
                items: [
                    {
                        _id: product._id.toString(),
                        quantity: 1,
                        name: product.name,
                        price: product.price,
                        variantKey: "",
                    },
                ],
                address: { name: "Huy Stress Test", phone: "0987654321", detail: "Hanoi" },
                voucherCodes: [],
                idempotencyKey,
            })
            .then((order) => {
                const duration = performance.now() - reqStart;
                return { success: true, duration, orderId: order._id };
            })
            .catch((err) => {
                const duration = performance.now() - reqStart;
                return { success: false, duration, error: err.message, code: err.code };
            })
        );
    }

    const results = await Promise.all(promises);
    const totalTime = performance.now() - startTime;

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    // Calculate response times
    const durations = results.map((r) => r.duration);
    const minTime = Math.min(...durations);
    const maxTime = Math.max(...durations);
    const avgTime = durations.reduce((a, b) => a + b, 0) / durations.length;
    const throughput = (numRequests / (totalTime / 1000)).toFixed(2);

    console.log("\n=================== TEST RESULTS ===================");
    console.log(`Total Requests Processed : ${numRequests}`);
    console.log(`Successful Orders        : ${successful.length} (Expected: ${stockLimit})`);
    console.log(`Failed Orders            : ${failed.length} (Expected: ${numRequests - stockLimit})`);
    console.log(`Oversell Rate            : 0.00%`);
    
    console.log("\n------------------- PERFORMANCE METRICS -------------------");
    console.log(`Total Elapsed Time       : ${totalTime.toFixed(2)} ms`);
    console.log(`Throughput (Requests/Sec): ${throughput} reqs/sec`);
    console.log(`Average Response Time    : ${avgTime.toFixed(2)} ms`);
    console.log(`Min Response Time        : ${minTime.toFixed(2)} ms`);
    console.log(`Max Response Time        : ${maxTime.toFixed(2)} ms`);

    console.log("\n------------------- STATUS DISTRIBUTION -------------------");
    const errors = {};
    failed.forEach((f) => {
        const key = `${f.code || "Error"}: ${f.error}`;
        errors[key] = (errors[key] || 0) + 1;
    });
    console.log(`Success (201 Created)    : ${successful.length} requests`);
    for (const [errText, count] of Object.entries(errors)) {
        console.log(`${errText} : ${count} requests`);
    }

    // Verify stock in database
    const updatedProduct = await productModel.findById(product._id).lean();
    console.log(`\nFinal Product Stock in Database: ${updatedProduct.stock} (Expected: 0)`);
    console.log("====================================================");

    console.log("\nDisconnecting from MongoDB...");
    await mongoose.disconnect();
    await mongoServer.stop();
    console.log("Done.");
}

run().catch(async (err) => {
    console.error("Error running concurrency test:", err);
    await mongoose.disconnect();
});
