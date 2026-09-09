import { newId } from "../utils/id.js";
import { connectPostgres, isPostgresConfigured } from "./db.js";

/**
 * In-memory store that doubles as a write-through cache in front of Postgres.
 * Reads always come from the in-memory Map (synchronous, zero latency) — every
 * route in this app is written against that synchronous interface. When
 * DATABASE_URL is set, every insert/update/remove is also mirrored to Postgres
 * in the background (fire-and-forget) so data survives restarts/redeploys, and
 * on boot the Maps are hydrated from Postgres before the server starts
 * accepting requests. Without DATABASE_URL, behavior is pure in-memory and
 * resets on restart.
 */
class Collection {
  constructor(name) {
    this.name = name;
    this.items = new Map();
    this.pool = null;
  }

  attachPg(pool) {
    this.pool = pool;
  }

  async loadFromPg() {
    if (!this.pool) return;
    const { rows } = await this.pool.query(`select data from ${this.name}`);
    for (const row of rows) this.items.set(row.data._id, row.data);
  }

  _persist(record) {
    if (!this.pool) return;
    this.pool
      .query(`insert into ${this.name} (id, data) values ($1, $2) on conflict (id) do update set data = $2`, [
        record._id,
        record,
      ])
      .catch((err) => console.error(`[postgres] persist ${this.name} failed:`, err.message));
  }

  _persistDelete(id) {
    if (!this.pool) return;
    this.pool
      .query(`delete from ${this.name} where id = $1`, [id])
      .catch((err) => console.error(`[postgres] delete ${this.name} failed:`, err.message));
  }

  all() {
    return [...this.items.values()];
  }

  find(predicate) {
    return predicate ? this.all().filter(predicate) : this.all();
  }

  findOne(predicate) {
    return this.all().find(predicate) ?? null;
  }

  get(id) {
    return this.items.get(id) ?? null;
  }

  insert(doc) {
    const record = { _id: doc._id ?? newId(), ...doc };
    this.items.set(record._id, record);
    this._persist(record);
    return record;
  }

  update(id, patch) {
    const existing = this.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, _id: existing._id };
    this.items.set(id, updated);
    this._persist(updated);
    return updated;
  }

  remove(id) {
    const existed = this.items.delete(id);
    if (existed) this._persistDelete(id);
    return existed;
  }

  clear() {
    this.items.clear();
  }
}

export const leads = new Collection("leads");
export const sequences = new Collection("sequences");
export const conversations = new Collection("conversations");
export const emailTemplates = new Collection("emailTemplates");
export const meetings = new Collection("meetings");
export const users = new Collection("users");
export const notifications = new Collection("notifications");

const ALL_COLLECTIONS = [leads, sequences, conversations, emailTemplates, meetings, users, notifications];

/**
 * Connects to Postgres (if configured), attaches each collection to its table,
 * and loads existing rows into memory. Returns true if Postgres is connected
 * (so index.js knows whether to skip re-seeding demo templates into an
 * already-populated database).
 */
export async function hydrateFromDb() {
  if (!isPostgresConfigured()) return false;

  const pool = await connectPostgres();
  for (const collection of ALL_COLLECTIONS) {
    collection.attachPg(pool);
    await collection.loadFromPg();
  }
  return true;
}
