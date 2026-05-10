import { Router } from "express";
import { getAllUsers, getUserById, updateUser, deactivateUser } from "../controllers/users.controller.js";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", requireAdmin, getAllUsers);
router.get("/:id", getUserById);
router.patch("/:id", updateUser);
router.delete("/:id", requireAdmin, deactivateUser);

export default router;
