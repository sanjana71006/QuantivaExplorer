import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = process.cwd();

// Look in multiple locations: backend folder, project root, frontend public
const CANDIDATE_PATHS = [
  path.join(__dirname, "..", "..", "processed_dataset.json"),  // backend/processed_dataset.json
  path.join(__dirname, "..", "..", "..", "frontend", "public", "processed_dataset.json"),  // frontend/public/
  path.join(ROOT, "backend", "processed_dataset.json"),
  path.join(ROOT, "frontend", "public", "processed_dataset.json"),
  path.join(ROOT, "public", "processed_dataset.json"),
  path.join(ROOT, "processed_dataset.json"),
];

let datasetCache = null;

function readDatasetFromDisk() {
  for (const p of CANDIDATE_PATHS) {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) {
        throw new Error(`Dataset at ${p} is not a JSON array`);
      }
      return { data, path: p };
    }
  }

  throw new Error(
    `No dataset file found. Expected one of: ${CANDIDATE_PATHS.join(", ")}`
  );
}

export function loadDataset() {
  if (datasetCache) return datasetCache;
  const loaded = readDatasetFromDisk();
  datasetCache = loaded;
  return datasetCache;
}

export function reloadDataset() {
  datasetCache = null;
  return loadDataset();
}

export function getDataset() {
  return loadDataset().data;
}

export function getDatasetMeta() {
  const { data, path: sourcePath } = loadDataset();

  const bySource = data.reduce((acc, row) => {
    const key = String(row.source_dataset ?? "unknown");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return {
    sourcePath,
    total: data.length,
    bySource,
    columns: data.length ? Object.keys(data[0]) : [],
  };
}

export function filterCandidates(data, query) {
  const {
    source,
    minScore,
    maxScore,
    minSafety,
    minEfficacy,
    search,
  } = query;

  let rows = data;

  if (source && source !== "all") {
    rows = rows.filter((r) => String(r.source_dataset).toLowerCase() === String(source).toLowerCase());
  }

  if (Number.isFinite(minScore)) {
    rows = rows.filter((r) => Number(r.drug_score) >= minScore);
  }

  if (Number.isFinite(maxScore)) {
    rows = rows.filter((r) => Number(r.drug_score) <= maxScore);
  }

  if (Number.isFinite(minSafety)) {
    rows = rows.filter((r) => Number(r.safety_index) >= minSafety);
  }

  if (Number.isFinite(minEfficacy)) {
    rows = rows.filter((r) => Number(r.efficacy_index) >= minEfficacy);
  }

  if (search) {
    const s = String(search).toLowerCase();
    rows = rows.filter(
      (r) =>
        String(r.candidate_id ?? "").toLowerCase().includes(s) ||
        String(r.name ?? "").toLowerCase().includes(s) ||
        String(r.smiles ?? "").toLowerCase().includes(s)
    );
  }

  return rows;
}
