-- One-time bootstrap for the Node API when the app DB user cannot CREATE in schema public.
-- Run on the VPS (or any host that can reach Postgres) as a superuser / DB owner, e.g.:
--   sudo -u postgres psql -d YOUR_DATABASE_NAME -f server/sql/pg-bootstrap.sql
--
-- Then grant DML to your application role (replace site_user if your DATABASE_URL uses another name):
--   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO site_user;
--   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO site_user;
--   GRANT USAGE, CREATE ON SCHEMA public TO site_user;

CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retail_orders (
  order_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, payload)
VALUES ('exchangeRate', '{"usd_to_rub":95,"updated_at":null}'::jsonb)
ON CONFLICT (key) DO NOTHING;
