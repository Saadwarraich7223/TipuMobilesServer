import mongoose from "mongoose";
import slugify from "slugify";

const categorySchema = new mongoose.Schema(
  {
    //  Category name
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      maxlength: 100,
    },

    // 🔗 Parent category (null = top-level)
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    //  SEO-friendly slug
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    //  Image ( only for top-level categories)
    image: {
      url: { type: String, trim: true },
      public_id: { type: String, trim: true },
    },

    // Active or inactive
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

//
//  Virtuals
//
categorySchema.virtual("children", {
  ref: "Category",
  localField: "_id",
  foreignField: "parent",
});

categorySchema.virtual("isRoot").get(function () {
  return !this.parent;
});

//
// METHODS
//
categorySchema.methods.hasChildren = async function () {
  const count = await this.model("Category").countDocuments({
    parent: this._id,
  });
  return count > 0;
};

categorySchema.methods.getFullPath = async function () {
  const path = [];
  let current = this;
  while (current) {
    path.unshift(current.name);
    if (!current.parent) break;
    current = await this.model("Category").findById(current.parent);
  }
  return path;
};

categorySchema.statics.getNestedCategories = async function (parentId = null) {
  const categories = await this.find({
    parent: parentId,
    status: "active",
  }).lean();

  for (let cat of categories) {
    cat.children = await this.getNestedCategories(cat._id);
  }

  return categories;
};

//
//  Middleware
//
categorySchema.pre("validate", function (next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }

  next();
});
categorySchema.statics.getAllCategoryIds = async function (categoryId) {
  const ids = [categoryId];

  const children = await this.find({ parent: categoryId }, "_id").lean();

  for (const child of children) {
    const childIds = await this.getAllCategoryIds(child._id);
    ids.push(...childIds);
  }

  return ids;
};

//
// ⚡ Indexes
//
categorySchema.index({ parent: 1, status: 1 });

const Category = mongoose.model("Category", categorySchema);
export default Category;
