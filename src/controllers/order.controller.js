import mongoose from "mongoose";
import Order from "../models/orders.model.js";
import AppError from "../utils/AppError.js";
import getOrCreateCart from "../utils/cart.helper.js";
import { filter } from "compression";

export const createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = req.user;
      const cartToken = req.headers["x-cart-token"] || null;
      const {
        shippingInfo,
        paymentMethod = "COD", // default
      } = req.body;
      const cart = await getOrCreateCart(user._id, cartToken);

      if (!cart || cart.items.length === 0) {
        throw new AppError("Your cart is empty", 400);
      }

      const orderItems = cart.items.map((item) => ({
        product: item.product,
        variant: item.variant || null,
        title: item.title,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        subTotal: item.lineTotal,
      }));

      const totals = await Order.calculateGrandTotal(orderItems);

      const order = new Order({
        user: user ? user._id : null,
        orderItems,
        shippingInfo,
        paymentMethod,
        totalAmount: totals.totalAmount,
        shippingFee: totals.shippingFee,
        discount: totals.discount,
        grandTotal: totals.grandTotal,
      });

      // Validating Stock before placing order : Like may be some product is out of stock or dont have enough stock
      await order.validateStockAvailability();
      // Saving Order
      await order.save({ session });
      // Adding Event
      await order.addEvent({
        event: "order_placed",
        message: "Order placed successfully",
        session: session,
      });

      // Deducting Stock : after placing the order reducing the items stock
      await order.deductStock({ session });
      // Clearing Cart
      await cart.clearCart(session);
    });
    return res.status(201).json({
      success: true,
      message: "Order placed successfully.",
    });
  } catch (error) {
    console.error(" Transaction failed", error);
    next(error);
  } finally {
    session.endSession();
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const {
      orderStatus,
      paymentStatus,
      userId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filters = {};

    if (orderStatus) filters.orderStatus = orderStatus;
    if (paymentStatus) filters.paymentStatus = paymentStatus;
    if (userId) filters.user = userId;

    const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 }; // sortOptions

    const orders = await Order.find(filters).sort(sortOptions).lean();
    if (!orders || orders.length === 0) {
      return res.status(201).json({
        success: false,
        message: "No orders found ",
        orders: [],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      orders: orders,
    });
  } catch (error) {
    console.error(" error while fetching orders:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to place order.",
      error: error.message,
    });
  }
};

export const getSingleUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    const orders = await Order.find({ user: userId }).lean();

    if (!orders || orders.length === 0) {
      return res.status(201).json({
        success: false,
        message: "No orders found ",
        orders: [],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      orders: orders,
    });
  } catch (error) {
    console.error(" error while fetching orders:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to place order.",
      error: error.message,
    });
  }
};

export const getSingleOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id).lean();
    if (!order) {
      throw new AppError("Order not found", 400);
    }

    return res.status(200).json({
      success: true,
      message: "Order fetched successfully",
      order: order,
    });
  } catch (error) {
    console.error(" error while fetching order:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to place order.",
      error: error.message,
    });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findById(id);

    if (!order) {
      throw new AppError("Order not found", 400);
    }

    const currentStatus = order.orderStatus;
    const validStatusTransitions = {
      pending: ["confirmed", "cancelled"], // can confirm or cancel from pending
      confirmed: ["processing", "cancelled"], // from confirmed can go to processing or cancelled
      processing: ["shipped", "cancelled"], // from processing can go to shipped or cancelled
      shipped: ["delivered"], // shipped to delivered
      delivered: [], // final state
      cancelled: [], // final state
    };
    if (!validStatusTransitions[currentStatus]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${currentStatus}' to '${status}'`,
      });
    }
    order.orderStatus = status;
    if (status === "delivered") {
      order.deliveredAt = Date.now();
    }
    if (status === "confirmed") {
      await order.deductStock();
    }
    await order.save();

    return res.status(200).json({
      success: true,
      message: `Order status changed to ${status} successfully `,
    });
  } catch (error) {
    console.error(" error updating order status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update order status.",
      error: error.message,
    });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findByIdAndUpdate(id, {
      orderStatus: "cancelled",
      cancelledAt: Date.now(),
    });

    if (!order) {
      throw new AppError("Order not found", 400);
    }

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
    });
  } catch (error) {
    console.error(" error while cancelling order :", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel order.",
      error: error.message,
    });
  }
};

export const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findByIdAndDelete(id);

    if (!order) {
      throw new AppError("Order not found", 400);
    }

    return res.status(200).json({
      success: true,
      message: "Order deleted successfuly",
    });
  } catch (error) {
    console.error(" error while deleting order:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete order.",
      error: error.message,
    });
  }
};

export const markOrderAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findByIdAndUpdate(id, {
      paymentStatus: "paid",
      paidAt: Date.now(),
    });
    if (!order) {
      throw new AppError("Order not found", 400);
    }

    return res.status(200).json({
      success: true,
      message: "Order status changed to paid",
    });
  } catch (error) {
    console.error(" error while marking order as paid :", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark order as paid order.",
      error: error.message,
    });
  }
};

// Orders summary :: AGGREGATION PIPELINE
export const getOrderSummary = async (req, res) => {
  try {
    // 1 Basic totals
    const baseStats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSales: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0],
            },
          },
          totalPaidOrders: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
          },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "pending"] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalOrders: 1,
          totalSales: 1,
          pendingOrders: 1,
          cancelledOrders: 1,
          averageOrderValue: {
            $cond: [
              { $eq: ["$totalPaidOrders", 0] },
              0,
              { $divide: ["$totalSales", "$totalPaidOrders"] },
            ],
          },
        },
      },
    ]);

    //  Sales in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const salesByDate = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          totalSales: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    //  Top products (by quantity sold)
    const topProducts = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalQuantity: { $sum: "$items.quantity" },
          totalSales: { $sum: "$items.subtotal" },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          name: "$product.title",
          totalQuantity: 1,
          totalSales: 1,
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ]);

    //  Top customers
    const topCustomers = await Order.aggregate([
      {
        $match: { paymentStatus: "paid" },
      },
      {
        $group: {
          _id: "$user",
          totalSpent: { $sum: "$totalAmount" },
          ordersCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          name: "$user.name",
          email: "$user.email",
          totalSpent: 1,
          ordersCount: 1,
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      success: true,
      summary: baseStats[0] || {},
      salesByDate,
      topProducts,
      topCustomers,
    });
  } catch (err) {
    console.error("getOrderSummary error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
