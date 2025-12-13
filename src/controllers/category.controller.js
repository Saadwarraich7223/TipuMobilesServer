import slugify from "slugify";
import Category from "../models/category.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import Product from "../models/product.model.js";
import FlashSale from "../models/flashSale.model.js";

// Utility for consistent responses
const success = (res, data, message = "Success") =>
  res.status(200).json({ success: true, message, data });
const error = (res, message = "Something went wrong", code = 500) =>
  res.status(code).json({ success: false, message });
// Create a category :: ADMIN ONLY
export const createCategory = async (req, res) => {
  try {
    const { parent, name, status } = req.body;
    const image = req.file;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
        data: null,
      });
    }

    if (parent && image) {
      return res.status(400).json({
        success: false,
        message: "Only top-level categories can have images",
        data: null,
      });
    }

    if (!parent && !image) {
      return res.status(400).json({
        success: false,
        message: "Top-level categories must have an image",
        data: null,
      });
    }

    const slug = slugify(name, { lower: true, strict: true });
    const existing = await Category.findOne({ slug });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Category already exists",
        data: null,
      });
    }

    let imageData;
    if (image) {
      const uploadedImg = await uploadOnCloudinary(image.path, "categories");
      if (!uploadedImg) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload Category Image",
          data: null,
        });
      }
      imageData = {
        url: uploadedImg.secure_url,
        public_id: uploadedImg.public_id,
      };
    }

    const category = new Category({
      name,
      parent: parent || null,
      image: imageData || "",
      status,
      slug,
    });

    await category.save();

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (err) {
    console.error(err.message);

    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Category already exists",
        data: null,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
      data: null,
    });
  }
};

// Get All Categories :: ADMIN ONLY
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().populate("parent", "name").lean();

    if (categories.length === 0) {
      return res.status(400).json({
        message: "No Categories Yet !",
        success: false,
      });
    }

    success(res, categories, "Categories Fetched Successfully");
  } catch (err) {
    console.error(err.message);
    error(res, err.message);
  }
};

// Get Nested Categories :: ADMIN ONLY
export const getNestedCategories = async (req, res) => {
  try {
    const nestedCategories = await Category.getNestedCategories();
    if (nestedCategories.length === 0) {
      return res.status(400).json({
        message: "No Categories found !",
        success: false,
      });
    }

    success(res, nestedCategories, "Categories Fetched Successfully");
  } catch (err) {
    console.error(err.message);
    error(res, err.message);
  }
};

// Get a single category ::ADMIN ONLY
export const getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate(
      "parent",
      "name"
    );
    if (!category) {
      return res.status(404).json({
        message: "Category not found",
        success: false,
      });
    }
    success(res, category, "Category Fetched Successfully");
  } catch (err) {
    console.error(err.message);
    error(res, err.message);
  }
};

// Delete a category :: ADMIN ONLY
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        message: "Category id is required",
        success: false,
      });
    }
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        message: "Category not found",
        success: false,
      });
    }
    const hasChildren = await category.hasChildren();

    if (hasChildren) {
      return res.status(400).json({
        message: "Category has children and cannot be deleted",
        success: false,
      });
    }

    await Category.findByIdAndDelete(id);
    success(res, `Category named ${category.name} deleted successfully`);
  } catch (err) {
    console.error(err.message);
    error(res, err.message);
  }
};

// Get Category Full Path
export const getFullPath = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        message: "Category id is required",
        success: false,
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
        success: false,
      });
    }

    const path = await category.getFullPath();

    success(res, path);
  } catch (err) {
    console.log(err);
    error(res, err.message);
  }
};

export const getProductsByCategory = async (req, res) => {
  try {
    const { slug } = req.params;

    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const {
      minPrice,
      maxPrice,
      brand,
      minRating,
      sort,
      freeDelivery,
      discount,
      minDiscount,
      maxDiscount,
      search,
    } = req.query;

    let filters = { status: "published" };

    // 1. CATEGORY
    if (slug) {
      const category = await Category.findOne({ slug });
      if (!category)
        return res.status(404).json({ message: "Category not found" });

      const allCatIds = await Category.getAllCategoryIds(category._id);
      filters.category = { $in: allCatIds };
    }

    // 2. SEARCH
    if (search && search.trim() !== "") {
      const keyword = search.trim();
      filters.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
      ];
    }

    // 3. OTHER FILTERS
    if (minPrice || maxPrice) {
      filters.price = {};
      if (minPrice) filters.price.$gte = Number(minPrice);
      if (maxPrice) filters.price.$lte = Number(maxPrice);
    }

    if (brand) filters.brand = { $in: brand.split(",") };
    if (minRating) filters.averageRating = { $gte: Number(minRating) };
    if (freeDelivery === "true") filters.freeDelivery = true;
    if (freeDelivery === "false") filters.freeDelivery = false;
    if (discount === "true") filters.discountPercent = { $gt: 0 };
    if (minDiscount || maxDiscount) {
      filters.discountPercent = {};
      if (minDiscount) filters.discountPercent.$gte = Number(minDiscount);
      if (maxDiscount) filters.discountPercent.$lte = Number(maxDiscount);
    }

    // 4. SORT
    let sortOptions = { createdAt: -1 };
    if (sort === "price_asc") sortOptions = { price: 1 };
    if (sort === "price_desc") sortOptions = { price: -1 };

    // 5. FETCH PRODUCTS
    const [products, total] = await Promise.all([
      Product.find(filters)
        .populate("category", "name slug")
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),

      Product.countDocuments(filters),
    ]);

    // 6. APPLY FLASH SALE
    const productIds = products.map((p) => p._id);

    const flashSales = await FlashSale.find({
      endTime: { $gt: new Date() },
      "products.product": { $in: productIds },
    }).lean();

    const flashSaleMap = {};

    flashSales.forEach((sale) => {
      sale.products.forEach((p) => {
        const prodId = p.product.toString();
        if (productIds.map((id) => id.toString()).includes(prodId)) {
          flashSaleMap[prodId] = {
            salePrice: p.salePrice,
            isInFlashSale: true,
            flashSaleEndTime: sale.endTime,
          };
        }
      });
    });

    // Attach flash sale info to products
    const productsWithSale = products.map((p) => ({
      ...p,
      salePrice: flashSaleMap[p._id.toString()]?.salePrice || null,
      isInFlashSale: flashSaleMap[p._id.toString()]?.isInFlashSale || false,
      flashSaleEndTime:
        flashSaleMap[p._id.toString()]?.flashSaleEndTime || null,
    }));

    // 7. RESPONSE
    return res.status(200).json({
      message: "Products fetched successfully",
      products: productsWithSale,
      total,
      hasMore: page * limit < total,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
};
