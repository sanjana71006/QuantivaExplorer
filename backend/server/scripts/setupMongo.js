import dotenv from "dotenv";
import { getMongoConnection, disconnectMongo } from "../services/mongodbConnection.js";
import { Candidate } from "../models/Candidate.js";
import { User } from "../models/User.js";
import bcrypt from "bcryptjs";

dotenv.config({ path: ".env" });

async function ensureIndexes() {
  console.log("Ensuring mongoose model indexes...");
  try {
    await Candidate.init();
    await User.init();
    console.log("✓ Indexes ensured for Candidate and User models");
  } catch (err) {
    console.error("Error ensuring indexes:", err?.message || err);
    throw err;
  }
}

async function seedAdminIfNeeded() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.log("No admin credentials provided in .env (ADMIN_EMAIL / ADMIN_PASSWORD). Skipping admin seed.");
    return;
  }

  const existing = await User.findOne({ email: String(adminEmail).toLowerCase() }).lean();
  if (existing) {
    console.log(`Admin user already exists: ${adminEmail}`);
    return;
  }

  const passwordHash = bcrypt.hashSync(String(adminPassword), 10);
  const doc = await User.create({ name: "Admin", email: String(adminEmail).toLowerCase(), passwordHash });
  console.log(`✓ Created admin user: ${doc.email}`);
}

async function main() {
  try {
    console.log("Connecting to MongoDB...");
    await getMongoConnection();
    console.log("Connected to MongoDB");

    await ensureIndexes();
    await seedAdminIfNeeded();

    // Report counts
    const candidateCount = await Candidate.countDocuments();
    const userCount = await User.countDocuments();
    console.log(`\nDatabase summary:\n  candidates: ${candidateCount}\n  users: ${userCount}\n`);
  } catch (err) {
    console.error("setupMongo failed:", err?.message || err);
    process.exitCode = 1;
  } finally {
    await disconnectMongo();
  }
}

main();
