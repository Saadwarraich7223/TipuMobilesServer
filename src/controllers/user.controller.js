import User from "../models/user.model.js";
import sanitizeUser from "../utils/sanitizeUser.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import { v2 as cloudinary } from "cloudinary";
import Jwt from "jsonwebtoken";
import sendEmail from "../utils/sendEmail.js";
import { passwordResetTemplate } from "../utils/emailTemplate.js";
import mongoose from "mongoose";
import Product from "../models/product.model.js";

// Generate access token and refresh token
const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    return res.status(500).json({
      message:
        "Something went wrong while generating access token and refresh token",
      success: false,
    });
  }
};

// Store tokens in cookies
const sendTokenCookie = (
  res,
  accessToken,
  refreshToken,
  sanitizedUser,
  message
) => {
  const accessTokenMaxAge = 24 * 60 * 60 * 1000; // 1 day in ms
  const refreshTokenMaxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, {
      ...options,
      maxAge: accessTokenMaxAge,
    })
    .cookie("refreshToken", refreshToken, {
      ...options,
      maxAge: refreshTokenMaxAge,
    })
    .json({
      message,
      success: true,
      user: sanitizedUser || null,
      accessToken,
      refreshToken,
    });
};

// Register user
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Please fill all the fields",
        error: true,
        success: false,
      });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with this email",
        success: false,
      });
    }

    const user = new User({
      name,
      email,
      password,
    });
    await user.save();

    const { accessToken, refreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id);

    const sanitizedUser = sanitizeUser(loggedInUser);
    return sendTokenCookie(
      res,
      accessToken,
      refreshToken,
      sanitizedUser,
      "User registered successfully"
    );
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: error.message,
      error: true,
      success: false,
    });
  }
};

// Login user
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        message: "Please fill all the fields",
        error: true,
        success: false,
      });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        error: true,
        success: false,
      });
    }
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid  password or email",
        error: true,
        success: false,
      });
    }
    await User.updateOne(
      { _id: user._id },
      { $set: { lastLoginDate: new Date() } }
    );
    await user.save({ validateBeforeSave: false });

    const { accessToken, refreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);

    const sanitizedUser = sanitizeUser(user);
    return sendTokenCookie(
      res,
      accessToken,
      refreshToken,
      sanitizedUser,
      "User logged in successfully"
    );
  } catch (error) {
    return res.status(500).json({
      message: error.message,
      error: true,
      success: false,
    });
  }
};

// Logout user
export const logoutUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: { refreshToken: "" },
      },
      { new: true }
    );

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
    };
    res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json({ message: "Logout successfully", success: true });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
      error: true,
      success: false,
    });
  }
};

// update user info
export const updateUserInfo = async (req, res) => {
  try {
    const { name, phone } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    if (req.file?.path) {
      const uploaded = await uploadOnCloudinary(req.file.path);
      if (!uploaded) {
        return res
          .status(500)
          .json({ message: "Failed to upload avatar", success: false });
      }
      if (user.avatar?.public_id) {
        await cloudinary.uploader.destroy(user.avatar.public_id);
      }

      // Update user avatar in DB
      user.avatar = {
        url: uploaded.secure_url,
        public_id: uploaded.public_id,
      };
    }

    if (name) {
      user.name = name;
    }
    if (phone) {
      user.phone = phone;
    }

    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      message: "User info updated successfully",
      success: true,
      user: {
        name: user.name,
        email: user.email, // read-only
        phone: user.phone,
        avatar: user.avatar,
        status: user.status,
        role: user.role, // exposed but not editable
      },
    });
  } catch (error) {
    console.error("Error updating user info:", error);
    return res.status(500).json({
      message: "Server error",
      success: false,
      error: error.message,
    });
  }
};

// Get all users  :: ADMIN ONLY
export const getUsers = async (req, res) => {
  try {
    const users = (await User.find().lean()).map((user) => sanitizeUser(user));

    res.status(200).json({ users, success: true });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
      error: true,
      success: false,
    });
  }
};

