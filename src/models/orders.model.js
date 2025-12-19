import { v4 as uuidv4 } from "uuid";

import mongoose from "mongoose";
import Product from "./product.model.js";
import AppError from "../utils/AppError.js";

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
      default: null,
    },
    title: {
      type: String,
      required: true,
    },
    image: {
      type: String,
    },
    price: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },
    subTotal: {
      type: Number,
      required: true,
      default: function () {
        return this.price * this.quantity;
      },
    },
  },
  { _id: false, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

const shippingSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
    landmark: { type: String },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderItems: [orderItemSchema],
    shippingInfo: shippingSchema,
    orderId: {
      type: String,
      unique: true,
      default: () => `ORD-${uuidv4()}`,
    },

    paymentId: {
      type: String,
      default: "",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    totalAmount: { type: Number, required: true },
    shippingFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },

    paidAt: { type: Date },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },

    events: [
      {
        type: {
          type: String,
          enum: [
            "order_placed",
            "payment_success",
            "order_shipped",
            "order_delivered",
            "order_cancelled",
          ],
        },
        message: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

orderItemSchema.pre("save", function (next) {
  this.subTotal = this.price * this.quantity;
  next();
});

orderSchema.statics.calculateGrandTotal = function (orderItems) {
  let totalAmount = 0;
  let shippingFee = 0;
  let discount = 0;
  let grandTotal = 0;

  orderItems.forEach((item) => {
    totalAmount += item.price * item.quantity;
  });

  shippingFee = 200;
  discount = 100;
  grandTotal = totalAmount + shippingFee - discount;

  return {
    totalAmount: totalAmount,
    shippingFee: shippingFee,
    discount: discount,
    grandTotal: grandTotal,
  };
};

orderSchema.methods.addEvent = function ({ event, message = "", session }) {
  this.events.push({
    type: event,
    message,
    timestamp: Date.now(),
  });
  return this.save({ session });
};

orderSchema.methods.validateStockAvailability = async function () {
  const productIds = this.orderItems.map((item) => item.product.toString());
  const products = await Product.find({ _id: { $in: productIds } }).lean();

  if (products.length !== productIds.length) {
    const foundIds = new Set(products.map((p) => p._id.toString()));
    const missing = productIds.filter((id) => !foundIds.has(id));
    throw new AppError(
      `Some products were not found: ${missing.join(", ")}`,
      404
    );
  }

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  for (const item of this.orderItems) {
    const product = productMap.get(item.product.toString());
    if (!product) throw new AppError("Product not found", 404);

    let availableStock;

    if (item.variant) {
      const variant = product.variants.find(
        (v) => v._id.toString() === item.variant.toString()
      );
      if (!variant) {
        throw new AppError(`Variant not found for item: ${item.title}`, 404);
      }
      availableStock = variant.stock;
    } else {
      availableStock = product.stock;
    }

    if (availableStock < item.quantity) {
      throw new Error(`Not enough stock for product ${item.title}`);
    }
  }
};

orderSchema.methods.deductStock = async function ({ session }) {
  const productIds = this.orderItems.map((item) => item.product.toString());
  const products = await Product.find({ _id: { $in: productIds } }).session(
    session
  );

  if (products.length !== productIds.length) {
    const foundIds = new Set(products.map((p) => p._id.toString()));
    const missing = productIds.filter((id) => !foundIds.has(id));
    throw new AppError(
      `Some products were not found: ${missing.join(", ")}`,
      404
    );
  }

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const bulkOps = [];

  for (const item of this.orderItems) {
    const product = productMap.get(item.product.toString());
    if (!product) throw new Error(`Product not found for item: ${item.title}`);

    if (item.variant) {
      const variantIndex = product.variants.findIndex(
        (v) => v._id.toString() === item.variant.toString()
      );
      if (variantIndex === -1) {
        throw new AppError(`Variant not found for item: ${item.title}`, 404);
      }

      const currentStock = product.variants[variantIndex].stock;
      if (currentStock < item.quantity) {
        throw new AppError(
          `Not enough stock for variant of "${item.title}"`,
          404
        );
      }

      product.variants[variantIndex].stock -= item.quantity;
      bulkOps.push({
        updateOne: {
          filter: { _id: product._id },
          update: { variants: product.variants },
        },
      });
    } else {
      if (product.stock < item.quantity) {
        throw new AppError(`Not enough stock for "${item.title}"`, 404);
      }

      product.stock -= item.quantity;

      bulkOps.push({
        updateOne: {
          filter: { _id: product._id, stock: { $gte: item.quantity } },
          update: { $inc: { stock: -item.quantity } },
        },
      });
    }
  }
  if (bulkOps.length === 0) {
    throw new AppError("No stock updates to perform", 400);
  }

  const bulkWriteResults = await Product.bulkWrite(bulkOps, { session });
  if (bulkWriteResults.modifiedCount === 0) {
    throw new AppError("No stock updates to perform", 400);
  }
};

orderSchema.methods.restoreStock = async function ({ session }) {
  const bulkOps = [];

  for (const item of this.orderItems) {
    if (item.variant) {
      bulkOps.push({
        updateOne: {
          filter: {
            _id: item.product,
            "variants._id": item.variant,
          },
          update: {
            $inc: { "variants.$.stock": item.quantity },
          },
        },
      });
    } else {
      bulkOps.push({
        updateOne: {
          filter: { _id: item.product },
          update: { $inc: { stock: item.quantity } },
        },
      });
    }
  }

  await Product.bulkWrite(bulkOps, { session });
};

orderSchema.index({ user: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ createdAt: -1 });

const Order = mongoose.model("Order", orderSchema);
export default Order;
