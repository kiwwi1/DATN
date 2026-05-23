import express from "express";
import authUser from "../middleware/auth.js";
import {
    listAddresses,
    getDefaultAddress,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
} from "../controllers/addressController.js";

const addressRouter = express.Router();

addressRouter.get("/list", authUser, listAddresses);
addressRouter.get("/default", authUser, getDefaultAddress);
addressRouter.post("/", authUser, createAddress);
addressRouter.put("/:id", authUser, updateAddress);
addressRouter.delete("/:id", authUser, deleteAddress);
addressRouter.post("/:id/set-default", authUser, setDefaultAddress);

export default addressRouter;

