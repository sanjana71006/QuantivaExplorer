import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  getDataset,
  getDatasetMeta,
  filterCandidates,
  reloadDataset,
} from "./services/datasetService.js";
import { getMongoConnection, isMongoConnected, disconnectMongo } from "./services/mongodbConnection.js";
import { Candidate } from "./models/Candidate.js";
import {
  defaultWeights,
  normalizeWeights,
  rankCandidates,
  computeWeightedScore,
} from "./utils/scoring.js";
import { fetchFromPubchem } from "./services/pubchemService.js";
import { fetchFromChembl } from "./services/chemblService.js";
import { loadLocalDataset } from "./services/datasetFallback.js";

const app = express();
const PORT = Number(process.env.PORT || 8080);

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Initialize MongoDB connection on startup
let mongoReady = false;
getMongoConnection()
  .then(() => {
    mongoReady = true;
    console.log("✓ Backend ready with MongoDB");
  })
  .catch((err) => {
    console.warn("⚠ MongoDB unavailable — falling back to JSON mode");
    console.warn(`   Reason: ${err.message}`);
  });

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

const assistantProvider = "dataset-grounded";
const assistantCache = {
  snapshot: null,
  expiresAt: 0,
};
const ASSISTANT_CACHE_TTL_MS = 30_000;

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function average(rows, key) {
  if (!rows.length) return 0;
  const sum = rows.reduce((acc, row) => acc + clamp01(row?.[key]), 0);
  return sum / rows.length;
}

function extractTopN(message) {
  const m = String(message).toLowerCase().match(/top\s*(\d{1,2})|best\s*(\d{1,2})/);
  const raw = Number(m?.[1] || m?.[2] || 5);
  return Math.min(Math.max(raw, 1), 10);
}

function detectPriority(message) {
  const lower = String(message).toLowerCase();
  if (/(efficacy|effectiveness|potency)/.test(lower)) return "efficacy";
  if (/(safety|toxicity|safer|risk)/.test(lower)) return "safety";
  if (/(balance|balanced|trade[-\s]?off)/.test(lower)) return "balance";
  return null;
}

function getPriorityWeights(priority) {
  if (priority === "efficacy") {
    return normalizeWeights({ efficacy: 0.65, safety: 0.25, complexityBalance: 0.1 });
  }
  if (priority === "safety") {
    return normalizeWeights({ efficacy: 0.25, safety: 0.65, complexityBalance: 0.1 });
  }
  if (priority === "balance") {
    return normalizeWeights({ efficacy: 0.45, safety: 0.35, complexityBalance: 0.2 });
  }
  return { ...defaultWeights };
}

function formatWeights(weights) {
  return `efficacy=${weights.efficacy.toFixed(2)}, safety=${weights.safety.toFixed(2)}, complexityBalance=${weights.complexityBalance.toFixed(2)}`;
}

