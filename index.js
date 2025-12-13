import dotenv from "dotenv";
dotenv.config();
import app from "./app.js";
import connectDB from "./src/config/connectDB.js";
import { configureCloudinary } from "./src/utils/cloudinary.js";
import { startFlashSaleCron } from "./src/cron/expireFlashSales.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB(); // connect DB first
    configureCloudinary(); // configure cloudinary
    startFlashSaleCron();
    app.listen(PORT, () => {
      console.log(" Server is running on port " + PORT);
    });
  } catch (err) {
    console.error(" Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
