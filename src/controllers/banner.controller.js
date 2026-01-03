import Banner from "../models/banner.model.js";
import { clearBannerCache } from "../utils/cacheUtils.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import redis from "../utils/redis.js";

export const createBanner = async (req, res) => {
  try {
    const { title, link, position, isActive, priority } = req.body;
    const image = req.file;

    if (!image) {
      return res.status(400).json({
        message: "Image is required",
        success: false,
      });
    }
    const uploadedImg = await uploadOnCloudinary(image.path, "banner");
    if (!uploadedImg) {
      return res.status(500).json({
        success: false,
        message: "Failed to upload Category Image",
        data: null,
      });
    }
    let imageData = {
      url: uploadedImg.secure_url,
      public_id: uploadedImg.public_id,
    };
    const banner = new Banner({
      title,
      image: imageData,
      link: link || "",
      position,
      isActive: isActive ?? true,
      priority: priority !== undefined ? priority : 0,
    });
    await banner.save();
    await clearBannerCache();
    return res.status(201).json({
      message: "Banner created successfully",
      success: true,
      data: banner,
    });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

// GET ALL BANNERS
export const getAllBanners = async (req, res) => {
  try {
    const { position, isActive } = req.query;

    const query = {};
    if (position) query.position = position;
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    const casheKey = `banners:${JSON.stringify(query)}`;
    const cachedData = await redis.get(casheKey);
    if (cachedData) {
      return res.status(200).json({
        message: "Banners fetched successfully(from cache)",
        success: true,
        data: cachedData,
      });
    }
    const banners = await Banner.find(query).sort({ priority: 1 });
    await redis.set(casheKey, banners, { ex: 600 });
    res.status(200).json({
      message: "Banners fetched successfully",
      success: true,
      data: banners,
    });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

// DELETE BANNER
export const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findByIdAndDelete(id);
    if (!banner) {
      return res.status(404).json({
        message: "Banner not found",
        success: false,
      });
    }
    await clearBannerCache();
    res.status(200).json({
      message: "Banner deleted successfully",
      success: true,
      data: banner,
    });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};
