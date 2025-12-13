import Cart from "../models/cart.model.js";
import { v4 as uuidv4 } from "uuid";
import Product from "../models/product.model.js";
import FlashSale from "../models/flashSale.model.js";
import getOrCreateCart from "../utils/cart.helper.js";

/* ============================================================
   FLASH SALE PRICE HELPER
============================================================ */
const getFlashSalePrice = async (productId) => {
  const flash = await FlashSale.findOne({
    "products.product": productId,
    endTime: { $gt: new Date() }, // Active Sales Only
  });

  if (!flash) return null;

  const flashItem = flash.products.find(
    (p) => p.product.toString() === productId.toString()
  );

  return flashItem ? flashItem.salePrice : null;
};

/* ============================================================
   CREATE CART
============================================================ */
export const createCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    const cartToken = req.headers["x-cart-token"] || null;

    const cart = await getOrCreateCart(userId, cartToken);

    return res
      .status(200)
      .json({ success: true, cart, cartToken: cart.cartToken });
  } catch (error) {
    console.error("createCart error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ============================================================
   ADD TO CART  (FLASH SALE PRICE APPLIED HERE)
============================================================ */
export const addToCart = async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const cartToken = req.headers["x-cart-token"] || null;
    const { productId, variantId, quantity } = req.body;

    if (!productId || typeof quantity !== "number" || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product or quantity",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Variant Checking
    const variant = variantId ? product.variants.id(variantId) : null;

    let basePrice = variant?.price || product.price;
    let baseOldPrice = variant?.oldPrice || product.oldPrice;

    // FLASH SALE PRICE CHECK
    const salePrice = await getFlashSalePrice(productId);

    // Apply effective prices
    let effectivePrice = salePrice ?? basePrice;
    let effectiveOldPrice = salePrice ? basePrice : baseOldPrice;

    const title = product.title;
    const brand = product.brand;
    const image = variant?.images?.[0] || product.images?.[0];
    const variantAttributes = variant?.attributes || {};

    const cart = await getOrCreateCart(userId, cartToken);

    // Prevent duplicates
    const existingItem = cart.items.find(
      (i) =>
        i.product.toString() === productId &&
        (variantId ? i.variantId?.toString() === variantId : true)
    );

    if (existingItem) {
      return res.status(409).json({
        success: false,
        message: "Product already in the cart",
        cart,
      });
    }

    await cart.addItem({
      product: productId,
      variantId,
      title,
      image,
      brand,
      price: effectivePrice,
      oldPrice: effectiveOldPrice,
      quantity,
      variantAttributes,
    });

    return res.status(200).json({
      success: true,
      message: `${product.title} added to cart`,
      cart,
      cartToken: cart.cartToken,
    });
  } catch (error) {
    console.error("addToCart Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
   UPDATE CART  (FLASH SALE PRICE RE-APPLIED HERE)
============================================================ */
export const updateCart = async (req, res) => {
  try {
    const user = req.user;
    const cartToken = req.headers["x-cart-token"] || null;
    const { productId, variantId, quantity } = req.body;

    if (!productId || typeof quantity !== "number" || quantity <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product or quantity" });
    }

    if (!user && !cartToken) {
      return res.status(400).json({
        success: false,
        message: "Missing cart token or user context",
      });
    }

    let cart = await getOrCreateCart(user?._id, cartToken);
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    // Ownership check
    if (
      (user && cart.user && cart.user.toString() !== user._id.toString()) ||
      (!user && cart.user)
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Cart does not belong to user",
      });
    }

    // Remove item if quantity <= 0
    if (quantity <= 0) {
      cart.items = cart.items.filter(
        (i) =>
          !(
            i.product.toString() === productId.toString() &&
            i.variantId?.toString() === variantId?.toString()
          )
      );
    } else {
      const item = cart.items.find(
        (i) =>
          i.product.toString() === productId.toString() &&
          i.variantId?.toString() === variantId?.toString()
      );

      if (!item) {
        return res
          .status(404)
          .json({ success: false, message: "Item not found" });
      }

      item.quantity = quantity;

      // Reapply flash sale price
      const salePrice = await getFlashSalePrice(productId);
      if (salePrice) {
        item.oldPrice = item.price;
        item.price = salePrice;
      }
    }

    cart.recalculateTotals();
    cart.lastActivityAt = new Date();
    cart.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await cart.save();

    return res.status(200).json({
      success: true,
      message: `Item quantity updated to ${quantity}`,
      cart,
      cartToken: cart.cartToken,
    });
  } catch (error) {
    console.error("updateCart Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
   REMOVE ITEM
============================================================ */
export const removeItem = async (req, res) => {
  try {
    const user = req.user;
    const cartToken = req.headers["x-cart-token"] || null;
    const { productId, variantId } = req.body;

    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product" });
    }

    if (!user && !cartToken) {
      return res.status(400).json({
        success: false,
        message: "Missing cart token or user context",
      });
    }

    let cart = await getOrCreateCart(user?._id, cartToken);

    // Ownership check
    if (
      (user && cart.user && cart.user.toString() !== user._id.toString()) ||
      (!user && cart.user)
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Cart does not belong to user",
      });
    }

    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    await cart.removeItem(productId, variantId);

    return res.status(200).json({
      success: true,
      cart,
      message: `Item with id ${productId} removed from cart`,
    });
  } catch (error) {
    console.error("removeItem Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
   CLEAR CART
============================================================ */
export const clearCart = async (req, res) => {
  try {
    const user = req.user;
    const cartToken = req.headers["x-cart-token"] || null;

    if (!user && !cartToken) {
      return res.status(400).json({
        success: false,
        message: "Missing cart token or user context",
      });
    }

    let cart = await getOrCreateCart(user?._id, cartToken);

    // Ownership check
    if (
      (user && cart.user && cart.user.toString() !== user._id.toString()) ||
      (!user && cart.user)
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Cart does not belong to user",
      });
    }

    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    await cart.clearCart();

    return res
      .status(200)
      .json({ success: true, cart, message: "Cart cleared" });
  } catch (error) {
    console.error("Clear Cart Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
   GET CART (FLASH SALE PRICES ALSO APPLIED)
============================================================ */
export const getCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    const cartToken = req.headers["x-cart-token"] || null;

    const cart = await getOrCreateCart(userId, cartToken);

    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    // Reapply flash sale pricing
    for (let item of cart.items) {
      const salePrice = await getFlashSalePrice(item.product);

      const product = await Product.findById(item.product);
      const variant = item.variantId
        ? product.variants.id(item.variantId)
        : null;

      const basePrice = variant?.price || product.price;
      const baseOldPrice = variant?.oldPrice || product.oldPrice;

      if (salePrice) {
        item.oldPrice = basePrice; // show original price as struck-through
        item.price = salePrice; // sale price
      } else {
        item.price = basePrice; // revert
        item.oldPrice = baseOldPrice;
      }
    }

    cart.recalculateTotals();
    cart.lastActivityAt = new Date();
    cart.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await cart.save();

    return res.status(200).json({
      success: true,
      cart,
      message: "Cart fetched successfully",
      cartToken: cart.cartToken,
    });
  } catch (error) {
    console.error("getCart Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
