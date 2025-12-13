import rateLimit from "express-rate-limit";

// Login limiter (brute force protection)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

//  Register limiter (prevent spam signups)
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: "Too many registration attempts. Please try again after 1 hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

//  Password reset limiter (prevent OTP/email spam)
export const forgetPasswordLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message:
      "Too many password reset attempts. Please try again after 30 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin limiter
export const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: "Too many requests to Admin routes. Slow Down Clown !",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Global limiter
export const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: "Too many requests, please try again later.",
});
