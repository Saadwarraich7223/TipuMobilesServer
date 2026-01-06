import Product from "../models/product.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import Review from "../models/review.model.js";
import mongoose from "mongoose";
import FlashSale from "../models/flashSale.model.js";
import redis from "../utils/redis.js";

import {
  clearProductCache,
  clearSingleProductCache,
} from "../utils/cacheUtils.js";

const success = (res, data, message) => {
  return res.status(200).json({ success: true, message, data });
};
const error = (res, message, code) => {
  return res.status(code).json({ success: false, message });
};

// Create Product
export const createProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      price,
      oldPrice,
      stock,
      lowStock,
      isPreOrder,
      isFeatured,
      isFreeShipping,
      brand,
      tags,
      variants,
      status,
    } = req.body;

    //  1. Validate required fields
    if (!title || !description || !category || !price) {
      return res.status(400).json({
        success: false,
        message: "Title, description, category, and price are required.",
      });
    }

    //  2. Upload product images to Cloudinary
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      const uploads = req.files.map((file) => uploadOnCloudinary(file.path));
      const results = await Promise.all(uploads);
      imageUrls = results.map((r) => r.secure_url);
    }

    //  3. Parse tags and variants if sent as JSON strings
    const parsedTags =
      typeof tags === "string"
        ? tags.split(",").map((t) => t.trim().toLowerCase())
        : tags || [];

    const parsedVariants =
      typeof variants === "string" ? JSON.parse(variants) : variants || [];

    //  4. Create product object
    const productData = {
      title,
      description,
      category,
      price: price,
      oldPrice: oldPrice ? oldPrice : null,
      stock: Number(stock) || 0,
      lowStock: Number(lowStock) || 0,
      isPreOrder: isPreOrder === "true" || isPreOrder === true,
      isFeatured: isFeatured === "true" || isFeatured === true,
      isFreeShipping: isFreeShipping === "true" || isFreeShipping === true,
      brand,
      tags: parsedTags,
      variants: parsedVariants,
      images: imageUrls,
      status: status || "draft",
      createdBy: req.user ? req.user._id : null, // optional: track admin
    };

    const product = await Product.safeCreate(productData);
    // 5. Clear product cache
    await clearProductCache();

    res.status(201).json({
      success: true,
      message: " Product created successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating product",
      error: error.message,
    });
  }
};

