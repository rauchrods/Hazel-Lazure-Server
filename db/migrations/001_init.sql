-- Run this script once to bootstrap the database schema.
-- psql -U postgres -d hazel_lazure -f db/migrations/001_init.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USERS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  employee_id     VARCHAR(20)  UNIQUE NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   TEXT         NOT NULL,
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  gender          VARCHAR(20),
  designation     VARCHAR(100),
  privilege       VARCHAR(20)  NOT NULL DEFAULT 'default' CHECK (privilege IN ('admin', 'default')),
  phone           VARCHAR(20),
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── PRODUCTS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id           SERIAL PRIMARY KEY,
  product_id   VARCHAR(20)  UNIQUE NOT NULL,   -- e.g. "AL1001"
  category     VARCHAR(100) NOT NULL,           -- "Interior" | "Exterior"
  series       VARCHAR(100) NOT NULL,           -- "Allura"
  model_no     VARCHAR(200) NOT NULL,
  model_code   VARCHAR(50),
  item         VARCHAR(255),
  material     VARCHAR(255),
  finish       VARCHAR(255),
  dimension    VARCHAR(100),
  ip_rating    VARCHAR(20),
  wattage      VARCHAR(50),
  cct          VARCHAR(255),
  beam_angle   VARCHAR(100),
  driver       VARCHAR(255),
  driver_ip    VARCHAR(20),
  accessories  TEXT,
  unit         VARCHAR(50),
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── QUOTATIONS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotations (
  id              SERIAL PRIMARY KEY,
  quotation_no    VARCHAR(50)  UNIQUE NOT NULL,
  client_name     VARCHAR(255) NOT NULL,
  client_company  VARCHAR(255),
  client_email    VARCHAR(255),
  client_phone    VARCHAR(50),
  project_name    VARCHAR(255),
  date            DATE         NOT NULL DEFAULT CURRENT_DATE,
  valid_until     DATE,
  notes           TEXT,
  status          VARCHAR(20)  NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  created_by      INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── QUOTATION LINE ITEMS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotation_items (
  id             SERIAL PRIMARY KEY,
  quotation_id   INTEGER     NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id     INTEGER     REFERENCES products(id) ON DELETE SET NULL,
  description    TEXT,              -- free-text override if product is removed
  quantity       NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price     NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_pct   NUMERIC(5,2) NOT NULL DEFAULT 0,
  total          NUMERIC(14,2) GENERATED ALWAYS AS (
                   quantity * unit_price * (1 - discount_pct / 100)
                 ) STORED,
  sort_order     SMALLINT    NOT NULL DEFAULT 0
);

-- ─── AUTO-UPDATE updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_quotations_updated_at
  BEFORE UPDATE ON quotations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
