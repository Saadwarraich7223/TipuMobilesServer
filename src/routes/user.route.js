import express from "express";
import upload from "../middlewares/multer.middleware.js";

import validate from "../middlewares/validate.middleware.js";
import adminAuth from "../middlewares/adminAuth.middleware.js";
import authenticateUser from "../middlewares/authenticateUser.middleware.js";

import { loginSchema, registerSchema } from "../validations/userValidation.js";

import {
  forgetPassword,
  getUserProfile,
  getUsers,
  getWishList,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  removeOrAddToWishList,
  resetPassword,
  updateAvatar,
  updatePassword,
  updateUserInfo,
} from "../controllers/user.controller.js";

import {
  adminLimiter,
  forgetPasswordLimiter,
  loginLimiter,
  registerLimiter,
} from "../middlewares/rateLimiter.middleware.js";
import { getMyreviews } from "../controllers/review.controller.js";

const userRouter = express.Router();

/*==================== ADMIN ====================*/
userRouter.get("/", authenticateUser, adminAuth, adminLimiter, getUsers);

/*==================== AUTH ====================*/
userRouter.post(
  "/register",
  registerLimiter,
  validate(registerSchema),
  registerUser
);
userRouter.post("/login", loginLimiter, validate(loginSchema), loginUser);

/*==================== SESSION ====================*/
userRouter.post("/logout", authenticateUser, logoutUser);
userRouter.post("/refresh-token", refreshAccessToken);

/*==================== PASSWORD ====================*/
userRouter.post("/forget-password", forgetPasswordLimiter, forgetPassword);
userRouter.post("/reset-password", resetPassword);
userRouter.post("/update-password", authenticateUser, updatePassword);

/*==================== WISHLIST ====================*/
userRouter.get("/wishlist", authenticateUser, getWishList);
userRouter.post(
  "/wishlist/:productId",
  authenticateUser,
  removeOrAddToWishList
);

/*==================== PROFILE ====================*/
userRouter.patch(
  "/update",
  authenticateUser,
  upload.single("avatar"),
  updateUserInfo
);
userRouter.patch(
  "/avatar",
  authenticateUser,
  upload.single("avatar"),
  updateAvatar
);

userRouter.get("/profile", authenticateUser, getUserProfile);
userRouter.get("/me/reviews", authenticateUser, getMyreviews);

export default userRouter;
