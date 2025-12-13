import express from "express";
import {
  createFlashSale,
  deleteFlashSale,
  getActiveFlashSales,
  getExpiredFlashSales,
} from "../controllers/flashSale.controller.js";

const flashSaleRouter = express.Router();

flashSaleRouter.post("/", createFlashSale);
flashSaleRouter.get("/", getActiveFlashSales);
flashSaleRouter.get("/expired", getExpiredFlashSales);
flashSaleRouter.delete("/:id", deleteFlashSale);

export default flashSaleRouter;
