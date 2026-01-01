import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
    },

    image: {
      url: { type: String, trim: true },
      public_id: { type: String, trim: true },
    },

    link: {
      type: String,
    },

    position: {
      type: String,
      enum: ["top", "bottom", "middle"],
      default: "top",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    priority: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

bannerSchema.index({ position: 1, isActive: 1 });

const Banner = mongoose.model("Banner", bannerSchema);
export default Banner;
