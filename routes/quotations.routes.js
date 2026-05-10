import { Router } from "express";
import {
  getAllQuotations, getQuotationById,
  createQuotation, updateQuotation, deleteQuotation,
  replaceQuotationItems,
} from "../controllers/quotations.controller.js";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", getAllQuotations);
router.get("/:id", getQuotationById);
router.post("/", createQuotation);
router.patch("/:id", updateQuotation);
router.delete("/:id", requireAdmin, deleteQuotation);
router.put("/:id/items", replaceQuotationItems);

export default router;
