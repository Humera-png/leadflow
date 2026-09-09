import pg from "pg";

const { Pool } = pg;

let pool = null;

const TABLES = ["leads", "sequences", "conversations", "emailTemplates", "meetings", "users", "notifications"];

export function isPostgresConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

/** Connects to Postgres (Neon) if DATABASE_URL is set. Returns the pool, or null in mock/in-memory mode. */
export async function connectPostgres() {
  if (!isPostgresConfigured()) return null;
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pool.query("select 1");
  for (const table of TABLES) {
    await pool.query(`create table if not exists ${table} (id text primary key, data jsonb not null)`);
  }
  console.log("[postgres] connected");
  return pool;
}

export function getPool() {
  return pool;
}
