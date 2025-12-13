// product.model.v2.js
import mongoose from "mongoose";
import slugify from "slugify";
import validator from "validator";
import { nanoid } from "nanoid"; // short unique id for safe fallback

const { Schema } = mongoose;

// Variant schema
const variantSchema = new Schema(
  {
    sku: { type: String, index: true, sparse: true, trim: true },
    title: { type: String, trim: true },
    price: { type: Number, min: 0 },
    oldPrice: { type: Number, min: 0 },
    stock: { type: Number, min: 0, default: 0 },
    attributes: { type: Schema.Types.Mixed }, // flexible attributes per variant
    images: {
      type: [String],
      default: [],
      validate: {
        validator(arr) {
          return (
            Array.isArray(arr) &&
            arr.every(
              (u) => !u || validator.isURL(u, { require_protocol: true })
            )
          );
        },
        message: "Variant images must be valid URLs with protocol (https://)",
      },
    },
  },
  { timestamps: false }
);

// Product schema
const productSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Product title is required"],
      maxlength: [200, "Product title cannot exceed 200 characters"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      minlength: [10, "Product description must be at least 10 characters"],
      trim: true,
    },

    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },

    images: {
      type: [String],
      default: [],
      validate: {
        validator(arr) {
          return (
            Array.isArray(arr) &&
            arr.every(
              (u) => !u || validator.isURL(u, { require_protocol: true })
            )
          );
        },
        message: "Each image must be a valid URL (include http/https)",
      },
    },

    brand: { type: String, trim: true, maxlength: 100 },

    /* prices in  (internal) */
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },
    oldPrice: {
      type: Number,
      min: [0, "Old price cannot be negative"],
      default: null,
    },

    stock: { type: Number, default: 0, min: [0, "Stock cannot be negative"] },
    lowStock: {
      type: Number,
      default: 0,
      min: [0, "Low stock threshold cannot be negative"],
    },
    isPreOrder: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },

    variants: { type: [variantSchema], default: [] },

    isFreeShipping: { type: Boolean, default: false },

    // Reviews
    averageRating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },

    metaTitle: { type: String, maxlength: 60, trim: true },
    slug: {
      type: String,
      required: true,

      lowercase: true,
      trim: true,
    },

    tags: { type: [String], default: [] },
    metaDescription: { type: String, maxlength: 160, trim: true },

    /* lifecycle */
    status: {
      type: String,
      enum: ["draft", "published", "discontinued", "deleted"],
      default: "published",
    },

    publishedAt: { type: Date, default: null },
    discontinuedAt: { type: Date, default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ==========INDEXES========== */
// Slug must be unique
productSchema.index({ slug: 1 }, { unique: true });

// For filtering products by category + status
productSchema.index({ category: 1, status: 1 });

// For sorting by price
productSchema.index({ price: 1 });

// Full-text search
productSchema.index(
  { title: "text", description: "text", tags: "text" },
  { weights: { title: 5, description: 2, tags: 1 } }
);

// Optimize queries for published products
productSchema.index(
  { status: 1, publishedAt: 1 },
  { partialFilterExpression: { status: "published" } }
);

/* ==========VIRTUALS========== */

productSchema.virtual("availability").get(function () {
  if (this.isPreOrder) return "pre-order";
  if (this.status === "discontinued") return "discontinued";
  if (this.status === "deleted") return "deleted";
  return this.stock > 0 ? "in-stock" : "out-of-stock";
});

productSchema.virtual("stateLabel").get(function () {
  if (this.isDeleted) return "deleted";
  if (this.status === "draft") return "draft";
  if (this.status === "published") return "live";
  if (this.status === "discontinued") return "discontinued";
  return "unknown";
});

productSchema.virtual("discountPercent").get(function () {
  if (this.oldPrice && this.price) {
    return Math.round(((this.oldPrice - this.price) / this.oldPrice) * 100);
  }
  return 0;
});

productSchema.virtual("reviews", {
  ref: "Review",
  localField: "_id",
  foreignField: "product",
});

/* ==========MIDDLEWARE========== */
productSchema.pre("validate", async function () {
  // normalize title
  if (typeof this.title === "string") this.title = this.title.trim();

  // normalize tags
  if (Array.isArray(this.tags)) {
    this.tags = [
      ...new Set(
        this.tags.filter(Boolean).map((t) => String(t).trim().toLowerCase())
      ),
    ];
  } else {
    this.tags = [];
  }

  // ensure images array
  if (!Array.isArray(this.images)) this.images = [];

  // slug
  if (this.slug) {
    this.slug = slugify(this.slug, { lower: true, strict: true }).slice(0, 180);
  }

  //  Numeric Safety
  if (this.price != null) this.price = Math.max(0, Number(this.price));
  if (this.oldPrice != null) this.oldPrice = Math.max(0, Number(this.oldPrice));
  if (this.stock != null) this.stock = Math.max(0, Number(this.stock));
});

/* ==========METHODS========== */
productSchema.methods.calculateDiscountPercentage = function () {
  if (this.oldPrice && this.price) {
    return Math.round(((this.oldPrice - this.price) / this.oldPrice) * 100);
  }
  return 0;
};

productSchema.methods.isInStock = function () {
  return this.stock > 0;
};

productSchema.methods.markAsDeleted = async function () {
  if (this.status === "deleted") return this;
  this.status = "deleted";
  await this.save();
  return this;
};

productSchema.methods.restore = async function () {
  if (this.status !== "deleted") return this;
  this.status = "published"; // or "published" if you want direct republish
  await this.save();
  return this;
};

productSchema.methods.publish = async function () {
  if (this.status === "published") return this;
  this.status = "published";
  this.publishedAt = new Date();
  await this.save();
  return this;
};

productSchema.methods.moveToDraft = async function () {
  if (this.status === "draft") return this;
  this.status = "draft";
  this.publishedAt = null;
  await this.save();
  return this;
};

productSchema.methods.discontinue = async function () {
  if (this.status === "discontinued") return this;
  this.status = "discontinued";
  this.discontinuedAt = new Date();
  await this.save();
  return this;
};

/* -------------------------
   Static methods & query helpers
   ------------------------- */
productSchema.statics.getActiveProducts = function () {
  return this.find({
    status: "published",
    stock: { $gt: 0 },
  });
};

productSchema.statics.getDrafts = function () {
  return this.find({ status: "draft" });
};

productSchema.statics.searchByKeyword = function (keyword) {
  if (!keyword) return this.find({ status: { $ne: "deleted" } });
  const regex = new RegExp(keyword, "i");
  return this.find({
    status: { $ne: "deleted" },
    $or: [{ title: regex }, { description: regex }],
  });
};

productSchema.statics.getDiscountedProducts = function () {
  return this.find({
    status: { $ne: "deleted" },
    oldPrice: { $gt: 0 },
    $expr: { $lt: ["$price", "$oldPrice"] },
  });
};

// Safe create helper — retries on duplicate slug by appending a nanoid suffix
productSchema.statics.safeCreate = async function (data, options = {}) {
  const attempts = options.attempts || 3;
  let lastErr = null;

  // ensure slug exists (use slugify if missing)
  if (!data.slug && data.title) {
    data.slug = slugify(String(data.title).trim(), {
      lower: true,
      strict: true,
    }).slice(0, 180);
  }

  for (let i = 0; i < attempts; i += 1) {
    try {
      const doc = await this.create(data);
      return doc;
    } catch (err) {
      lastErr = err;
      // duplicate key on slug -> mutate slug and retry
      if (err.code === 11000 && err.keyPattern && err.keyPattern.slug) {
        data.slug = `${data.slug}-${nanoid(6)}`; // short unique suffix
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
};

productSchema.statics.fetchProducts = async function (query) {
  try {
    const {
      status,
      isFeatured,
      isFreeShipping,
      brand,
      category,
      q,
      sort,
      limit = 10,
      page = 1,
      stock,
      minPrice,
      maxPrice,
      minRating,
    } = query;

    const filter = {};

    if (status) {
      filter.status = status;
    } else {
      filter.status = { $ne: "discontinued" };
    }
    if (brand) filter.brand = brand;
    if (stock) filter.stock = stock;
    if (isFeatured !== undefined) filter.isFeatured = isFeatured === "true";
    if (isFreeShipping !== undefined)
      filter.isFreeShipping = isFreeShipping === "true";
    if (q) filter.title = { $regex: q, $options: "i" };
    if (category) filter.category = category;

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    if (minRating) {
      filter.rating = { $gte: parseFloat(minRating) };
    }

    const allowedSortFields = [
      "price",
      "-price",
      "createdAt",
      "-createdAt",
      "stock",
      "-stock",
    ];
    const sortOption = allowedSortFields.includes(sort) ? sort : "-createdAt";

    const perPage = Math.max(parseInt(limit) || 10, 1);
    const currentPage = Math.max(parseInt(page) || 1, 1);
    const skip = (currentPage - 1) * perPage;

    const products = await Product.find(filter)
      .populate("category", "name")
      .sort(sortOption)
      .skip(skip)
      .limit(perPage)
      .lean();

    const total = await Product.countDocuments(filter);
    const totalPages = Math.ceil(total / perPage);

    return {
      products,
      pagination: {
        total,
        page: currentPage,
        totalPages,
        limit: perPage,
      },
    };
  } catch (err) {
    // optional: add status for easier error handling
    err.status = err.status || 500;
    throw err;
  }
};

const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);

export default Product;
