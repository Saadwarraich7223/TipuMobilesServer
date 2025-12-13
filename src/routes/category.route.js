import { Router } from "express";
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategory,
  getFullPath,
  getNestedCategories,
  getProductsByCategory,
} from "../controllers/category.controller.js";
import adminAuth from "../middlewares/adminAuth.middleware.js";
import authenticateUser from "../middlewares/authenticateUser.middleware.js";
import upload from "../middlewares/multer.middleware.js";

const categoryRouter = Router();

/*==================== CREATE & DELETE ====================*/
categoryRouter.post("/create", upload.single("image"), createCategory);
categoryRouter.delete("/:id/delete", deleteCategory);

/*==================== READ ====================*/
categoryRouter.get("/", getAllCategories);
categoryRouter.get("/products", getProductsByCategory);

// fetch category products
categoryRouter.get("/:slug/products", getProductsByCategory);
categoryRouter.get("/nested", getNestedCategories);
categoryRouter.post("/:id/path", getFullPath);
categoryRouter.get("/:id", getCategory);

export default categoryRouter;
