export const errorHandler = async (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error("ErrorHandler:", {
    message: err.message,
    stack: err.stack,
    route: req.originalUrl,
  });

  return res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
