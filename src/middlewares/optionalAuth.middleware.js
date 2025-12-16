import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const optionalAuth = async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token || !process.env.ACCESS_TOKEN_SECRET) {
      return next(); // guest user
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken.id).select(
      "-password -refreshToken"
    );

    if (user) {
      req.user = user;
    }

    return next();
  } catch (error) {
    console.error("JWT Auth Error:", error.message);
    return next();
  }
};

export default optionalAuth;