async function getAssistantSnapshot() {
  const now = Date.now();
  if (assistantCache.snapshot && assistantCache.expiresAt > now) {
    return assistantCache.snapshot;
  }

  let rows = [];
  let bySource = {};

  if (mongoReady && isMongoConnected()) {
    rows = await Candidate.find(
      {},
      "candidate_id name source_dataset drug_score efficacy_index safety_index molecular_complexity"
    )
      .limit(5000)
      .lean();

    const grouped = await Candidate.aggregate([
      { $group: { _id: "$source_dataset", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    grouped.forEach((g) => {
      bySource[String(g._id || "unknown")] = Number(g.count || 0);
    });
  } else {
    const data = getDataset();
    rows = data.map((row) => ({
      candidate_id: row.candidate_id,
      name: row.name,
      source_dataset: row.source_dataset,
      drug_score: row.drug_score,
      efficacy_index: row.efficacy_index,
      safety_index: row.safety_index,
      molecular_complexity: row.molecular_complexity,
    }));

    rows.forEach((row) => {
      const key = String(row.source_dataset || "unknown");
      bySource[key] = (bySource[key] || 0) + 1;
    });
  }

  const snapshot = { rows, bySource, total: rows.length };
  assistantCache.snapshot = snapshot;
  assistantCache.expiresAt = now + ASSISTANT_CACHE_TTL_MS;
  return snapshot;
}

function chooseSourceFromMessage(message, rows) {
  const lower = String(message).toLowerCase();
  const sources = [...new Set(rows.map((r) => String(r.source_dataset || "")).filter(Boolean))];
  return sources.find((src) => lower.includes(src.toLowerCase())) || null;
}

async function generateAssistantReply({ message, history = [] }) {
  const safeMessage = String(message || "").trim();
  if (!safeMessage) {
    return "Please ask me something about the molecule dataset!";
  }

  try {
    const snapshot = await getAssistantSnapshot();

    // Build context from dataset snapshot
    const datasetContext = `You are Quantiva Assistant, an AI helper for drug discovery research using quantum-inspired exploration.

Dataset Context:
- Total candidates: ${snapshot.total}
- Top sources: ${Object.entries(snapshot.bySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `${name} (${count})`)
      .join(", ")}
- Mean efficacy index: ${average(snapshot.rows, "efficacy_index").toFixed(3)}
- Mean safety index: ${average(snapshot.rows, "safety_index").toFixed(3)}

Instructions:
1. Help users understand drug candidate rankings and molecule scoring
2. Explain efficacy vs safety trade-offs and optimization strategies
3. Provide insights about Lipinski's Rule of Five and drug-likeness
4. Answer questions about dataset statistics and candidate filtering
5. DO NOT provide medical advice or treatment recommendations
6. Keep responses concise and actionable for research teams
7. Focus on to the dataset and ranking methodology, not clinical use`;

    // Build conversation history properly formatted for Gemini
    const conversationHistory = history
      .slice(-6) // Use last 6 messages
      .map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }],
      }));

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // Combine context with the user message
    const contextualMessage = `${datasetContext}

User Query: ${safeMessage}`;

    try {
      // If we have conversation history, use startChat
      if (conversationHistory.length > 0) {
        const chat = model.startChat({ 
          history: conversationHistory
        });
        const result = await chat.sendMessage(safeMessage);
        const reply = result.response.text();
        return reply || "I couldn't generate a response. Please try rephrasing your question.";
      } else {
        // First message - include context
        const result = await model.generateContent(contextualMessage);
        const reply = result.response.text();
        return reply || "I couldn't generate a response. Please try rephrasing your question.";
      }
    } catch (chatError) {
      // Check for quota errors
      const errorMsg = String(chatError);
      if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("Quota exceeded")) {
        return "🔄 API rate limit reached. The free tier has a 50 requests/day limit. Please wait a moment or upgrade to a paid plan at https://ai.google.dev to enable billing.";
      }
      // Fallback: try without conversation history
      console.warn("Chat mode error, trying simpler approach:", chatError.message);
      try {
        const result = await model.generateContent(contextualMessage);
        const reply = result.response.text();
        return reply || "I couldn't generate a response. Please try rephrasing your question.";
      } catch (fallbackError) {
        console.error("Fallback error:", fallbackError);
        throw fallbackError;
      }
    }
  } catch (error) {
    const errorMsg = String(error);
    if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("Quota exceeded")) {
      return "🔄 API rate limit reached. The free tier has a 50 requests/day limit. Please wait a moment or upgrade to a paid plan at https://ai.google.dev to enable billing.";
    }
    console.error("Gemini API error:", error);
    return "Unable to generate response. Please check your internet connection and try again.";
  }
}
// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "quantiva-backend",
    mongoConnected: isMongoConnected(),
    timestamp: new Date().toISOString(),
  });
});

