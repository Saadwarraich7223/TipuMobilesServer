import express from "express";
import {
  createAddress,
  deleteAddress,
  getAddressById,
  getAddressesByUser,
  setDefaultAddress,
  updateAddress,
} from "../controllers/address.controller.js";

const addressRouter = express.Router();

addressRouter.post("/create", createAddress); // POST /address/create
addressRouter.get("/:userId/addresses", getAddressesByUser); // GET /address/:userId
addressRouter.get("/:id/address", getAddressById); // GET /address/:id
addressRouter.put("/:id", updateAddress); // PUT /address/:id
addressRouter.put("/:id/setDefault", setDefaultAddress);
addressRouter.delete("/:id", deleteAddress); // DELETE /address/:id

export default addressRouter;
