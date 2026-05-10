import bcrypt from "bcryptjs";
import pool from "../config/db.js";
import { AppError } from "../utils/AppError.js";

// GET /api/users
export const getAllUsers = async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, employee_id, email, first_name, last_name, gender, designation, privilege, phone, is_active, created_at
       FROM users ORDER BY id`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:id
export const getUserById = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, employee_id, email, first_name, last_name, gender, designation, privilege, phone, is_active, created_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return next(new AppError("User not found.", 404));
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/:id
export const updateUser = async (req, res, next) => {
  try {
    const { first_name, last_name, gender, designation, privilege, phone, password } = req.body;

    // Non-admins can only update themselves
    if (req.user.privilege !== "admin" && req.user.id !== Number(req.params.id)) {
      return next(new AppError("Forbidden.", 403));
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (first_name) { fields.push(`first_name=$${idx++}`); values.push(first_name); }
    if (last_name)  { fields.push(`last_name=$${idx++}`);  values.push(last_name); }
    if (gender)     { fields.push(`gender=$${idx++}`);     values.push(gender); }
    if (designation){ fields.push(`designation=$${idx++}`);values.push(designation); }
    if (privilege && req.user.privilege === "admin") {
      fields.push(`privilege=$${idx++}`); values.push(privilege);
    }
    if (phone)    { fields.push(`phone=$${idx++}`);         values.push(phone); }
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      fields.push(`password_hash=$${idx++}`); values.push(hash);
    }

    if (fields.length === 0) return next(new AppError("No valid fields to update.", 400));

    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id=$${idx}
       RETURNING id, employee_id, email, first_name, last_name, designation, privilege`,
      values
    );

    if (!rows[0]) return next(new AppError("User not found.", 404));
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/:id  (soft delete – admin only)
export const deactivateUser = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "UPDATE users SET is_active=FALSE WHERE id=$1 RETURNING id",
      [req.params.id]
    );
    if (!rows[0]) return next(new AppError("User not found.", 404));
    res.json({ success: true, message: "User deactivated." });
  } catch (err) {
    next(err);
  }
};

