import Product from "../models/product.model.js";
import Review from "../models/review.model.js";
import {
  clearProductReviews,
  clearTop5ReviewCache,
} from "../utils/cacheUtils.js";
import {
  receivedReviewReplyByAdminTemplate,
  receivedReviewTemplate,
} from "../utils/emailTemplate.js";
import redis from "../utils/redis.js";
import sendEmail from "../utils/sendEmail.js";

// add review
export const createReview = async (req, res) => {
  try {
    const userId = req.user._id;

    const { productId } = req.params;
    const { rating, title, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ success: false, message: "Rating must be between 1 and 5." });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    const existingReview = await Review.findOne({
      product: productId,
      user: userId,
    });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this product.",
      });
    }

    const review = await Review.create({
      product: productId,
      user: userId,
      title: title,
      rating: rating,
      comment: comment,
    });

    const allReviews = await Review.find({ product: productId });

    const averageRating =
      allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    product.averageRating = Number(averageRating.toFixed(1));
    product.numReviews = allReviews.length;
    await product.save();
    const adminEmail = process.env.ADMIN_EMAIL; // Or load from DB

    await sendEmail(
      adminEmail,
      "New Review",
      receivedReviewTemplate(req.user.name, product.title, comment, rating)
    );
    await clearTop5ReviewCache();
    await clearProductReviews(productId);
    return res.status(200).json({
      success: true,
      message: "Reviewed  successfully.",
      review: review,
    });
  } catch (error) {
    console.error("Error creating review:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// get product reviews
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { sort, limit = 10, page = 1, rating } = req.query;

    const skip = (page - 1) * limit;
    const cacheKey = `reviews:product:${productId}:sort:${
      sort || "latest"
    }:rating:${rating || "all"}:page:${page}:limit:${limit}`;

    // Check cache
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const sortBy = sort || "latest";
    const sortOptions = { createdAt: -1 };
    if (sortBy === "highest") sortOptions = { rating: -1 };
    if (sortBy === "lowest") sortOptions = { rating: 1 };

    const ratingFilters = rating ? { rating: Number(rating) } : {};

    const product = await Product.findById(productId);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    const reviews = await Review.find({
      product: productId,

      ...ratingFilters,
    })
      .populate({
        path: "userInfo",
        select: "name avatar",
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();

    if (!reviews) {
      return res
        .status(404)
        .json({ success: false, message: "Reviews not found." });
    }
    const total = await Review.countDocuments({
      product: productId,
    });
    product.numReviews = total;

    product.save();
    const response = {
      success: true,
      reviews: reviews,
      Total: total,
      Page: page,
      Limit: limit,
    };
    await redis.set(cacheKey, response, { ex: 600 }); // cache for 10 minutes

    return res.status(200).json(response);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// update review
export const updateReview = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ success: false, message: "Rating must be between 1 and 5." });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    const review = await Review.findOne({
      product: productId,
      user: userId,
    });

    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found." });
    }

    review.rating = rating;
    review.comment = comment || review.comment;
    review.edited = true;

    await review.save();

    return res.status(200).json({
      success: true,
      message: "Review updated successfully.",
    });
  } catch (error) {
    console.error("Error updating review:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// delete review (User can delete his own review)
export const deleteReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    const review = await Review.findOne({
      product: productId,
      user: userId,
    });
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found." });
    }
    await review.deleteOne();
    await clearTop5ReviewCache();
    await clearProductReviews(productId);
    return res.status(200).json({
      success: true,
      message: "Review deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting review:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// update helpful count
export const updateHelpfulCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, reviewId } = req.params;
    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }
    const review = await Review.findById(reviewId);
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found." });
    }

    if (review.helpfulVotes.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: "You have already voted on this review.",
      });
    }

    review.helpfulVotes.push(userId);
    review.helpfulCount += 1;
    await review.save();
    return res.status(200).json({
      success: true,
      message: "Review updated successfully.",
    });
  } catch (error) {
    console.error("Error updating review:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
export const getMyreviews = async (req, res) => {
  try {
    const userId = req.user._id;

    const reviews = await Review.find({ user: userId })
      .populate({
        path: "product",
        select: "name images",
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "reviews fetched successfully",
      total: reviews.length,
      reviews: reviews,
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update Review Status ::ADMIN ONLY
export const updateReviewStatusByAdmin = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { status } = req.body;
    if (!["approved", "rejected", "pending"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }
    const updatedReview = await Review.findByIdAndUpdate(
      reviewId,
      { status },
      { new: true }
    );

    if (!updatedReview) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    }
    await clearTop5ReviewCache();
    await clearProductReviews(productId);
    return res.status(200).json({
      success: true,
      message: `Review status updated to ${status}`,
      data: updatedReview,
    });
  } catch (error) {
    console.error("Error updating review status:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete Reviews ::ADMIN ONLY
export const deleteReviewsByAdmin = async (req, res) => {
  try {
    const { reviewIds } = req.body;
    if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of review IDs",
      });
    }
    const deletedReviews = await Review.deleteMany({ _id: { $in: reviewIds } });
    await clearTop5ReviewCache();
    await clearProductReviews(productId);
    return res.status(200).json({
      success: true,
      message: `${deletedReviews.deletedCount} reviews deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting reviews:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get all reviews of a product ::ADMIN ONLY
export const getAllReviews = async (req, res) => {
  try {
    const { product, status } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (product) filters.product = product;
    const reviews = await Review.find(filters)
      .populate("userInfo")
      .populate("product", "name");

    return res.status(200).json({ success: true, reviews });
  } catch (error) {
    console.error("Error Getting reviews:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Reply to a review ::ADMIN ONLY
export const replyToReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reply } = req.body;

    const review = await Review.findById(reviewId)
      .populate("user", "email name")
      .populate("product", "title");
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    }

    console.log(review);
    review.adminReply = {
      reply: reply,
      repliedAt: Date.now(),
      repliedBy: req.user._id,
    };

    review.status = "approved";
    await review.save();
    const adminEmail = process.env.ADMIN_EMAIL; // Or load from DB

    await sendEmail(
      adminEmail,
      "Review Reply",
      receivedReviewReplyByAdminTemplate(
        req.user.name,
        review.product.title,
        review.title,
        review.comment,
        reply,
        review.rating
      )
    );
    await clearTop5ReviewCache();
    await clearProductReviews(productId);
    return res
      .status(200)
      .json({ success: true, message: "Reply sent successfully" });
  } catch (error) {
    console.error("Error Sending reply:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get Top 5 Reviews Across All Products
export const getTopFiveReviews = async (req, res) => {
  try {
    // Fetch top 5 reviews globally (best first)
    const cacheKey = "reviews:top5";
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        message: "Top 5 reviews fetched successfully (from cache).",
        reviews: cachedData,
      });
    }
    const topReviews = await Review.find()
      .populate({
        path: "user",
        select: "name avatar",
      })
      .populate({
        path: "product",
        select: "name images", // optional: what you want to show
      })
      .sort({ rating: -1, createdAt: -1 })
      .limit(5)
      .lean();
    await redis.set(cacheKey, topReviews, { ex: 600 }); // cache for 10 minutes
    return res.status(200).json({
      success: true,
      message: "Top 5 reviews fetched successfully.",
      reviews: topReviews,
    });
  } catch (error) {
    console.error("Error fetching top reviews:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
