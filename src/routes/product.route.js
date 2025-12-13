import express from "express";
import {
  addProductVariant,
  createProduct,
  deleteProductPermanently,
  deleteProductVariant,
  fetchProducts,
  getProduct,
  getProductVaraint,
  restoreProduct,
  softDeleteProduct,
  updateProduct,
  updateProductStock,
  updateVariantStock,
} from "../controllers/product.controller.js";
import upload from "../middlewares/multer.middleware.js";

const productRouter = express.Router();

/*================CREATE & UPDATE =================== */
productRouter.post("/create", upload.array("images", 5), createProduct);
productRouter.patch("/:id/update", upload.array("images", 5), updateProduct);

/*================DELETE & RESTORE =================== */
productRouter.delete("/:id/delete", softDeleteProduct);
productRouter.post("/:id/restore", restoreProduct);
productRouter.delete("/:id/delete-permanently", deleteProductPermanently);

/*================READ OPERATIONS =================== */
productRouter.get("/", fetchProducts);
productRouter.get("/:id", getProduct);
/*================PRODUCT VARIANTS =================== */
productRouter.post("/:id/add-variant", addProductVariant);
productRouter.get("/:id/variants", getProductVaraint);
productRouter.delete("/:id/variants/:variantId/delete", deleteProductVariant);

/*================INVENTORY =================== */
productRouter.patch("/:id/inventory", updateProductStock);
productRouter.patch("/:id/variants/:variantId/inventory", updateVariantStock);

export default productRouter;
