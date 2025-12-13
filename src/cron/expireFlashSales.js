import cron from "node-cron";
import FlashSale from "../models/flashSale.model.js";
import Product from "../models/product.model.js";

// Runs every minute
export const startFlashSaleCron = () => {
  cron.schedule("* * * * *", async () => {
    console.log("⏳ Checking for expired flash sales...");

    try {
      const now = new Date();

      // find flash sales that ended but not marked expired
      const expiredSales = await FlashSale.find({
        endTime: { $lt: now },
        isExpired: false,
      });

      if (expiredSales.length === 0) return;

      console.log(`Found ${expiredSales.length} flash sales to expire`);

      for (let sale of expiredSales) {
        // OPTIONAL: Restore products to original price
        for (let item of sale.products) {
          await Product.findByIdAndUpdate(item.product, {
            $unset: { salePrice: "" }, // remove temporary sale price
            $unset: { flashSaleId: "" },
          });
        }

        // mark flash Sale as expired
        sale.isExpired = true;
        await sale.save();
      }

      console.log("✔ Flash sales successfully expired");
    } catch (error) {
      console.error("❌ Cron error:", error);
    }
  });
};
