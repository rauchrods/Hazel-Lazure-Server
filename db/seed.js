/**
 * Seeds the database with initial users and products from the client data files.
 * Run once: node db/seed.js
 */

import "dotenv/config";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import bcrypt from "bcryptjs";
import pool from "../config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../../client/src/data");

async function seedUsers() {
  const raw = await readFile(path.join(dataDir, "users.json"), "utf-8");
  const users = JSON.parse(raw);

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 12);
    await pool.query(
      `INSERT INTO users
         (employee_id, email, password_hash, first_name, last_name, gender, designation, privilege, phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (email) DO NOTHING`,
      [u.employee_id, u.email, hash, u.first_name, u.last_name, u.gender, u.designation, u.privilege, u.phone]
    );
  }
  console.log(`Seeded ${users.length} users.`);
}

async function seedProducts() {
  const raw = await readFile(path.join(dataDir, "catalogue.json"), "utf-8");
  const catalogue = JSON.parse(raw);

  let count = 0;
  for (const [category, seriesMap] of Object.entries(catalogue)) {
    for (const [series, familyMap] of Object.entries(seriesMap)) {
      for (const products of Object.values(familyMap)) {
        for (const p of products) {
          await pool.query(
            `INSERT INTO products
               (product_id, category, series, model_no, model_code, item, material, finish,
                dimension, ip_rating, wattage, cct, beam_angle, driver, driver_ip, accessories, unit)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
             ON CONFLICT (product_id) DO NOTHING`,
            [
              p.id, category, series, p.modelNo, p.modelCode, p.item,
              p.material, p.finish, p.dimension, p.ipRating, p.wattage,
              p.cct, p.beamAngle, p.driver, p.driverIp, p.accessories, p.unit,
            ]
          );
          count++;
        }
      }
    }
  }
  console.log(`Seeded ${count} products.`);
}

async function main() {
  try {
    await seedUsers();
    await seedProducts();
    console.log("Seeding complete.");
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
