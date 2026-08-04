import { newId } from "../utils/id.js";

/**
 * In-memory stand-in for the MongoDB collections described in the LeadFlow
 * schema. Swappable for Mongoose models later: every collection here maps
 * 1:1 to a future Mongo collection, and documents use `_id` throughout so
 * routes/services don't need to change when the real DB is wired in.
 */
class Collection {
  constructor(name) {
    this.name = name;
    this.items = new Map();
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
    return record;
  }

  update(id, patch) {
    const existing = this.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, _id: existing._id };
    this.items.set(id, updated);
    return updated;
  }

  remove(id) {
    return this.items.delete(id);
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