// Dataset metadata
app.get("/api/meta", async (_req, res) => {
  try {
    if (mongoReady && isMongoConnected()) {
      const count = await Candidate.countDocuments();
      const bySource = await Candidate.aggregate([
        { $group: { _id: "$source_dataset", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      const bySourceObj = {};
      bySource.forEach((row) => {
        bySourceObj[row._id] = row.count;
      });

      return res.json({
        source: "MongoDB",
        total: count,
        bySource: bySourceObj,
        columns: Object.keys(Candidate.schema.paths),
      });
    }

    // Fallback to JSON
    const meta = getDatasetMeta();
    return res.json({ source: "JSON (MongoDB unavailable)", ...meta });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reload dataset from disk
app.post("/api/reload", async (_req, res) => {
  try {
    const reloaded = reloadDataset();
    assistantCache.snapshot = null;
    assistantCache.expiresAt = 0;

    if (mongoReady && isMongoConnected()) {
      // Re-index MongoDB after reload
      const count = await Candidate.countDocuments();
      return res.json({
        ok: true,
        source: "MongoDB",
        total: count,
      });
    }

    return res.json({
      ok: true,
      source: "JSON",
      total: reloaded.data.length,
      sourcePath: reloaded.path,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get candidates with filtering
app.get("/api/candidates", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 1000);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);
    const sortBy = String(req.query.sortBy ?? "drug_score");
    const order = String(req.query.order ?? "desc").toLowerCase() === "asc" ? 1 : -1;

    if (mongoReady && isMongoConnected()) {
      // Use MongoDB
      const filters = {};

      if (req.query.source && req.query.source !== "all") {
        filters.source_dataset = String(req.query.source);
      }

      if (Number.isFinite(toNumber(req.query.minScore))) {
        filters.drug_score = { $gte: toNumber(req.query.minScore) };
      }

      if (Number.isFinite(toNumber(req.query.maxScore))) {
        filters.drug_score = filters.drug_score || {};
        filters.drug_score.$lte = toNumber(req.query.maxScore);
      }

      if (Number.isFinite(toNumber(req.query.minSafety))) {
        filters.safety_index = { $gte: toNumber(req.query.minSafety) };
      }

      if (Number.isFinite(toNumber(req.query.minEfficacy))) {
        filters.efficacy_index = { $gte: toNumber(req.query.minEfficacy) };
      }

      if (req.query.search) {
        const searchRegex = new RegExp(String(req.query.search), "i");
        filters.$or = [
          { candidate_id: searchRegex },
          { name: searchRegex },
          { smiles: searchRegex },
        ];
      }

      const total = await Candidate.countDocuments(filters);
      const items = await Candidate.find(filters)
        .sort({ [sortBy]: order })
        .skip(offset)
        .limit(limit)
        .lean();

      return res.json({
        source: "MongoDB",
        total,
        limit,
        offset,
        sortBy,
        order: order === 1 ? "asc" : "desc",
        items,
      });
    }

    // Fallback to JSON
    const data = getDataset();
    const filtered = filterCandidates(data, {
      source: req.query.source,
      minScore: toNumber(req.query.minScore),
      maxScore: toNumber(req.query.maxScore),
      minSafety: toNumber(req.query.minSafety),
      minEfficacy: toNumber(req.query.minEfficacy),
      search: req.query.search,
    });

    const sorted = [...filtered].sort((a, b) => {
      const av = Number(a?.[sortBy]);
      const bv = Number(b?.[sortBy]);

      if (Number.isFinite(av) && Number.isFinite(bv)) {
        return order === 1 ? av - bv : bv - av;
      }

      const as = String(a?.[sortBy] ?? "");
      const bs = String(b?.[sortBy] ?? "");
      return order === 1 ? as.localeCompare(bs) : bs.localeCompare(as);
    });

    const page = sorted.slice(offset, offset + limit);

    return res.json({
      source: "JSON (MongoDB unavailable)",
      total: sorted.length,
      limit,
      offset,
      sortBy,
      order: order === 1 ? "asc" : "desc",
      items: page,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adjacency precompute endpoint: accepts positions [[x,y],...] and returns neighbor index/weight buffer (Float32, base64)
app.post("/api/adjacency", async (req, res) => {
  try {
    const positions = req.body.positions;
    const kRequested = Number(req.body.k || 8);
    if (!Array.isArray(positions) || positions.length === 0) {
      return res.status(400).json({ error: "positions must be a non-empty array" });
    }
    const N = positions.length;
    const Kcap = Math.min(16, Math.max(1, kRequested));

    // compute pairwise distances
    const distances = new Array(N);
    for (let i = 0; i < N; i++) {
      distances[i] = new Array(N);
      for (let j = 0; j < N; j++) {
        const dx = positions[i][0] - positions[j][0];
        const dy = positions[i][1] - positions[j][1];
        distances[i][j] = Math.sqrt(dx * dx + dy * dy);
      }
    }

    const neighborData = new Float32Array(N * Kcap * 4);
    for (let i = 0; i < N; i++) {
      const idxs = Array.from({ length: N }, (_, j) => j).filter((j) => j !== i);
      idxs.sort((a, b) => distances[i][a] - distances[i][b]);
      const nearest = idxs.slice(0, Kcap);
      const sigma = Math.max(1e-6, nearest.reduce((s, ni) => s + distances[i][ni], 0) / Math.max(1, nearest.length));
      let sumw = 0;
      const ws = [];
      for (let k = 0; k < Kcap; k++) {
        const ni = nearest[k] ?? i;
        const d = distances[i][ni];
        const w = Math.exp(-0.5 * (d * d) / (sigma * sigma + 1e-6));
        ws.push(w);
        sumw += w;
      }
      if (sumw <= 0) sumw = 1.0;
      for (let k = 0; k < Kcap; k++) {
        const ni = nearest[k] ?? i;
        const w = ws[k] / sumw;
        const base = (i * Kcap + k) * 4;
        neighborData[base + 0] = ni;
        neighborData[base + 1] = w;
        neighborData[base + 2] = 0.0;
        neighborData[base + 3] = 1.0;
      }
    }

    // return as base64 to avoid JSON number bloat
    const buf = Buffer.from(neighborData.buffer);
    const b64 = buf.toString("base64");
    return res.json({ ok: true, N, K: Kcap, neighborBase64: b64 });
  } catch (error) {
    console.error("Adjacency compute error:", error);
    res.status(500).json({ error: String(error) });
  }
});

// Get single candidate by ID
app.get("/api/candidates/:id", async (req, res) => {
  try {
    const id = String(req.params.id);

    if (mongoReady && isMongoConnected()) {
      const row = await Candidate.findOne({ candidate_id: id }).lean();
      if (!row) {
        return res.status(404).json({ error: `Candidate not found: ${id}` });
      }
      return res.json(row);
    }

    // Fallback to JSON
    const data = getDataset();
    const row = data.find((r) => String(r.candidate_id) === id);

    if (!row) {
      return res.status(404).json({ error: `Candidate not found: ${id}` });
    }

    return res.json(row);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Score candidates with custom weights
app.post("/api/score", async (req, res) => {
  try {
    const body = req.body ?? {};
    const limit = Math.min(Math.max(Number(body.limit ?? 100), 1), 1000);
    const source = body.source;

    const weights = normalizeWeights(body.weights || defaultWeights);

    if (mongoReady && isMongoConnected()) {
      // Use MongoDB
      const filters = {};

      if (source && source !== "all") {
        filters.source_dataset = String(source);
      }

      if (Number.isFinite(toNumber(body.minScore))) {
        filters.drug_score = { $gte: toNumber(body.minScore) };
      }
      if (Number.isFinite(toNumber(body.maxScore))) {
        filters.drug_score = filters.drug_score || {};
        filters.drug_score.$lte = toNumber(body.maxScore);
      }
      if (Number.isFinite(toNumber(body.minSafety))) {
        filters.safety_index = { $gte: toNumber(body.minSafety) };
      }
      if (Number.isFinite(toNumber(body.minEfficacy))) {
        filters.efficacy_index = { $gte: toNumber(body.minEfficacy) };
      }

      const items = await Candidate.find(filters).lean();

      const ranked = items
        .map((c) => ({
          ...c,
          api_score: computeWeightedScore(c, weights),
        }))
        .sort((a, b) => b.api_score - a.api_score)
        .slice(0, limit)
        .map((c, idx) => ({ ...c, api_rank: idx + 1 }));

      return res.json({
        source: "MongoDB",
        total: items.length,
        returned: ranked.length,
        weights,
        items: ranked,
      });
    }

    // Fallback to JSON
    const data = getDataset();
    const filtered = filterCandidates(data, {
      source,
      minScore: toNumber(body.minScore),
      maxScore: toNumber(body.maxScore),
      minSafety: toNumber(body.minSafety),
      minEfficacy: toNumber(body.minEfficacy),
      search: body.search,
    });

    const ranked = rankCandidates(filtered, weights).slice(0, limit);

    return res.json({
      source: "JSON (MongoDB unavailable)",
      total: filtered.length,
      returned: ranked.length,
      weights,
      items: ranked,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assistant chatbot endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const message = String(req.body?.message ?? "").trim();
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    const reply = await generateAssistantReply({ message, history });
    return res.json({ reply, provider: assistantProvider });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Chat generation failed" });
  }
});

// Live molecules endpoint with hybrid loader: PubChem -> ChEMBL -> Local JSON
app.get("/api/live-molecules", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 1000);
    const alpha = Number(req.query.alpha ?? 0.1); // neighborhood boosting factor
    const neighborK = Math.max(1, Math.min(50, Number(req.query.k ?? 5)));
    const timeoutMs = Math.max(1000, Number(req.query.timeoutMs ?? 3000));

    let rows = [];
    let source = null;

    // Try PubChem first (best-effort)
    try {
      rows = await fetchFromPubchem({ limit, timeoutMs });
      source = "pubchem";
    } catch (pubErr) {
      console.warn("PubChem fetch failed, trying ChEMBL:", pubErr.message || pubErr);
      try {
        rows = await fetchFromChembl({ limit, timeoutMs });
        source = "chembl";
      } catch (chemErr) {
        console.warn("ChEMBL fetch failed, falling back to local dataset:", chemErr.message || chemErr);
        rows = await loadLocalDataset({ limit });
        source = "local";
      }
    }

    // Normalize numeric fields and compute base score using existing scoring utility when possible
    const normalized = rows.map((r) => ({
      id: String(r.id ?? r.candidate_id ?? Math.random()),
      name: r.name ?? null,
      molecular_weight: Number(r.molecular_weight ?? r.MolecularWeight ?? NaN),
      logP: Number(r.logP ?? r.xlogp ?? r.XLogP ?? NaN),
      h_donors: Number(r.h_donors ?? r.hbond_donor_count ?? NaN),
      h_acceptors: Number(r.h_acceptors ?? r.hbond_acceptor_count ?? NaN),
      smiles: r.smiles ?? null,
      source: r.source ?? source,
    }));

    // Compute a proxy efficacy/safety/complexity for each row if not present (simple heuristics)
    const withScores = normalized.map((r) => {
      const efficacy_index = Number(r.molecular_weight && Number.isFinite(r.molecular_weight) ? Math.max(0, Math.min(1, 1 - Math.abs(r.molecular_weight - 300) / 500)) : 0);
      const safety_index = Number(Number.isFinite(r.logP) ? Math.max(0, Math.min(1, 1 - Math.abs(r.logP) / 6)) : 0);
      const molecular_complexity = Number(Number.isFinite(r.h_donors + r.h_acceptors) ? Math.max(0, Math.min(1, (r.h_donors + r.h_acceptors) / 10)) : 0);

      const baseScore = computeWeightedScore({ efficacy_index, safety_index, molecular_complexity }, defaultWeights);

      return { ...r, efficacy_index, safety_index, molecular_complexity, baseScore };
    });

    // Neighborhood boosting: for each molecule, find k nearest by molecular_weight and average their baseScore
    const sortedByMW = [...withScores].sort((a, b) => (Number(a.molecular_weight) || 0) - (Number(b.molecular_weight) || 0));

    function findNeighborAvg(idx) {
      const target = sortedByMW[idx];
      if (!target) return 0;
      // compute absolute differences
      const diffs = sortedByMW.map((r, i) => ({ i, d: Math.abs((Number(r.molecular_weight) || 0) - (Number(target.molecular_weight) || 0)), score: r.baseScore }));
      diffs.sort((a, b) => a.d - b.d);
      const top = diffs.slice(1, 1 + neighborK); // exclude self at index 0
      if (!top.length) return 0;
      const sum = top.reduce((s, x) => s + Number(x.score || 0), 0);
      return sum / top.length;
    }

    const boosted = sortedByMW.map((r, idx) => {
      const neighborAvg = findNeighborAvg(idx);
      const finalScore = Number((r.baseScore + alpha * neighborAvg).toFixed(6));
      return { ...r, neighborAvg, finalScore };
    });

    // Softmax to probabilities
    const exps = boosted.map((r) => Math.exp(r.finalScore));
    const sumExp = exps.reduce((s, v) => s + v, 0) || 1;

    const withProb = boosted.map((r, i) => ({
      id: r.id,
      name: r.name,
      molecular_weight: r.molecular_weight,
      logP: r.logP,
      h_donors: r.h_donors,
      h_acceptors: r.h_acceptors,
      score: r.finalScore,
      probability: Number((exps[i] / sumExp).toFixed(6)),
      source: r.source,
      smiles: r.smiles,
    }));

    return res.json({ source, count: withProb.length, items: withProb });
  } catch (error) {
    console.error("/api/live-molecules error:", error);
    return res.status(500).json({ error: String(error) });
  }
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down...");
  await disconnectMongo();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`\n🚀 Quantiva backend running on http://localhost:${PORT}`);
  console.log(`   API docs: http://localhost:${PORT}/api/health`);
  if (mongoReady && isMongoConnected()) {
    console.log(`   Storage: MongoDB Atlas`);
  } else {
    console.log(`   Storage: JSON (MongoDB not available)`);
  }
  console.log("");
});
