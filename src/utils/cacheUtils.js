// export const clearProductCache = async () => {
//   try {
//     // Get all keys starting with "products:"
//     const keys = await redis.keys("products:*");

//     if (keys.length > 0) {
//       await redis.del(...keys);
//       console.log(` Cleared ${keys.length} product cache keys`);
//     } else {
//       console.log(" No product cache keys to clear");
//     }
//   } catch (error) {
//     console.error(" Error clearing product cache:", error);
//   }
// };

// export const clearSingleProductCache = async (productId) => {
//   try {
//     await redis.del(`product:${productId}`);
//     console.log(` Cleared cache for product ${productId}`);
//   } catch (error) {
//     console.error(" Error clearing single product cache:", error);
//   }
// };