// Update Product :: ADMIN ONLY
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id)
      return res
        .status(400)
        .json({ message: "Product id is required", success: false });

    const product = await Product.findById(id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    const updates = req.body;

    // Handle variants
    if (updates.variants) {
      let parsedVariants = updates.variants;
      if (typeof parsedVariants === "string") {
        try {
          parsedVariants = JSON.parse(parsedVariants);
        } catch {
          parsedVariants = [];
        }
      }
      product.variants = Array.isArray(parsedVariants) ? parsedVariants : [];
    }

    // Handle tags
    if (updates.tags) {
      let parsedTags = updates.tags;
      if (typeof parsedTags === "string") {
        try {
          parsedTags = JSON.parse(parsedTags);
        } catch {
          parsedTags = parsedTags.split(",").map((t) => t.trim().toLowerCase());
        }
      }
      product.tags = Array.isArray(parsedTags) ? parsedTags : [];
    }

    // Handle images
    let finalImages = [];
    if (updates.existingImages) {
      try {
        finalImages = JSON.parse(updates.existingImages);
      } catch {
        finalImages = Array.isArray(updates.existingImages)
          ? updates.existingImages
          : [updates.existingImages];
      }
    }
    if (req.files?.length > 0) {
      const uploads = req.files.map((file) => uploadOnCloudinary(file.path));
      const results = await Promise.all(uploads);
      finalImages.push(...results.map((r) => r.secure_url));
    }
    product.images = finalImages;

    // Update other allowed fields safely
    const allowedFields = [
      "title",
      "description",
      "brand",
      "price",
      "oldPrice",
      "stock",
      "lowStock",
      "isPreOrder",
      "isFeatured",
      "isFreeShipping",
      "category",
      "status",
    ];

    const updatedFields = [];
    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        // update even falsy values
        product[field] = updates[field];
        updatedFields.push(field);
      }
    });

    product.updatedAt = Date.now();
    await product.save();
    await clearProductCache();
    await clearSingleProductCache(id);

    return res.status(200).json({
      success: true,
      message: `Updated fields: ${updatedFields.join(", ")}`,
    });
  } catch (err) {
    console.error("Update product error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

// get single product by ID
export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product ID" });
    }
    const cacheKey = `product:${id}`;
    const cachedProduct = await redis.get(cacheKey);
    if (cachedProduct) {
      return res.status(200).json({
        success: true,
        message: "Product fetched successfully (cache)",
        data: cachedProduct,
      });
    }
    const product = await Product.findById(id).populate("category", "name");

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // ==== CHECK FLASH SALE ====
    const flashSale = await FlashSale.findOne({
      endTime: { $gt: new Date() }, // still active
      "products.product": product._id, // product included
    });

    let salePrice = null;
    let isInFlashSale = false;
    let flashSaleEndTime = null;

    if (flashSale) {
      const saleItem = flashSale.products.find((p) =>
        p.product.equals(product._id)
      );

      if (saleItem) {
        salePrice = saleItem.salePrice;
        isInFlashSale = true;
        flashSaleEndTime = flashSale.endTime;
      }
    }

    const reviews = await Review.find({ product: product._id }).populate(
      "userInfo",
      "name avatar"
    );
    const responseData = {
      product,
      reviews,
      salePrice,
      isInFlashSale,
      flashSaleEndTime,
    };
    await redis.set(cacheKey, responseData, { ex: 2400 });

    return res.status(200).json({
      success: true,
      message: "Product Fetched Successfully",
      data: responseData,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Update Product Status :: ADMIN ONLY
export const updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        message: "Product id is required",
        success: false,
      });
    }
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({
        message: "Product status is required",
        success: false,
      });
    }
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    await clearProductCache();
    await clearSingleProductCache(id);
    success(res, updatedProduct, "Product Status Updated Successfully");
  } catch (err) {
    console.error(err.message);
    error(res, err.message);
  }
};

// Delete Product :: ADMIN ONLY
export const softDeleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        message: "Product id is required",
        success: false,
      });
    }
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        message: "Product not found",
        success: false,
      });
    }
    await product.discontinue();
    await clearProductCache();
    await clearSingleProductCache(id);
    success(res, `Product named ${product.title} deleted successfully`);
  } catch (err) {
    console.error(err.message);
    error(res, err.message, 500);
  }
};

// Restore Deleted Product  ::ADMIN ONLY
export const restoreProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        message: "Product id is required",
        success: false,
      });
    }
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        message: "Product not found",
        success: false,
      });
    }
    await product.restore();
    await clearProductCache();
    await clearSingleProductCache(id);
    success(res, `Product named ${product.title} restored successfully`);
  } catch (err) {
    console.error(err.message);
  }
};

// Get Product list with filters
export const fetchProducts = async (req, res) => {
  try {
    const casheKey = `products:${JSON.stringify(req.query)}`;
    const cachedData = await redis.get(casheKey);

    if (cachedData) {
      return res.status(200).json({
        success: true,
        message: "Products fetched successfully",
        data: cachedData,
      });
    }

    const { products, pagination } = await Product.fetchProducts(req.query);
    if (products.length === 0) {
      return res.status(404).json({
        message: "No Product Found",
        success: false,
      });
    }
    const responseData = { products, pagination };
    await redis.set(casheKey, responseData, { ex: 1200 });

    return res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      data: responseData,
    });
  } catch (err) {
    console.log(err);
    error(res, err, 500);
  }
};

/*=======================PRODUCT VARIANTS====================== */

