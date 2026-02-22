import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { getMongoConnection, disconnectMongo } from "../services/mongodbConnection.js";
import { Candidate } from "../models/Candidate.js";

dotenv.config({ path: ".env" });

const ROOT = process.cwd();
const DATASET_PATHS = [
  path.join(ROOT, "public", "processed_dataset.json"),
  path.join(ROOT, "processed_dataset.json"),
];

async function loadDatasetFromDisk() {
  for (const p of DATASET_PATHS) {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      const data = JSON.parse(raw);
      return { data, path: p };
    }
  }

  throw new Error(`No dataset file found. Expected one of: ${DATASET_PATHS.join(", ")}`);
}

async function migrate() {
  try {
    console.log("🚀 Starting MongoDB migration...\n");

    // Connect to MongoDB
    await getMongoConnection();

    // Load dataset from disk
    const { data, path: sourcePath } = await loadDatasetFromDisk();
    console.log(`✓ Loaded ${data.length} candidates from ${sourcePath}`);

    // Clear existing data
    const deletedCount = await Candidate.deleteMany({});
    console.log(`✓ Cleared ${deletedCount.deletedCount} existing candidates`);

    // Insert new data in chunks to avoid memory/timeout issues
    const CHUNK_SIZE = 100;
    let inserted = 0;

    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const result = await Candidate.insertMany(chunk, { ordered: false }).catch((err) => {
        // Handle duplicate key errors gracefully
        if (err.code === 11000) {
          console.warn(
            `⚠ Duplicate candidates in chunk ${Math.floor(i / CHUNK_SIZE)} — skipping duplicates`
          );
          return { insertedCount: 0 };
        }
        throw err;
      });

      inserted += result.insertedCount;
      console.log(
        `✓ Inserted ${result.insertedCount} candidates (${Math.min(i + CHUNK_SIZE, data.length)}/${data.length})`
      );
    }

    // Verify indexes
    await Candidate.collection.getIndexes();
    console.log(`✓ Ensured indexes on critical fields`);

    // Final stats
    const count = await Candidate.countDocuments();
    const bySource = await Candidate.aggregate([
      { $group: { _id: "$source_dataset", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    console.log(`\n✅ Migration complete!\n`);
    console.log(`Total candidates in MongoDB: ${count}`);
    console.log(`Distribution by source:`);
    bySource.forEach((row) => {
      console.log(`  • ${row._id}: ${row.count}`);
    });
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await disconnectMongo();
  }
}

migrate();
