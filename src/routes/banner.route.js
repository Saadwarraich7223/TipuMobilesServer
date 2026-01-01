import express from "express";
import {
  createBanner,
  deleteBanner,
  getAllBanners,
} from "../controllers/banner.controller.js";
import upload from "../middlewares/multer.middleware.js";

const bannerRouter = express.Router();

bannerRouter.post("/create", upload.single("image"), createBanner);
bannerRouter.get("/", getAllBanners);
bannerRouter.delete("/:id", deleteBanner);

export default bannerRouter;
