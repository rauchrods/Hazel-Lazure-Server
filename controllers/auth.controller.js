import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import { AppError } from "../utils/AppError.js";

const SALT_ROUNDS = 12;

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      privilege: user.privilege,
      employeeId: user.employee_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" },
  );
}

// POST /api/auth/login
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new AppError("Email and password are required.", 400));
    }

    const { rows } = await pool.query(
      "SELECT * FROM users WHERE email = $1 AND is_active = TRUE",
      [email.toLowerCase().trim()],
    );

    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return next(new AppError("Invalid email or password.", 401));
    }

    const token = signToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        employeeId: user.employee_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        designation: user.designation,
        privilege: user.privilege,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/register  (admin only)
export const register = async (req, res, next) => {
  try {
    const {
      email,
      password,
      first_name,
      last_name,
      gender,
      designation,
      privilege,
      phone,
    } = req.body;

    if (!email || !password || !first_name || !last_name) {
      return next(
        new AppError(
          "Required fields: email, password, first_name, last_name.",
          400,
        ),
      );
    }

    const existing = await pool.query(
      "SELECT id FROM users WHERE email=$1",
      [email],
    );
    if (existing.rows.length > 0) {
      return next(
        new AppError(
          "A user with that email already exists.",
          409,
        ),
      );
    }

    // Auto-generate employee_id: find the highest numeric suffix and increment
    const { rows: lastRows } = await pool.query(
      `SELECT employee_id FROM users
       ORDER BY CAST(SPLIT_PART(employee_id, '-', 2) AS INTEGER) DESC
       LIMIT 1`
    );
    const lastNum = lastRows[0]
      ? parseInt(lastRows[0].employee_id.split("-")[1], 10)
      : 0;
    const employee_id = `hzl-${lastNum + 1}`;

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, gender, employee_id, designation, privilege, phone)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, employee_id, email, first_name, last_name, designation, privilege`,
      [
        email.toLowerCase().trim(),
        hash,
        first_name,
        last_name,
        gender,
        employee_id,
        designation,
        privilege || "default",
        phone,
      ],
    );

    res.status(201).json({ success: true, user: rows[0] });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
export const getMe = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, employee_id, email, first_name, last_name, gender, designation, privilege, phone, created_at
     FROM users WHERE id = $1`,
      [req.user.id],
    );
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    next(err);
  }
};
