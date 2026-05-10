import pool from "../config/db.js";
import { AppError } from "../utils/AppError.js";

// GET /api/products?category=&series=&search=&page=1&limit=20
export const getAllProducts = async (req, res, next) => {
  try {
    const { category, series, search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions = ["is_active = TRUE"];
    const values = [];
    let idx = 1;

    if (category) { conditions.push(`category ILIKE $${idx++}`); values.push(category); }
    if (series)   { conditions.push(`series ILIKE $${idx++}`);   values.push(series); }
    if (search)   {
      conditions.push(`(model_no ILIKE $${idx} OR item ILIKE $${idx} OR product_id ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const where = conditions.join(" AND ");

    const [data, total] = await Promise.all([
      pool.query(
        `SELECT * FROM products WHERE ${where} ORDER BY category, series, id
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, Number(limit), offset]
      ),
      pool.query(`SELECT COUNT(*) FROM products WHERE ${where}`, values),
    ]);

    res.json({
      success: true,
      pagination: { page: Number(page), limit: Number(limit), total: Number(total.rows[0].count) },
      data: data.rows,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/products/:id
export const getProductById = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM products WHERE id=$1 AND is_active=TRUE",
      [req.params.id]
    );
    if (!rows[0]) return next(new AppError("Product not found.", 404));
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /api/products  (admin only)
export const createProduct = async (req, res, next) => {
  try {
    const {
      product_id, category, series, model_no, model_code, item, material, finish,
      dimension, ip_rating, wattage, cct, beam_angle, driver, driver_ip, accessories, unit,
    } = req.body;

    if (!product_id || !category || !series || !model_no) {
      return next(new AppError("product_id, category, series and model_no are required.", 400));
    }

    const { rows } = await pool.query(
      `INSERT INTO products
         (product_id, category, series, model_no, model_code, item, material, finish,
          dimension, ip_rating, wattage, cct, beam_angle, driver, driver_ip, accessories, unit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [product_id, category, series, model_no, model_code, item, material, finish,
       dimension, ip_rating, wattage, cct, beam_angle, driver, driver_ip, accessories, unit]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/products/:id  (admin only)
export const updateProduct = async (req, res, next) => {
  try {
    const allowed = [
      "category", "series", "model_no", "model_code", "item", "material", "finish",
      "dimension", "ip_rating", "wattage", "cct", "beam_angle", "driver", "driver_ip",
      "accessories", "unit",
    ];

    const fields = [];
    const values = [];
    let idx = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key}=$${idx++}`);
        values.push(req.body[key]);
      }
    }

    if (fields.length === 0) return next(new AppError("No valid fields to update.", 400));
    values.push(req.params.id);

    const { rows } = await pool.query(
      `UPDATE products SET ${fields.join(", ")} WHERE id=$${idx} AND is_active=TRUE RETURNING *`,
      values
    );
    if (!rows[0]) return next(new AppError("Product not found.", 404));
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/products/:id  (admin only - soft delete)
export const deleteProduct = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "UPDATE products SET is_active=FALSE WHERE id=$1 RETURNING id",
      [req.params.id]
    );
    if (!rows[0]) return next(new AppError("Product not found.", 404));
    res.json({ success: true, message: "Product removed." });
  } catch (err) {
    next(err);
  }
};
