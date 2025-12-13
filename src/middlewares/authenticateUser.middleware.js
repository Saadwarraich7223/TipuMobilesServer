import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

// Creating a middleware for protected routes to check if the user is authenticated
const authenticateUser = async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.headers["authorization"]?.replace("Bearer", "").trim();

    if (!token) {
      return res.status(401).json({
        message: "Unauthorized",
        success: false,
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET not set in env");
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken?.id).select(
      "-password -refreshToken"
    );
    if (!user) {
      return res.status(401).json({
        message: "Unauthorized. User not found.",
        success: false,
      });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error("JWT Auth Error:", error.message);
    res.status(401).json({
      message: "Invalid or expired token",
      success: false,
    });
  }
};

export default authenticateUser;
