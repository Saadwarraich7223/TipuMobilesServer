import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const { Schema } = mongoose;

/* ==================== Cart Item (Subdocument)======================= */
const cartItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId, // referencing product.variants._id
      required: false,
    },

    // Snapshot data for reliability (if product is updated or deleted later)
    title: { type: String, trim: true, required: true },
    image: { type: String, trim: true, default: null },
    brand: { type: String, trim: true, default: "Unknown" },

    // Price at the time of addition (immutable)
    price: { type: Number, required: true, min: 0 },
    oldPrice: { type: Number, default: null, min: 0 },

    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },

    // variant attributes snapshot (e.g., color, size)
    variantAttributes: {
      type: Schema.Types.Mixed,
      default: {},
    },

    // Calculated subtotal for this line item
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

/* ====================== Main Cart Schema======================= */
const cartSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    cartToken: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4,
    },

    items: {
      type: [cartItemSchema],
      default: [],
    },

    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalItems: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "PKR", // or your preferred base currency
    },

    // Optional: store shipping / promo / tax info
    appliedCoupon: {
      code: { type: String, trim: true, default: null },
      discount: { type: Number, default: 0 },
    },

    isCheckoutLocked: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "completed", "abandoned"],
      default: "active",
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      index: { expireAfterSeconds: 0 }, // TTL index in MongoDB
    },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

/* ==================== Pre-save Hooks========================= */

cartSchema.virtual("cartId").get(function () {
  return this.cartToken;
});

cartSchema.methods.recalculateTotals = function () {
  let subtotal = 0;
  let totalQty = 0;

  this.items.forEach((item) => {
    item.lineTotal = item.price * item.quantity;
    subtotal += item.lineTotal;
    totalQty += item.quantity;
  });

  this.subtotal = subtotal;
  this.totalItems = totalQty;
  if (this.appliedCoupon) {
    this.totalAmount = subtotal - this.appliedCoupon?.discount;
  } else {
    this.totalAmount = subtotal;
  }
};

cartSchema.pre("save", function (next) {
  this.recalculateTotals();
  next();
});

/* ================Methods=================== */

// Add or update an item in the cart
cartSchema.methods.addItem = async function ({
  product,
  variantId,
  title,
  image,
  brand,
  price,
  oldPrice,
  quantity,
  variantAttributes,
}) {
  const existingItem = this.items.find(
    (i) =>
      i.product.toString() === product.toString() &&
      i.variantId?.toString() === variantId?.toString()
  );

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    this.items.push({
      product,
      variantId,
      title,
      image,
      brand,
      price,
      oldPrice,
      quantity,
      variantAttributes,
      lineTotal: price * quantity,
    });
  }

  this.recalculateTotals();
  this.lastActivityAt = new Date();
  this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return await this.save();
};

// Remove item from cart
cartSchema.methods.removeItem = async function (productId, variantId) {
  this.items = this.items.filter(
    (i) =>
      i.product.toString() !== productId.toString() ||
      i.variantId?.toString() !== variantId?.toString()
  );

  this.recalculateTotals();
  this.lastActivityAt = new Date();
  this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return await this.save();
};

// Clear all items
cartSchema.methods.clearCart = async function () {
  this.items = [];
  this.subtotal = 0;
  this.totalItems = 0;
  this.totalAmount = 0;
  this.lastActivityAt = new Date();
  this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return await this.save();
};

/* ======= Indexes ======== */
cartSchema.index({ user: 1 });

cartSchema.index({ "items.product": 1 });
cartSchema.index({ updatedAt: -1 });

const Cart = mongoose.models.Cart || mongoose.model("Cart", cartSchema);
export default Cart;
