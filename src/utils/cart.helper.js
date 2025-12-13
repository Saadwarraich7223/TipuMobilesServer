import Cart from "../models/cart.model.js";
import { v4 as uuidv4 } from "uuid";

const getOrCreateCart = async (userId, cartToken) => {
  try {
    // -----------------------------------------------------------
    // 1. USER LOGGED IN
    // -----------------------------------------------------------
    if (userId) {
      const [userCart, guestCart] = await Promise.all([
        Cart.findOne({ user: userId }),
        cartToken ? Cart.findOne({ cartToken, user: null }) : null,
      ]);

      // ---------------------------------------------------------
      // CASE A: User already has a cart AND guest cart exists → MERGE
      // ---------------------------------------------------------
      if (userCart && guestCart) {
        guestCart.items.forEach((g) => {
          const existing = userCart.items.find(
            (i) =>
              i.product.toString() === g.product.toString() &&
              String(i.variantId || "") === String(g.variantId || "")
          );

          if (existing) {
            existing.quantity += g.quantity;
          } else {
            // clone safely (because _id: false subdocs cannot be reused!)
            userCart.items.push(g.toObject());
          }
        });

        // DO NOT overwrite user's existing cartToken (important!)
        if (!userCart.cartToken && guestCart.cartToken) {
          userCart.cartToken = guestCart.cartToken;
        }

        await userCart.save();

        // delete guest cart after merge
        await guestCart.deleteOne();

        return userCart;
      }

      // ---------------------------------------------------------
      // CASE B: User already has a cart, no guest cart
      // ---------------------------------------------------------
      if (userCart) return userCart;

      // ---------------------------------------------------------
      // CASE C: No user cart, but guest cart exists → attach guest cart
      // ---------------------------------------------------------
      if (guestCart) {
        guestCart.user = userId;

        // Ensure cartToken stays the same (important for continuity)
        if (!guestCart.cartToken) {
          guestCart.cartToken = uuidv4();
        }

        await guestCart.save();
        return guestCart;
      }

      // ---------------------------------------------------------
      // CASE D: No user cart, no guest cart → Create new user cart
      // ---------------------------------------------------------
      const token = cartToken || uuidv4();

      try {
        return await Cart.create({
          user: userId,
          cartToken: token,
        });
      } catch (err) {
        // unique cartToken collision - fetch existing
        if (err.code === 11000) {
          return await Cart.findOne({ cartToken: token });
        }
        throw err;
      }
    }

    // -----------------------------------------------------------
    // 2. GUEST CART
    // -----------------------------------------------------------
    if (cartToken) {
      const cart = await Cart.findOne({ cartToken, user: null });
      if (cart) return cart;
    }

    // New guest cart
    const token = cartToken || uuidv4();

    try {
      return await Cart.create({
        user: null,
        cartToken: token,
      });
    } catch (err) {
      // handle rare collision
      if (err.code === 11000) {
        return await Cart.findOne({ cartToken: token });
      }
      throw err;
    }
  } catch (error) {
    console.error("getOrCreateCart error:", error);
    throw error;
  }
};

export default getOrCreateCart;
