import mongoose from "mongoose";

let mongoConnection = null;
let isConnecting = false;

async function connectMongo() {
  if (mongoConnection) return mongoConnection;
  if (isConnecting) {
    // Wait for ongoing connection attempt
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (mongoConnection) {
          clearInterval(checkInterval);
          resolve(mongoConnection);
        }
      }, 100);
    });
  }

  isConnecting = true;

  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI environment variable is not set");
    }

    console.log("Connecting to MongoDB...");

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: "majority",
    });

    mongoConnection = conn;
    console.log(`✓ Connected to MongoDB: ${conn.connection.host}`);
    return mongoConnection;
  } catch (error) {
    console.error(`✗ MongoDB connection failed: ${error.message}`);
    isConnecting = false;
    throw error;
  }
}

export async function getMongoConnection() {
  return connectMongo().catch((err) => {
    console.error("Failed to get MongoDB connection:", err.message);
    return null;
  });
}

export async function disconnectMongo() {
  if (mongoConnection) {
    await mongoose.disconnect();
    mongoConnection = null;
    console.log("✓ Disconnected from MongoDB");
  }
}

export function isMongoConnected() {
  return mongoConnection && mongoose.connection.readyState === 1;
}
