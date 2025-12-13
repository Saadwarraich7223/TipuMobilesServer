import FlashSale from "../models/flashSale.model.js";

// ==============================
// CREATE FLASH SALE
// ==============================
export const createFlashSale = async (req, res) => {
  try {
    const { title, endTime, products } = req.body;

    if (!title || !endTime || !products || !products.length) {
      return res.status(400).json({
        error: "Title, endTime, and at least one product are required.",
      });
    }

    for (let item of products) {
      if (!item.product || item.salePrice === undefined) {
        return res.status(400).json({
          error: "Each product must include product ID and salePrice.",
        });
      }
    }

    const flashSale = await FlashSale.create({ title, endTime, products });

    res.status(201).json({
      message: "Flash Sale created successfully",
      flashSale,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Something went wrong" });
  }
};

// ==============================
// GET ALL FLASH SALES
// ==============================
export const getAllFlashSales = async (req, res) => {
  try {
    const sales = await FlashSale.find()
      .sort({ createdAt: -1 })
      .populate("products.product");

    res.json(sales);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Something went wrong" });
  }
};

// ==============================
// GET ACTIVE FLASH SALES (not expired)
// ==============================

export const getActiveFlashSales = async (req, res) => {
  try {
    const activeSales = await FlashSale.find({
      endTime: { $gt: new Date() }, // active sales only
    })
      .sort({ endTime: 1 }) // closest ending first
      .populate("products.product") // populate product references
      .lean();

    // Map each flash sale to include full product data with sale info
    const result = activeSales.map((sale) => {
      const productsWithSale = sale.products
        .map((p) => {
          const product = p.product;
          if (!product) return null;

          return {
            ...product,
            salePrice: p.salePrice, // sale price
            isInFlashSale: true, // flag
            flashSaleEndTime: sale.endTime, // flash sale end time
          };
        })
        .filter(Boolean); // remove nulls

      return {
        _id: sale._id,
        title: sale.title,
        endTime: sale.endTime,
        isExpired: false,
        products: productsWithSale,
        createdAt: sale.createdAt,
        updatedAt: sale.updatedAt,
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

// ==============================
// GET EXPIRED FLASH SALES
// ==============================
export const getExpiredFlashSales = async (req, res) => {
  try {
    const expiredSales = await FlashSale.find({
      endTime: { $lte: new Date() }, // expired sales only
    })
      .sort({ endTime: -1 }) // most recent first
      .populate("products.product")
      .lean();

    // Map each expired flash sale to include product data
    const result = expiredSales.map((sale) => {
      const productsWithSale = sale.products
        .map((p) => {
          const product = p.product;
          if (!product) return null;

          return {
            ...product,
            salePrice: p.salePrice, // sale price
            isInFlashSale: true, // flag
            flashSaleEndTime: sale.endTime, // flash sale end time
          };
        })
        .filter(Boolean); // remove nulls

      return {
        _id: sale._id,
        title: sale.title,
        endTime: sale.endTime,
        isExpired: true, // mark as expired
        products: productsWithSale,
        createdAt: sale.createdAt,
        updatedAt: sale.updatedAt,
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Something went wrong" });
  }
};
// ==============================
// DELETE FLASH SALE
// ==============================
export const deleteFlashSale = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await FlashSale.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Flash sale not found" });
    }

    res.json({ message: "Flash sale deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Something went wrong" });
  }
};
