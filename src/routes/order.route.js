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

// ================= Public / User =================

// Checkout preview
orderRouter.get("/checkout", optionalAuth, checkoutPreview);

// Create order
orderRouter.post("/create", optionalAuth, createOrder);

// Logged-in user's orders
orderRouter.get("/", authenticateUser, getSingleUserOrders);

// ================= Admin =================

// Order summary (admin)
orderRouter.get("/summary", authenticateUser, adminAuth, getOrderSummary);

// All orders (admin)
orderRouter.get("/", authenticateUser, adminAuth, getAllOrders);

// ================= ID-based routes (LAST) =================

// Get one order
orderRouter.get("/:id", authenticateUser, getSingleOrder);

// Update order status
orderRouter.patch(
  "/:id/status",
  authenticateUser,
  adminAuth,
  updateOrderStatus
);

// Mark as paid
orderRouter.patch(
  "/:id/mark-paid",
  authenticateUser,
  adminAuth,
  markOrderAsPaid
);

// Cancel order
orderRouter.patch("/:id/cancel", authenticateUser, adminAuth, cancelOrder);

// Delete order
orderRouter.delete("/:id", authenticateUser, adminAuth, deleteOrder);

export default orderRouter;
