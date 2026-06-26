import express from "express";
import { simulateConcurrency } from "../controllers/simulationController.js";
import vendorAuth from "../middleware/vendorAuth.js";

const simulationRouter = express.Router();

// Route for simulating concurrency - protected by vendor validation middleware
simulationRouter.post("/concurrency", vendorAuth, simulateConcurrency);

export default simulationRouter;
