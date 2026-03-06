import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/quantiva";

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
    const conn = await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
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
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // useCreateIndex: true, // mongoose 6+ doesn't need this
  });
  console.log("✓ Connected to MongoDB");
  return mongoose.connection;
}

export async function disconnectMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("✓ Disconnected from MongoDB");
  }
}

export function isMongoConnected() {
  return mongoConnection && mongoose.connection.readyState === 1;
}
