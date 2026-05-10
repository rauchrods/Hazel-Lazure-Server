import { Router } from "express";
import {
  getAllProducts, getProductById,
  createProduct, updateProduct, deleteProduct,
} from "../controllers/products.controller.js";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", getAllProducts);
router.get("/:id", getProductById);
router.post("/", requireAdmin, createProduct);
router.patch("/:id", requireAdmin, updateProduct);
router.delete("/:id", requireAdmin, deleteProduct);

export default router;
