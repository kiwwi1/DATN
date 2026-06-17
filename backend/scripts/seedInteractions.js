import mongoose from "mongoose";
import dotenv from "dotenv";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import userInteractionModel from "../models/userInteractionModel.js";
import bcrypt from "bcrypt";
import connectDB from "../config/mongodb.js";

dotenv.config();

async function seed() {
    try {
        console.log("Connecting to database...");
        await connectDB();
        console.log("Connected to MongoDB!");

        // 1. Fetch some products
        const products = await productModel.find({ isActive: true }).lean();
        if (products.length < 5) {
            console.log("Not enough products in DB. Please run seed-products first.");
            mongoose.connection.close();
            return;
        }

        console.log(`Found ${products.length} products in database.`);

        // 2. Create/Get test buyer accounts
        const passwordHash = await bcrypt.hash("buyer123", 10);
        const buyersInfo = [
            { email: "buyer1@gmail.com", name: "Buyer One Tech" },
            { email: "buyer2@gmail.com", name: "Buyer Two Tech" },
            { email: "buyer3@gmail.com", name: "Buyer Three Tech" },
            { email: "buyer4@gmail.com", name: "Buyer Four Fashion" },
            { email: "buyer5@gmail.com", name: "Buyer Five Fashion" }
        ];

        const buyers = [];
        for (const info of buyersInfo) {
            let user = await userModel.findOne({ email: info.email });
            if (!user) {
                user = await userModel.create({
                    name: info.name,
                    email: info.email,
                    password: passwordHash,
                    role: "user",
                    emailVerified: true
                });
                console.log(`Created test buyer: ${info.email}`);
            } else {
                console.log(`Found existing buyer: ${info.email}`);
            }
            buyers.push(user);
        }

        // 3. Clear existing interactions to have a clean slate for demonstration
        await userInteractionModel.deleteMany({});
        console.log("Cleared old user interactions.");

        // 4. Split products into two groups: Tech products (Group A) and Fashion products (Group B)
        const halfLength = Math.ceil(products.length / 2);
        const groupAProducts = products.slice(0, halfLength);
        const groupBProducts = products.slice(halfLength);

        console.log(`Group A (Tech/Type 1) has ${groupAProducts.length} products.`);
        console.log(`Group B (Fashion/Type 2) has ${groupBProducts.length} products.`);

        const interactionsToCreate = [];

        const addInteraction = (userId, productId, details, score) => {
            interactionsToCreate.push({
                userId,
                productId,
                interactions: {
                    purchased: details.purchased || 0,
                    rated: details.rated || 0,
                    reviewed: details.reviewed || false,
                    addedToCart: details.addedToCart || 0,
                    wishlisted: details.wishlisted || false,
                    viewed: details.viewed || 0,
                    clicked: details.clicked || 0,
                    searched: details.searched || 0,
                    timeSpent: details.timeSpent || 0
                },
                interactionScore: score,
                lastInteraction: new Date(),
                decayFactor: 1
            });
        };

        // Buyer 1 (Tech): interacts heavily with Group A products
        // Product 0
        addInteraction(buyers[0]._id, groupAProducts[0]._id, { viewed: 5, clicked: 3, purchased: 1 }, 20);
        // Product 1
        addInteraction(buyers[0]._id, groupAProducts[1]._id, { viewed: 4, addedToCart: 1, wishlisted: true }, 15);
        // Product 2 (This is the one Buyer 2 has NOT seen, but should be recommended)
        addInteraction(buyers[0]._id, groupAProducts[2]._id, { viewed: 10, clicked: 8, addedToCart: 2, purchased: 2 }, 40);

        // Buyer 2 (Tech): interacts with Group A product 0 and 1 (highly similar to Buyer 1)
        addInteraction(buyers[1]._id, groupAProducts[0]._id, { viewed: 4, clicked: 2, purchased: 1 }, 18);
        addInteraction(buyers[1]._id, groupAProducts[1]._id, { viewed: 3, wishlisted: true }, 10);

        // Buyer 3 (Tech): interacts with Group A product 0 and 2
        addInteraction(buyers[2]._id, groupAProducts[0]._id, { viewed: 2 }, 2);
        addInteraction(buyers[2]._id, groupAProducts[2]._id, { viewed: 6, clicked: 4, purchased: 1 }, 22);

        // Buyer 4 (Fashion): interacts heavily with Group B products
        addInteraction(buyers[3]._id, groupBProducts[0]._id, { viewed: 6, clicked: 4, purchased: 1 }, 22);
        addInteraction(buyers[3]._id, groupBProducts[1]._id, { viewed: 8, addedToCart: 2, wishlisted: true }, 25);

        // Buyer 5 (Fashion): interacts with Group B product 0 (highly similar to Buyer 4)
        addInteraction(buyers[4]._id, groupBProducts[0]._id, { viewed: 5, clicked: 3, purchased: 1 }, 20);

        await userInteractionModel.insertMany(interactionsToCreate);
        console.log(`Successfully seeded ${interactionsToCreate.length} user interaction records!`);

        console.log("\nDemonstration setups completed successfully!");
        console.log(`1. Login as buyer2@gmail.com (password: buyer123). Go to homepage -> CF will recommend product "${groupAProducts[2].name}" because similar user buyer1@gmail.com highly interacted with it.`);
        console.log(`2. Login as buyer5@gmail.com (password: buyer123). Go to homepage -> CF will recommend product "${groupBProducts[1].name}" because similar user buyer4@gmail.com highly interacted with it.`);

        mongoose.connection.close();
    } catch (err) {
        console.error("Seeding error:", err);
        mongoose.connection.close();
    }
}

seed();
