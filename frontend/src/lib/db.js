import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const dbName = process.env.MONGODB_DB_NAME || "better-auth";

let client;
let db;

export async function connectToDatabase() {
  if (client && db) {
    return { client, db };
  }

  // Validate environment variables
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  if (!dbName) {
    throw new Error("MONGODB_DB_NAME environment variable is required");
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);
    
    console.log("Connected to MongoDB successfully");
    return { client, db };
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

export { db };
