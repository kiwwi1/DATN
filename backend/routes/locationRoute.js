import express from "express";
import { listProvinces, listWards } from "../controllers/locationController.js";

const locationRouter = express.Router();

locationRouter.get("/provinces", listProvinces);
locationRouter.get("/wards", listWards);

export default locationRouter;

