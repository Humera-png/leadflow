import { MongoClient } from "mongodb";

let client = null;
let db = null;

/** Connects to MongoDB Atlas if MONGODB_URI is set. Returns the db handle, or null in mock/in-memory mode. */
export async function connectMongo() {
  if (!process.env.MONGODB_URI) return null;
  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db(); // uses the database name embedded in the URI
  console.log("[mongo] connected");
  return db;
}

export function getDb() {
  return db;
}

export function isMongoConfigured() {
  return Boolean(process.env.MONGODB_URI);
}
