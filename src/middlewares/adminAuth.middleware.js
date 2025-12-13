const adminAuth = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        message: "Not authenticated",
        success: false,
      });
    }

    if (user.role !== "Admin") {
      return res.status(403).json({
        message: "Access denied. Admins only.",
        success: false,
      });
    }
    next();
  } catch (error) {
    return res.status(500).json({
      message: "Server error in adminAuth middleware",
      error: error.message,
      success: false,
    });
  }
};

export default adminAuth;
