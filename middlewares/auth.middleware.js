import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError.js";

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next(new AppError("Authentication token missing.", 401));
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, privilege, employeeId }
    next();
  } catch {
    next(new AppError("Invalid or expired token.", 401));
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.privilege !== "admin") {
    return next(new AppError("Forbidden: admin access required.", 403));
  }
  next();
}
