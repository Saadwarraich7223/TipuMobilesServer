import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const optionalAuth = async (req, res, next) => {
  try {
    const token =
      req?.cookies.accessToken ||
      req?.headers["authorization"]?.replace("Bearer", "").trim();
    if (!token || !process.env.ACCESS_TOKEN_SECRET) {
      return next();
    }

    const decodedtoken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedtoken?.id).select(
      "-password -refreshToken"
    );

    if (user) {
      req.user = user;
    }
  } catch (error) {
    console.error("JWT Auth Error:", error.message);
    res.status(401).json({
      message: "No Token , Proceed As Guest",
      success: false,
    });
  }
  next();
};

export default optionalAuth;
