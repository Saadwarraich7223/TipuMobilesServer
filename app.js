import express from "express";
import cookieParser from "cookie-parser";
import userRouter from "./src/routes/user.route.js";
import { globalLimiter } from "./src/middlewares/rateLimiter.middleware.js";
import { applySecurityMiddlewares } from "./src/middlewares/security.middleware.js";
import categoryRouter from "./src/routes/category.route.js";
import productRouter from "./src/routes/product.route.js";
import cartRouter from "./src/routes/cart.route.js";
import reviewRouter from "./src/routes/review.route.js";
import orderRouter from "./src/routes/order.route.js";
import { errorHandler } from "./src/middlewares/errorhandle.middleware.js";
import flashSaleRouter from "./src/routes/flashSale.route.js";
import addressRouter from "./src/routes/address.route.js";

const app = express();

// 1. Basic parsers
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  Object.defineProperty(req, "query", {
    ...Object.getOwnPropertyDescriptor(req, "query"),
    value: req.query,
    writable: true,
  });
  next();
});

//  Global rate limiter (protects ALL routes by defaut (100/60 sec))
app.use(globalLimiter);

const ENV = process.env.NODE_ENV || "development";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// 2. Apply security middlewares
applySecurityMiddlewares(app, {
  trustedOrigin: FRONTEND_URL,
  env: ENV,
});

// 3. Routes
app.use("/api/auth", userRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/products", productRouter);
app.use("/api", cartRouter);
app.use("/api", reviewRouter);
app.use("/api/orders", orderRouter);
app.use("/api/flashSales", flashSaleRouter);
app.use("/api/address", addressRouter);

app.use(errorHandler);

export default app;
