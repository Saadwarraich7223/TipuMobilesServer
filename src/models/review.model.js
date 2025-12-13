import mongoose from "mongoose";
import { type } from "os";

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    comment: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    edited: {
      type: Boolean,
      default: false,
    },

    adminReply: {
      reply: { type: String, trim: true, maxlength: 1000 },
      repliedAt: { type: Date },
      repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // admin/staff user
    },

    helpfulCount: { type: Number, default: 0 },
    helpfulVotes: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

reviewSchema.virtual("userInfo", {
  ref: "User",
  localField: "user",
  foreignField: "_id",
  justOne: true,
  select: "name avatar",
});
reviewSchema.set("toObject", { virtuals: true });
reviewSchema.set("toJSON", { virtuals: true });
/* -----------------------------------------------------
    STATIC METHOD: calculate average rating & count
----------------------------------------------------- */
reviewSchema.statics.calculateProductStats = async function (productId) {
  try {
    // Safely cast productId to ObjectId (if string)
    const pid = mongoose.Types.ObjectId.isValid(productId)
      ? new mongoose.Types.ObjectId(productId)
      : productId;

    // Aggregate reviews for this product (approved & not deleted)
    const stats = await this.aggregate([
      { $match: { product: pid, status: "approved" } },
      {
        $group: {
          _id: "$product",
          averageRating: { $avg: "$rating" },
          numReviews: { $sum: 1 },
        },
      },
    ]);

    const { averageRating = 0, numReviews = 0 } = stats[0] || {};
    const roundedAvg = Math.round(averageRating * 10) / 10;

    await mongoose.model("Product").findByIdAndUpdate(productId, {
      averageRating: roundedAvg,
      numReviews,
    });

    console.log(
      `✅ Product ${productId} stats updated: avg=${roundedAvg}, total=${numReviews}`
    );
  } catch (err) {
    console.error("❌ Error calculating product stats:", err);
  }
};

/* -----------------------------------------------------
    MIDDLEWARE HOOKS
   Automatically recalculate product stats when needed
----------------------------------------------------- */

// When a review is created or updated
reviewSchema.post("save", async function () {
  await this.constructor.calculateProductStats(this.product);
});

// When a review is removed directly
reviewSchema.post("remove", async function () {
  await this.constructor.calculateProductStats(this.product);
});

// When deleted via findOneAndDelete or similar
reviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc && doc.product) {
    await doc.constructor.calculateProductStats(doc.product);
  }
});

// Optional: When admin updates review status (e.g., from pending → approved)
reviewSchema.post("findOneAndUpdate", async function (doc) {
  if (doc && doc.product) {
    await doc.constructor.calculateProductStats(doc.product);
  }
});

/* -----------------------------------------------------
    INDEXES for faster lookups
----------------------------------------------------- */
reviewSchema.index({ product: 1, status: 1 });
reviewSchema.index({ user: 1, product: 1 }, { unique: true }); // user can only review once

const Review = mongoose.model("Review", reviewSchema);
export default Review;
