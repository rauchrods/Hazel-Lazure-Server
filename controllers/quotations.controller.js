import pool from "../config/db.js";
import { AppError } from "../utils/AppError.js";

function generateQuotationNo() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `HZL-${yy}${mm}-${rand}`;
}

// GET /api/quotations?status=&page=1&limit=20
export const getAllQuotations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions = [];
    const values = [];
    let idx = 1;

    if (req.user.privilege !== "admin") {
      conditions.push(`q.created_by=$${idx++}`);
      values.push(req.user.id);
    }
    if (status) { conditions.push(`q.status=$${idx++}`); values.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [data, total] = await Promise.all([
      pool.query(
        `SELECT q.*, u.first_name || ' ' || u.last_name AS created_by_name
         FROM quotations q
         LEFT JOIN users u ON u.id = q.created_by
         ${where}
         ORDER BY q.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, Number(limit), offset]
      ),
      pool.query(`SELECT COUNT(*) FROM quotations q ${where}`, values),
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

// GET /api/quotations/:id  (with line items)
export const getQuotationById = async (req, res, next) => {
  try {
    const { rows: [quotation] } = await pool.query(
      `SELECT q.*, u.first_name || ' ' || u.last_name AS created_by_name
       FROM quotations q
       LEFT JOIN users u ON u.id = q.created_by
       WHERE q.id=$1`,
      [req.params.id]
    );
    if (!quotation) return next(new AppError("Quotation not found.", 404));

    if (req.user.privilege !== "admin" && quotation.created_by !== req.user.id) {
      return next(new AppError("Forbidden.", 403));
    }

    const { rows: items } = await pool.query(
      `SELECT qi.*, p.model_no, p.product_id AS product_code, p.item AS product_item
       FROM quotation_items qi
       LEFT JOIN products p ON p.id = qi.product_id
       WHERE qi.quotation_id=$1
       ORDER BY qi.sort_order, qi.id`,
      [quotation.id]
    );

    res.json({ success: true, data: { ...quotation, items } });
  } catch (err) {
    next(err);
  }
};

// POST /api/quotations
export const createQuotation = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      client_name, client_company, client_email, client_phone, project_name,
      date, valid_until, notes, items = [],
    } = req.body;

    if (!client_name) return next(new AppError("client_name is required.", 400));

    await client.query("BEGIN");

    const quotationNo = generateQuotationNo();
    const { rows: [quotation] } = await client.query(
      `INSERT INTO quotations
         (quotation_no, client_name, client_company, client_email, client_phone, project_name,
          date, valid_until, notes, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10)
       RETURNING *`,
      [quotationNo, client_name, client_company, client_email, client_phone,
       project_name, date || null, valid_until || null, notes, req.user.id]
    );

    if (items.length > 0) {
      const itemRows = items.map((_, i) => {
        const base = i * 6;
        return `($1, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
      });
      const flatValues = [quotation.id];
      items.forEach((item, i) => {
        flatValues.push(
          item.product_id || null,
          item.description || null,
          item.quantity ?? 1,
          item.unit_price ?? 0,
          item.discount_pct ?? 0,
          i
        );
      });
      await client.query(
        `INSERT INTO quotation_items
           (quotation_id, product_id, description, quantity, unit_price, discount_pct, sort_order)
         VALUES ${itemRows.join(",")}`,
        flatValues
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ success: true, data: quotation });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

// PATCH /api/quotations/:id
export const updateQuotation = async (req, res, next) => {
  try {
    const { rows: [existing] } = await pool.query(
      "SELECT * FROM quotations WHERE id=$1",
      [req.params.id]
    );
    if (!existing) return next(new AppError("Quotation not found.", 404));
    if (req.user.privilege !== "admin" && existing.created_by !== req.user.id) {
      return next(new AppError("Forbidden.", 403));
    }

    const allowed = [
      "client_name", "client_company", "client_email", "client_phone",
      "project_name", "date", "valid_until", "notes", "status",
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
      `UPDATE quotations SET ${fields.join(", ")} WHERE id=$${idx} RETURNING *`,
      values
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/quotations/:id  (admin only)
export const deleteQuotation = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "DELETE FROM quotations WHERE id=$1 RETURNING id",
      [req.params.id]
    );
    if (!rows[0]) return next(new AppError("Quotation not found.", 404));
    res.json({ success: true, message: "Quotation deleted." });
  } catch (err) {
    next(err);
  }
};

// PUT /api/quotations/:id/items - replace all line items atomically
export const replaceQuotationItems = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { items = [] } = req.body;
    const { rows: [existing] } = await pool.query(
      "SELECT created_by FROM quotations WHERE id=$1",
      [req.params.id]
    );
    if (!existing) return next(new AppError("Quotation not found.", 404));
    if (req.user.privilege !== "admin" && existing.created_by !== req.user.id) {
      return next(new AppError("Forbidden.", 403));
    }

    await client.query("BEGIN");
    await client.query("DELETE FROM quotation_items WHERE quotation_id=$1", [req.params.id]);

    if (items.length > 0) {
      const itemRows = items.map((_, i) => {
        const base = i * 6;
        return `($1, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
      });
      const flatValues = [req.params.id];
      items.forEach((item, i) => {
        flatValues.push(
          item.product_id || null,
          item.description || null,
          item.quantity ?? 1,
          item.unit_price ?? 0,
          item.discount_pct ?? 0,
          i
        );
      });
      await client.query(
        `INSERT INTO quotation_items
           (quotation_id, product_id, description, quantity, unit_price, discount_pct, sort_order)
         VALUES ${itemRows.join(",")}`,
        flatValues
      );
    }

    await client.query("COMMIT");

    const { rows } = await client.query(
      "SELECT * FROM quotation_items WHERE quotation_id=$1 ORDER BY sort_order, id",
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};