// Add Product Variant
export const addProductVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const variantData = req.body;

    if (!id) {
      return res.status(400).json({
        message: "Product id is required",
        success: false,
      });
    }
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        message: "Product not found",
        success: false,
      });
    }
    if (!variantData) {
      return res.status(400).json({
        message: "Variant data is required",
        success: false,
      });
    }
    product.variants.push(variantData);
    await product.save();
    clearProductCache();
    clearSingleProductCache(id);
    return res.status(200).json({
      success: true,
      message: `Variant of product ${product.title} added successfully`,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// Delete Product Variant
export const deleteProductVariant = async (req, res) => {
  try {
    const { id, variantId } = req.params;
    if (!id) {
      return res.status(400).json({
        message: "Product id is required",
        success: false,
      });
    }
    if (!variantId) {
      return res.status(400).json({
        message: "Variant id is required",
        success: false,
      });
    }
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        message: "Product not found",
        success: false,
      });
    }
    const variant = product.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({
        message: "Variant not found",
        success: false,
      });
    }
    product.variants.pull(variantId);
    await product.save();
    clearProductCache();
    clearSingleProductCache(id);
    return res.status(200).json({
      success: true,
      message: `Variant of product ${product.title} deleted successfully`,
    });
  } catch (err) {
    console.error(err.message);
    error(res, err.message, 500);
  }
};

// Get Product Varient
export const getProductVaraint = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        message: "Product id is required",
        success: false,
      });
    }
    const product = await Product.findById(id).lean();

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
        success: false,
      });
    }

    const variants = product.variants;

    return res.status(200).json({
      success: true,
      message: "Product Varient fetched successfully",
      data: variants,
    });
  } catch (error) {
    console.error(error.message);
    error(res, error.message, 500);
  }
};

/*=======================PRODUCT INVENTORY====================== */

export const updateProductStock = async (req, res) => {
  try {
    const { stock, operation } = req.body;
    const { id } = req.params;
    if (!stock || !operation) {
      return res.status(400).json({
        message: "Stock and operation is required",
        success: false,
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        message: "Product not found",
        success: false,
      });
    }

    if (operation === "increase") {
      product.stock = product.stock + stock;
    }
    if (operation === "decrease") {
      if (product.stock < stock) {
        return res.status(400).json({
          message: "Not enough stock",
          success: false,
        });
      }

      product.stock = product.stock - stock;
    }

    await product.save();
    clearProductCache();
    clearSingleProductCache(id);
    return res.status(200).json({
      success: true,
      message: `Stock of product ${product.title} ${operation} by ${stock} successfully`,
    });
  } catch (err) {
    console.log(err);
    error(res, err.message, 500);
  }
};

export const updateVariantStock = async (req, res) => {
  try {
    const { stock, operation } = req.body;
    const { id, variantId } = req.params;

    const product = await Product.findById(id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    const variant = product.variants.id(variantId);
    if (!variant)
      return res
        .status(404)
        .json({ success: false, message: "Variant not found" });

    if (operation === "increase") {
      variant.stock += stock;
    } else if (operation === "decrease") {
      if (variant.stock < stock) {
        return res
          .status(400)
          .json({ success: false, message: "Not enough stock" });
      }
      variant.stock -= stock;
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid operation" });
    }

    await product.save();
    await clearProductCache();
    await clearSingleProductCache(id);
    return res.json({
      success: true,
      message: `Variant stock ${operation}d successfully by ${stock}`,
      variantStock: variant.stock,
    });
  } catch (error) {
    console.error("Update Variant Stock Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update variant stock",
      error: error.message,
    });
  }
};

export const deleteProductPermanently = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: "Product id is required",
        success: false,
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        message: "Product not found",
        success: false,
      });
    }

    if (product.images & Array.isArray(product.images)) {
      for (const image of product.images) {
        await cloudinary.uploader.destroy(image.public_id);
      }
    }

    await Product.findByIdAndDelete(id);
    clearProductCache();
    clearSingleProductCache(id);
    return res.status(200).json({
      success: true,
      message: `Product named ${product.title} deleted successfully`,
    });
  } catch (err) {
    console.log(err);
    error(res, err.message, 500);
  }
};
