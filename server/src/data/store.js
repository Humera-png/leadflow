import { newId } from "../utils/id.js";
import { connectMongo, isMongoConfigured } from "./db.js";

/**
 * In-memory store that doubles as a write-through cache in front of MongoDB.
 * Reads always come from the in-memory Map (synchronous, zero latency) — every
 * route in this app is written against that synchronous interface. When
 * MONGODB_URI is set, every insert/update/remove is also mirrored to Mongo in
 * the background (fire-and-forget) so data survives restarts/redeploys, and
 * on boot the Maps are hydrated from Mongo before the server starts accepting
 * requests. Without MONGODB_URI, behavior is identical to before: pure
 * in-memory, resets on restart.
 */
class Collection {
  constructor(name) {
    this.name = name;
    this.items = new Map();
    this.mongoCollection = null;
  }

  attachMongo(mongoCollection) {
    this.mongoCollection = mongoCollection;
  }

  async loadFromMongo() {
    if (!this.mongoCollection) return;
    const docs = await this.mongoCollection.find({}).toArray();
    for (const doc of docs) this.items.set(doc._id, doc);
  }

  _persist(record) {
    if (!this.mongoCollection) return;
    this.mongoCollection
      .replaceOne({ _id: record._id }, record, { upsert: true })
      .catch((err) => console.error(`[mongo] persist ${this.name} failed:`, err.message));
  }

  _persistDelete(id) {
    if (!this.mongoCollection) return;
    this.mongoCollection
      .deleteOne({ _id: id })
      .catch((err) => console.error(`[mongo] delete ${this.name} failed:`, err.message));
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

const ALL_COLLECTIONS = [leads, sequences, conversations, emailTemplates, meetings, users];

/**
 * Connects to Mongo (if configured), attaches each collection to its Mongo
 * counterpart, and loads existing documents into memory. Returns true if
 * Mongo is connected (so index.js knows whether to skip re-seeding demo
 * templates into an already-populated database).
 */
export async function hydrateFromMongo() {
  if (!isMongoConfigured()) return false;

  const db = await connectMongo();
  for (const collection of ALL_COLLECTIONS) {
    collection.attachMongo(db.collection(collection.name));
    await collection.loadFromMongo();
  }
  return true;
}
