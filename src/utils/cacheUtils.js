import redis from "./redis.js";

export const clearProductCache = async () => {
  try {
    // Get all keys starting with "products:"
    const keys = await redis.keys("products:*");

    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(` Cleared ${keys.length} product cache keys`);
    } else {
      console.log(" No product cache keys to clear");
    }
  } catch (error) {
    console.error(" Error clearing product cache:", error);
  }
};

export const clearSingleProductCache = async (productId) => {
  try {
    await redis.del(`product:${productId}`);
    console.log(` Cleared cache for product ${productId}`);
  } catch (error) {
    console.error(" Error clearing single product cache:", error);
  }
};

export const clearCategoryCache = async () => {
  try {
    const keys = await redis.keys("category:*");
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(` Cleared ${keys.length} category cache keys`);
    } else {
      console.log(" No category cache keys to clear");
    }
  } catch (error) {
    console.error(" Error clearing category cache:", error);
  }
};

export const clearFlashSaleCache = async () => {
  try {
    const key = await redis.keys("flashSales:*");
    if (key) {
      await redis.del(key);
      console.log(` Cleared ${key.length} flashSale cache keys`);
    } else {
      console.log(" No flashSale cache keys to clear");
    }
  } catch (error) {
    console.error(" Error clearing flashSale cache:", error);
  }
};

export const clearBannerCache = async () => {
  try {
    const keys = await redis.keys("banners:*");
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(` Cleared ${keys.length} banner cache keys`);
    } else {
      console.log(" No banner cache keys to clear");
    }
  } catch (error) {
    console.error(" Error clearing flashSale cache:", error);
  }
};

export const clearTop5ReviewCache = async () => {
  try {
    const keys = await redis.keys("reviews:top5");
    if (keys) {
      await redis.del(keys);
      console.log(` Cleared ${keys.length} review cache keys`);
    } else {
      console.log(" No banner cache keys to clear");
    }
  } catch (error) {
    console.error(" Error clearing flashSale cache:", error);
  }
};
export const clearProductReviews = async (productId) => {
  try {
    const key = await redis.keys(`reviews:product:${productId}`);
    if (key) {
      await redis.del(key);
      console.log(` Cleared ${key} review cache keys`);
    } else {
      console.log(" No banner cache keys to clear");
    }
  } catch (error) {
    console.error(" Error clearing flashSale cache:", error);
  }
};
