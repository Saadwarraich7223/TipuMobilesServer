import mongoose from "mongoose";

const flashSaleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    endTime: { type: Date, required: true },
    isExpired: { type: Boolean, default: false },
    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        salePrice: {
          type: Number,
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

const FlashSale = mongoose.model("FlashSale", flashSaleSchema);
export default FlashSale;
