import express from "express";
import {
  createReview,
  deleteReview,
  getProductReviews,
  updateHelpfulCount,
  updateReview,
  getAllReviews,
  updateReviewStatusByAdmin,
  deleteReviewsByAdmin,
  replyToReview,
  getTopFiveReviews,
} from "../controllers/review.controller.js";
import authenticateUser from "../middlewares/authenticateUser.middleware.js";
import adminAuth from "../middlewares/adminAuth.middleware.js";

const reviewRouter = express.Router();

//USER ROUTES
reviewRouter
  .get("/topReviews", getTopFiveReviews)
  .post("/product/:productId/review/add", authenticateUser, createReview)
  .get("/product/:productId/reviews", getProductReviews)
  .patch("/product/:productId/review/update", authenticateUser, updateReview)
  .delete("/product/:productId/review/delete", authenticateUser, deleteReview)
  .patch(
    "/product/:productId/review/:reviewId/helpfull",
    authenticateUser,
    updateHelpfulCount
  );

// ADMIN ROUTES
reviewRouter
  .patch(
    "/products/review/:reviewId/status",
    authenticateUser,
    adminAuth,
    updateReviewStatusByAdmin
  )
  .post("/reviews/delete", authenticateUser, adminAuth, deleteReviewsByAdmin)
  .get("/reviews/all", authenticateUser, adminAuth, getAllReviews)
  .post(
    "/reviews/:reviewId/admin/reply",
    authenticateUser,
    adminAuth,
    replyToReview
  );
export default reviewRouter;
