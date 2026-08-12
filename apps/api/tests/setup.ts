/**
 * Applies all SQL migrations against DATABASE_URL before the test suite runs.
 * Requires a reachable Postgres instance (see docker-compose.yml -> postgres service).
 */
import fs from "fs";
import path from "path";
import { pool } from "../src/db";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../database/migrations");

async function applyMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  const applied = new Set(
    (await pool.query<{ id: string }>("SELECT id FROM schema_migrations")).rows.map((r) => r.id)
  );
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    await pool.query(sql);
    await pool.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
  }
}

beforeAll(async () => {
  await applyMigrations();
});

afterAll(async () => {
  await pool.end();
});
