import express from "express";
import {
  addToCart,
  clearCart,
  createCart,
  getCart,
  removeItem,
  updateCart,
} from "../controllers/cart.controller.js";
import optionalAuth from "../middlewares/optionalAuth.middleware.js";

const cartRouter = express.Router();

cartRouter.post("/cart/create", createCart);
cartRouter.post("/cart/add", optionalAuth, addToCart);
cartRouter.put("/cart/update", optionalAuth, updateCart);
cartRouter.delete("/cart/remove", optionalAuth, removeItem);
cartRouter.delete("/cart/clear", optionalAuth, clearCart);
cartRouter.get("/cart", optionalAuth, getCart);

export default cartRouter;
