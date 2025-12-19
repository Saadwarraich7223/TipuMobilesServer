import express from "express";
import optionalAuth from "../middlewares/optionalAuth.middleware.js";
import {
  cancelOrder,
  checkoutPreview,
  createOrder,
  deleteOrder,
  getAllOrders,
  getOrderSummary,
  getSingleOrder,
  getSingleUserOrders,
  markOrderAsPaid,
  updateOrderStatus,
} from "../controllers/order.controller.js";
import authenticateUser from "../middlewares/authenticateUser.middleware.js";
import adminAuth from "../middlewares/adminAuth.middleware.js";

const orderRouter = express.Router();

// Place an order
orderRouter.get("/checkout", optionalAuth, checkoutPreview);
orderRouter.post("/create", optionalAuth, createOrder);

// Get logged-in user's all orders
orderRouter.get("/my", authenticateUser, getSingleUserOrders);

// Get a specific order by ID (for user or admin)
orderRouter.get("/:id", authenticateUser, getSingleOrder);

// =============== Admin Routes ===============

// Get all orders (admin only)
// GET / api / admin / orders / summary;
orderRouter.get("/summary", authenticateUser, adminAuth, getOrderSummary);
orderRouter.get("/", authenticateUser, adminAuth, getAllOrders);

// Update order status (admin only)
orderRouter.patch(
  "/:id/status",
  authenticateUser,
  adminAuth,
  updateOrderStatus
);

// Mark order as paid (admin or payment service)
orderRouter.patch(
  "/:id/mark-paid",
  authenticateUser,
  adminAuth,
  markOrderAsPaid
);

// Cancel an order (admin only)
orderRouter.patch("/:id/cancel", authenticateUser, adminAuth, cancelOrder);

// Delete an order (admin only)
orderRouter.delete("/:id", authenticateUser, adminAuth, deleteOrder);

export default orderRouter;
