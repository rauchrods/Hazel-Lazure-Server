import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

import pool from "./config/db.js";
import router from "./routes/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Global Middlewares ────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api", router);

// 404 handler
app.use((_req, res) => res.status(404).json({ success: false, message: "Route not found." }));

// Central error handler (must be last)
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
async function startServer() {
  try {
    await pool.query("SELECT 1"); // verify DB connection
    console.log("PostgreSQL connected.");
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error("Failed to connect to PostgreSQL:", err.message);
    process.exit(1);
  }
}

startServer();