// Refresh token
export const refreshAccessToken = async (req, res) => {
  try {
    const incomingRefreshToken =
      req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
      return res
        .status(401)
        .json({ message: "No refresh token provided", success: false });
    }

    const decodedToken = Jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken.id);

    if (!user || user.refreshToken !== incomingRefreshToken) {
      return res
        .status(403)
        .json({ message: "Invalid refresh token", success: false });
    }

    const { accessToken, refreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);

    return sendTokenCookie(
      res,
      accessToken,
      refreshToken,
      null,
      "Access token refreshed successfully"
    );
  } catch (error) {
    console.error(error);
    return res.status(403).json({
      message: "Refresh token expired or invalid. Please log in again.",
      success: false,
    });
  }
};
// Uplaod avatar
export const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "No file uploaded", success: false });
    }

    // Upload to Cloudinary
    const uploaded = await uploadOnCloudinary(req.file.path);

    if (!uploaded) {
      return res
        .status(500)
        .json({ message: "Failed to upload avatar", success: false });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
    }

    // If user already has an avatar, delete it from Cloudinary
    if (user.avatar?.public_id) {
      await cloudinary.uploader.destroy(user.avatar.public_id);
    }

    // Update user avatar in DB
    user.avatar = {
      url: uploaded.secure_url,
      public_id: uploaded.public_id,
    };

    await user.save();

    return res.status(200).json({
      message: "Avatar updated successfully",
      success: true,
      avatar: user.avatar,
    });
  } catch (error) {
    console.error("Error updating avatar:", error);
    return res.status(500).json({
      message: "Error updating avatar",
      success: false,
      error: error.message,
    });
  }
};

// Get user profile
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!userId) {
      return res
        .status(401)
        .json({ message: "User not authenticated", success: false });
    }
    const user = await User.findById(userId)
      .select(
        "-password -refreshToken -forgetPasswordOtp -forgotPasswordOtpExpiry"
      )
      .populate("cart");

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
    }
    return res.status(200).json({ user, success: true });
  } catch (error) {
    console.error("Error getting user profile:", error);
    return res.status(500).json({
      message: "Error getting user profile",
      success: false,
      error: error.message,
    });
  }
};

// Forgot Password
export const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ message: "Email is required", success: false });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    user.forgotPasswordOtp = otp;
    user.forgotPasswordOtpExpiry = otpExpiry;
    await user.save();
    await sendEmail(
      user.email,
      "Password Reset OTP",
      `Your OTP is ${otp}`,
      passwordResetTemplate(user.name, otp)
    );
    return res
      .status(200)
      .json({ message: "OTP sent to email", success: true });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({ message: error.message, success: false });
  }
};

// Reset Password
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ message: "Email is required", success: false });
    }
    if (!otp) {
      return res
        .status(400)
        .json({ message: "OTP is required", success: false });
    }
    if (!newPassword) {
      return res
        .status(400)
        .json({ message: "New password is required", success: false });
    }

    // if (!email || !otp || !newPassword) {
    //   return res.status(400).json({
    //     message: "Email, OTP, and password are required",
    //     success: false,
    //   });
    // }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
    }

    if (
      user.forgotPasswordOtp !== otp ||
      user.forgotPasswordOtpExpiry < Date.now()
    ) {
      return res
        .status(400)
        .json({ message: "Invalid or expired OTP", success: false });
    }
    user.password = newPassword;
    user.forgotPasswordOtp = "";
    user.forgotPasswordOtpExpiry = null;
    await user.save();
    return res
      .status(200)
      .json({ message: "Password reset successful", success: true });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({ message: error.message, success: false });
  }
};

// Update Password
export const updatePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user._id;

    if (!oldPassword) {
      return res.status(400).json({
        message: "Old password is required",
        success: false,
      });
    }
    if (!newPassword) {
      return res.status(400).json({
        message: "New password is required",
        success: false,
      });
    }

    if (!userId) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
    }
    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
    }
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({
        message: "Old password is incorrect",
        success: false,
      });
    }

    user.password = newPassword;
    await user.save();
    return res
      .status(200)
      .json({ message: "Password updated successfully", success: true });
  } catch (error) {}
};

// add / remove from WishList
export const removeOrAddToWishList = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;

    // Optional: check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ message: "Product not found", success: false });
    }

    // Check if product is already in wishlist
    const isInWishlist = await User.exists({
      _id: userId,
      wishList: productId,
    });

    let updateQuery;
    if (isInWishlist) {
      updateQuery = { $pull: { wishList: productId } };
    } else {
      updateQuery = { $addToSet: { wishList: productId } };
    }

    // Update + populate products
    const updatedUser = await User.findByIdAndUpdate(userId, updateQuery, {
      new: true,
    }).populate("wishList"); // <= THIS RETURNS FULL PRODUCT OBJECTS

    return res.status(200).json({
      message: isInWishlist
        ? "Product removed from wishlist"
        : "Product added to wishlist",
      success: true,
      wishList: updatedUser.wishList, // now full products!
    });
  } catch (error) {
    console.error("Error toggling wishlist:", error);
    return res.status(500).json({ message: error.message, success: false });
  }
};

// get wishlist
export const getWishList = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate("wishList");
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
    }
    return res.status(200).json({ wishList: user.wishList, success: true });
  } catch (error) {
    console.error("Error getting wishlist:", error);
    res.status(500).json({ message: error.message, success: false });
  }
};
