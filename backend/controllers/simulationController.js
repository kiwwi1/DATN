import productModel from "../models/productModel.js";
import { placeOrderService } from "../services/orderService.js";
import orderModel from "../models/orderModel.js";
import crypto from "crypto";

/**
 * Simulates high concurrency purchasing on a specific product / variant.
 * Resets stock to initialStock, then fires numRequests simultaneous checkout requests.
 * Evaluates atomic reservation success and idempotency key uniqueness constraints.
 */
export const simulateConcurrency = async (req, res) => {
    try {
        const { productId, variantKey, numRequests = 50, initialStock = 3, idempotencyMode = "unique" } = req.body;
        const userId = req.vendorId; // Use current authenticated vendor/admin user ID

        if (!productId) {
            return res.status(400).json({ success: false, message: "Missing productId" });
        }

        // 1. Retrieve the target product
        const product = await productModel.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // 2. Force reset inventory to initial testing value
        if (variantKey && Array.isArray(product.variants) && product.variants.length > 0) {
            const hasVariant = product.variants.some(v => v.variantKey === variantKey);
            if (!hasVariant) {
                return res.status(400).json({ success: false, message: `Variant '${variantKey}' not found on this product.` });
            }
            await productModel.updateOne(
                { _id: productId, "variants.variantKey": variantKey },
                { 
                    $set: { 
                        stock: initialStock, 
                        "variants.$.stock": initialStock 
                    } 
                }
            );
        } else {
            await productModel.updateOne(
                { _id: productId },
                { $set: { stock: initialStock } }
            );
        }

        // 3. Prepare mock checkout parameters
        const mockAddress = {
            fullName: "Simulated Concurrency Buyer",
            phone: "0987654321",
            street: "123 Concurrency St",
            city: "Hanoi",
            state: "HN",
            zipcode: "10000",
            country: "VN"
        };

        const items = [{
            _id: productId,
            quantity: 1,
            size: variantKey || ""
        }];

        // Generate the list of idempotency keys based on selected mode
        const keys = [];
        let duplicateKey = crypto.randomUUID();

        for (let i = 0; i < numRequests; i++) {
            let key = null;
            if (idempotencyMode === "unique") {
                key = crypto.randomUUID();
            } else if (idempotencyMode === "duplicate") {
                // Every 5 requests share the same duplicateKey to trigger compound unique index clashes
                if (i % 5 === 0) {
                    duplicateKey = crypto.randomUUID();
                }
                key = duplicateKey;
            }
            keys.push(key);
        }

        // 4. Trigger parallel placement of orders using Promise.all
        const promises = keys.map(async (key, index) => {
            const start = Date.now();
            try {
                const order = await placeOrderService({
                    userId,
                    items,
                    amount: product.price,
                    address: mockAddress,
                    voucherCodes: [],
                    idempotencyKey: key || undefined
                });
                const duration = Date.now() - start;
                return {
                    index,
                    status: "SUCCESS",
                    orderId: order._id,
                    idempotencyKey: key,
                    duration,
                    message: "Order created successfully"
                };
            } catch (err) {
                const duration = Date.now() - start;
                let status = "ERROR";
                let message = err.message || "Unknown transaction error";

                if (err.code === "OUT_OF_STOCK" || err.status === 409 || err.message?.toLowerCase().includes("out of stock")) {
                    status = "OUT_OF_STOCK";
                    message = "Inventory depleted (Atomic Reservation check failed)";
                } else if (err.code === 11000 || err.message?.includes("E11000") || err.message?.toLowerCase().includes("duplicate")) {
                    status = "DUPLICATE_KEY";
                    message = "Duplicate transaction blocked by Idempotency compound unique index";
                }

                return {
                    index,
                    status,
                    idempotencyKey: key,
                    duration,
                    message
                };
            }
        });

        const results = await Promise.all(promises);

        // 5. Read back final stock level to confirm consistency
        const finalProduct = await productModel.findById(productId).lean();
        let finalStock = finalProduct.stock;
        if (variantKey && Array.isArray(finalProduct.variants)) {
            const matched = finalProduct.variants.find(v => v.variantKey === variantKey);
            if (matched) finalStock = matched.stock;
        }

        const stats = {
            total: numRequests,
            success: results.filter(r => r.status === "SUCCESS").length,
            outOfStock: results.filter(r => r.status === "OUT_OF_STOCK").length,
            duplicate: results.filter(r => r.status === "DUPLICATE_KEY").length,
            error: results.filter(r => r.status === "ERROR").length,
            initialStock,
            finalStock,
            stockLeak: Math.max(0, initialStock - results.filter(r => r.status === "SUCCESS").length - finalStock)
        };

        return res.json({
            success: true,
            stats,
            results
        });

    } catch (error) {
        console.error("[concurrency-simulator-err]", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
