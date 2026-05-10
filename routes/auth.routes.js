import { Router } from "express";
import { login, register, getMe } from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/login", login);
router.post("/register", authenticate, requireAdmin, register);
router.get("/me", authenticate, getMe);

export default router;
