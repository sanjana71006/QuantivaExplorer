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
import { User } from "./models/User.js";
import {
  defaultWeights,
  normalizeWeights,
  rankCandidates,
  computeWeightedScore,
} from "./utils/scoring.js";
import { fetchFromPubchem, fetchCompoundByName, fetchCompoundsByKeyword } from "./services/pubchemService.js";
import { fetchFromChembl } from "./services/chemblService.js";
import { loadLocalDataset } from "./services/datasetFallback.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
const PORT = Number(process.env.PORT || 8080);

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const JWT_SECRET = process.env.JWT_SECRET || "quantiva_dev_secret";

function generateToken(user) {
  return jwt.sign({ id: String(user._id), name: user.name, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Unauthorized" });
  const parts = header.split(" ");
  const token = parts.length === 2 ? parts[1] : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

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

// Check if Gemini API key is available and valid
function hasValidApiKey() {
  const key = process.env.GEMINI_API_KEY;
  return key && key.trim().length > 10 && !key.startsWith("your_") && key !== "undefined";
}

// Extract molecule name from user query
function extractMoleculeQuery(message) {
  const lower = message.toLowerCase();
  
  // Patterns for molecule queries
  const patterns = [
    /(?:what is|tell me about|info(?:rmation)? (?:on|about)|search for|find|look up|details (?:of|about|on)|show me)\s+([a-zA-Z0-9\-]+(?:\s+[a-zA-Z0-9\-]+)?)/i,
    /molecule[:\s]+([a-zA-Z0-9\-]+)/i,
    /compound[:\s]+([a-zA-Z0-9\-]+)/i,
    /drug[:\s]+([a-zA-Z0-9\-]+)/i,
    /^([a-zA-Z]{3,}(?:in|ol|ine|ide|ate|one|acid)?)$/i, // Common drug suffixes
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Filter out common words that aren't molecules
      const excludeWords = ['the', 'this', 'that', 'what', 'how', 'why', 'when', 'where', 'which', 'dataset', 'data', 'score', 'filter', 'results'];
      if (!excludeWords.includes(name.toLowerCase()) && name.length > 2) {
        return name;
      }
    }
  }

  // Check for common drug names directly mentioned
  const commonDrugs = ['aspirin', 'ibuprofen', 'acetaminophen', 'paracetamol', 'caffeine', 'penicillin', 'amoxicillin', 'metformin', 'lisinopril', 'atorvastatin', 'omeprazole', 'amlodipine', 'morphine', 'codeine', 'warfarin', 'insulin', 'sildenafil', 'diazepam', 'lorazepam', 'fluoxetine', 'sertraline', 'escitalopram', 'quetiapine', 'risperidone', 'olanzapine', 'lithium', 'valproate', 'carbamazepine', 'phenytoin', 'levetiracetam', 'gabapentin', 'pregabalin', 'tramadol', 'fentanyl', 'oxycodone', 'hydrocodone', 'naproxen', 'celecoxib', 'prednisone', 'dexamethasone', 'hydrocortisone', 'ciprofloxacin', 'azithromycin', 'doxycycline', 'trimethoprim', 'metronidazole', 'fluconazole', 'acyclovir', 'oseltamivir', 'remdesivir', 'hydroxychloroquine', 'ivermectin'];
  
  for (const drug of commonDrugs) {
    if (lower.includes(drug)) {
      return drug;
    }
  }

  return null;
}

// Format PubChem molecule data for display
function formatMoleculeInfo(compound) {
  const lines = [];
  lines.push(`📊 **${compound.name || 'Unknown Compound'}**`);
  if (compound.id) lines.push(`• PubChem CID: ${compound.id}`);
  if (compound.molecular_weight) lines.push(`• Molecular Weight: ${compound.molecular_weight} g/mol`);
  if (compound.logP !== null && compound.logP !== undefined && !isNaN(compound.logP)) lines.push(`• LogP: ${compound.logP}`);
  if (compound.h_donors !== null && compound.h_donors !== undefined) lines.push(`• H-Bond Donors: ${compound.h_donors}`);
  if (compound.h_acceptors !== null && compound.h_acceptors !== undefined) lines.push(`• H-Bond Acceptors: ${compound.h_acceptors}`);
  if (compound.tpsa !== null && compound.tpsa !== undefined) lines.push(`• TPSA: ${compound.tpsa} Å²`);
  if (compound.smiles) lines.push(`• SMILES: ${compound.smiles}`);
  
  // Lipinski's Rule of Five analysis
  const violations = [];
  if (compound.molecular_weight > 500) violations.push('MW > 500');
  if (compound.logP > 5) violations.push('LogP > 5');
  if (compound.h_donors > 5) violations.push('H-donors > 5');
  if (compound.h_acceptors > 10) violations.push('H-acceptors > 10');
  
  if (violations.length === 0) {
    lines.push(`\n✅ Lipinski's Rule of Five: All criteria met (good oral bioavailability)`);
  } else {
    lines.push(`\n⚠️ Lipinski's Rule of Five: ${violations.length} violation(s) - ${violations.join(', ')}`);
  }
  
  return lines.join('\n');
}

// Generate local response without API for general project questions
async function generateLocalResponse(message, snapshot) {
  const lower = message.toLowerCase();

  // Check for molecule-specific queries first
  const moleculeQuery = extractMoleculeQuery(message);
  if (moleculeQuery) {
    try {
      console.log(`Fetching PubChem data for: ${moleculeQuery}`);
      const result = await fetchCompoundByName(moleculeQuery);
      if (result.items && result.items.length > 0) {
        const compound = result.items[0];
        return `${formatMoleculeInfo(compound)}\n\n📎 Source: ${result.source === 'pubchem' ? 'PubChem Database' : 'Local Dataset'}`;
      } else {
        return `I couldn't find information about "${moleculeQuery}" in PubChem or the local dataset. Please check the spelling or try a different molecule name.`;
      }
    } catch (err) {
      console.error('PubChem fetch error:', err);
      return `I encountered an error fetching data for "${moleculeQuery}". Please try again later.`;
    }
  }

  // Disease target queries - search for compounds related to a disease/condition
  const diseaseMatch = lower.match(/(?:drugs?|molecules?|compounds?|treatment|therapy|medicine)\s+(?:for|targeting|against|to treat)\s+([a-zA-Z\s]+)|(?:find|search|show|get|list)\s+(?:drugs?|molecules?|compounds?)\s+for\s+([a-zA-Z\s]+)|([a-zA-Z]+)\s+(?:drugs?|treatment|therapy|medication)/i);
  const diseaseKeywords = ['cancer', 'diabetes', 'alzheimer', 'parkinson', 'hypertension', 'depression', 'anxiety', 'infection', 'inflammation', 'arthritis', 'asthma', 'epilepsy', 'migraine', 'obesity', 'hiv', 'aids', 'malaria', 'tuberculosis', 'hepatitis', 'leukemia', 'lymphoma', 'melanoma', 'cardiovascular', 'heart', 'stroke', 'covid', 'flu', 'influenza', 'bacterial', 'viral', 'fungal', 'antibiotic', 'antiviral', 'antifungal', 'pain', 'fever', 'cough', 'allergy'];
  
  let diseaseQuery = null;
  if (diseaseMatch) {
    diseaseQuery = (diseaseMatch[1] || diseaseMatch[2] || diseaseMatch[3] || '').trim();
  } else {
    // Check if any disease keyword is mentioned
    for (const keyword of diseaseKeywords) {
      if (lower.includes(keyword)) {
        diseaseQuery = keyword;
        break;
      }
    }
  }

  if (diseaseQuery && diseaseQuery.length > 2) {
    try {
      console.log(`Searching compounds for disease: ${diseaseQuery}`);
      const result = await fetchCompoundsByKeyword(diseaseQuery);
      if (result.items && result.items.length > 0) {
        const compounds = result.items.slice(0, 5);
        const list = compounds.map((c, i) => {
          const mw = c.molecular_weight ? `${c.molecular_weight} g/mol` : 'N/A';
          const logP = (c.logP !== null && c.logP !== undefined && !isNaN(c.logP)) ? c.logP : 'N/A';
          return `${i + 1}. **${c.name || c.id || 'Unknown'}**\n   • MW: ${mw}, LogP: ${logP}`;
        }).join('\n');

        return `🔬 **Compounds related to "${diseaseQuery}"**

Found ${result.items.length} compound(s). Top results:

${list}

📎 Source: ${result.source === 'pubchem' ? 'PubChem Database' : 'Local Dataset'}

💡 Ask about a specific compound for detailed information (e.g., "Tell me about ${compounds[0]?.name || 'aspirin'}").`;
      } else {
        return `I couldn't find compounds specifically related to "${diseaseQuery}" in PubChem. Try:
• More general terms (e.g., "antibiotic" instead of specific bacteria)
• Common drug names for that condition
• Or ask about disease profiles available in Quantiva.`;
      }
    } catch (err) {
      console.error('Disease search error:', err);
      return `I encountered an error searching for "${diseaseQuery}" compounds. Please try again.`;
    }
  }

  // Disease profiles explanation
  if (/disease.*profile|disease.*mode|disease.*aware|therapeutic.*area|indication|target.*disease/i.test(lower)) {
    return `🎯 **Disease-Aware Scoring Profiles**

Quantiva adapts scoring weights based on therapeutic targets:

**🔴 Cancer**
• Increased binding affinity weight for target inhibition
• Prioritizes efficacy over oral bioavailability

**🟡 Infectious Disease**
• Emphasized safety and toxicity evaluation
• Broad-spectrum activity considerations

**🟣 CNS / Neurological**
• Optimized LogP for blood-brain barrier penetration
• Molecular weight considerations for CNS access

**🟢 Metabolic**
• Focus on solubility and oral bioavailability
• Long-term safety for chronic use

**🔵 Cardiovascular**
• Balanced safety and efficacy profile
• Cardiac safety emphasis

**⚪ General**
• Standard Lipinski-based drug-likeness optimization

Enable Disease-Aware Mode in the dashboard to apply these profiles!`;
  }

  // Dataset stats queries
  if (/dataset|stats|statistics|overview|summary|how many|total/i.test(lower)) {
    const bySourceDetail = /by.*source|source.*breakdown|per.*source/i.test(lower);
    const allSources = Object.entries(snapshot.bySource).sort((a, b) => b[1] - a[1]);
    
    const sourceList = allSources
      .slice(0, bySourceDetail ? 10 : 5)
      .map(([name, count]) => {
        const pct = ((count / snapshot.total) * 100).toFixed(1);
        return bySourceDetail 
          ? `• **${name}**: ${count} compounds (${pct}%)`
          : `• ${name}: ${count} compounds`;
      })
      .join('\n');
    
    const avgBySource = bySourceDetail ? allSources.slice(0, 5).map(([name]) => {
      const sourceRows = snapshot.rows.filter(r => r.source_dataset === name);
      const avgEff = average(sourceRows, "efficacy_index");
      const avgSaf = average(sourceRows, "safety_index");
      return `• ${name}: Eff=${avgEff.toFixed(2)}, Saf=${avgSaf.toFixed(2)}`;
    }).join('\n') : '';
    
    return `📊 **Dataset Overview**

**Summary:**
• Total Candidates: ${snapshot.total}
• Mean Efficacy Index: ${average(snapshot.rows, "efficacy_index").toFixed(3)}
• Mean Safety Index: ${average(snapshot.rows, "safety_index").toFixed(3)}
• Number of Sources: ${allSources.length}

**${bySourceDetail ? 'Full Source Breakdown' : 'Top Sources'}:**
${sourceList}${bySourceDetail && avgBySource ? `

**Average Scores by Source:**
${avgBySource}` : ''}

Use the filters to explore candidates by efficacy, safety, or specific sources.`;
  }

  // Top molecules queries
  if (/top\s*\d*|best|ranked|highest|leading/i.test(lower)) {
    const n = extractTopN(message);
    const priority = detectPriority(message);
    const weights = getPriorityWeights(priority);
    const wantsReasons = /reason|why|explain|detail/i.test(lower);
    
    const scored = snapshot.rows.map(row => ({
      ...row,
      score: computeWeightedScore({
        efficacy_index: row.efficacy_index || 0,
        safety_index: row.safety_index || 0,
        molecular_complexity: row.molecular_complexity || 0.5,
      }, weights)
    })).sort((a, b) => b.score - a.score).slice(0, n);

    const list = scored.map((m, i) => {
      const eff = (m.efficacy_index || 0);
      const saf = (m.safety_index || 0);
      const comp = (m.molecular_complexity || 0.5);
      
      let reasons = [];
      if (eff >= 0.7) reasons.push("high efficacy potential");
      else if (eff >= 0.5) reasons.push("moderate efficacy");
      if (saf >= 0.7) reasons.push("excellent safety profile");
      else if (saf >= 0.5) reasons.push("acceptable safety");
      if (comp >= 0.3 && comp <= 0.7) reasons.push("balanced complexity");
      if (eff >= 0.6 && saf >= 0.6) reasons.push("good drug-likeness");
      
      const reasonText = wantsReasons && reasons.length > 0 
        ? `\n   📝 *${reasons.join(", ")}*` 
        : "";
      
      return `${i + 1}. **${m.name || m.candidate_id}**
   Score: ${m.score.toFixed(3)} | Efficacy: ${eff.toFixed(2)} | Safety: ${saf.toFixed(2)}${reasonText}`;
    }).join('\n\n');

    return `🏆 **Top ${n} Molecules** ${priority ? `(${priority}-focused)` : '(balanced)'}

**Scoring Weights:** ${formatWeights(weights)}

${list}

💡 Tip: Ask for "top efficacy" or "top safety" to prioritize specific criteria.`;
  }

  // Lipinski rules
  if (/lipinski|rule.*five|drug.*like|bioavailability/i.test(lower)) {
    return `📋 **Lipinski's Rule of Five**

A molecule is likely to have good oral bioavailability if it meets these criteria:

1. **Molecular Weight** ≤ 500 Da
2. **LogP** (lipophilicity) ≤ 5
3. **Hydrogen Bond Donors** ≤ 5 (OH and NH groups)
4. **Hydrogen Bond Acceptors** ≤ 10 (N and O atoms)

⚠️ **Violations**: Compounds with >1 violation may have poor absorption or permeability.

In our scoring system, Lipinski compliance is factored into the drug-likeness assessment and influences the overall candidate ranking.`;
  }

  // Efficacy vs Safety
  if (/efficacy|safety|trade.*off|balance|weight|tuning/i.test(lower)) {
    return `⚖️ **Efficacy vs Safety Trade-offs**

Our scoring system uses weighted priorities:

**Default Balance:**
• Efficacy: 40%
• Safety: 40%  
• Complexity: 20%

**Efficacy Priority:** Use when therapeutic effect is critical
• Efficacy: 65%, Safety: 25%, Complexity: 10%

**Safety Priority:** Use for vulnerable populations or chronic treatments
• Efficacy: 25%, Safety: 65%, Complexity: 10%

💡 **Recommendation:** Start with balanced weights, then adjust based on your target indication and patient population.`;
  }

  // Filters help
  if (/filter|search|find|narrow|criteria/i.test(lower)) {
    return `🔍 **Using Filters Effectively**

Available filters in the dashboard:

• **Score Range**: Set min/max drug scores (0-1)
• **Efficacy Threshold**: Minimum efficacy index
• **Safety Threshold**: Minimum safety index
• **Source Dataset**: Filter by data source (PubChem, ChEMBL, etc.)
• **Search**: Text search by name, ID, or SMILES

**Tips:**
1. Start broad, then narrow progressively
2. Use source filters to compare datasets
3. Combine efficacy + safety thresholds for drug-like candidates
4. Export filtered results for detailed analysis`;
  }

  // Project/Quantiva explanation
  if (/quantiva|project|what is this|how.*work|explain.*system|about/i.test(lower)) {
    return `🧬 **Welcome to Quantiva**

Quantiva is a quantum-inspired drug discovery exploration platform that helps researchers:

1. **Explore Molecules**: Browse candidates from PubChem, ChEMBL, and custom datasets
2. **Score & Rank**: Evaluate candidates using efficacy, safety, and complexity metrics
3. **Visualize**: 3D molecular visualizations and property distributions
4. **Filter & Export**: Advanced filtering with scientific report generation
5. **Disease-Aware Mode**: Adaptive scoring for specific therapeutic areas

**Key Features:**
• Lipinski Rule of Five analysis
• Customizable scoring weights
• Real-time PubChem integration
• Multi-source dataset support
• Disease target profiling

Ask me about specific molecules, disease targets, dataset stats, or scoring methodology!`;
  }

  // ADMET properties
  if (/admet|adme|absorption|distribution|metabolism|excretion|toxicity|pharmacokinetic/i.test(lower)) {
    return `💊 **ADMET Properties**

ADMET stands for **A**bsorption, **D**istribution, **M**etabolism, **E**xcretion, and **T**oxicity - key pharmacokinetic properties:

**Absorption**
• How well the drug enters the bloodstream
• Influenced by: solubility, permeability, LogP, molecular weight

**Distribution**
• How the drug spreads through tissues
• Key factors: protein binding, volume of distribution, BBB penetration

**Metabolism**
• How the body processes/breaks down the drug
• Liver enzymes (CYP450) are primary metabolizers

**Excretion**
• How the drug is eliminated (kidneys, bile, lungs)
• Half-life determines dosing frequency

**Toxicity**
• Potential harmful effects
• Includes: hepatotoxicity, cardiotoxicity, mutagenicity

In Quantiva, our safety index incorporates toxicity predictions, and drug-likeness scores reflect ADME properties.`;
  }

  // SMILES notation
  if (/smiles|notation|chemical.*structure|molecular.*string|structure.*format/i.test(lower)) {
    return `🔤 **SMILES Notation**

SMILES (Simplified Molecular Input Line Entry System) is a text representation of chemical structures:

**Basic Rules:**
• Atoms: C, N, O, S, etc. (carbon often implicit)
• Single bonds: adjacent atoms (CC = ethane)
• Double bonds: = (C=O = carbonyl)
• Triple bonds: # (C#N = nitrile)
• Branches: parentheses (CC(C)C = isobutane)
• Rings: numbers (c1ccccc1 = benzene)
• Aromatics: lowercase (c, n, o)

**Examples:**
• Water: O
• Ethanol: CCO
• Aspirin: CC(=O)Oc1ccccc1C(=O)O
• Caffeine: Cn1cnc2c1c(=O)n(c(=O)n2C)C

SMILES allows quick database searches and computational analysis of molecules.`;
  }

  // LogP explanation
  if (/logp|log\s*p|partition.*coefficient|lipophilicity|hydrophobic/i.test(lower)) {
    return `📊 **LogP (Partition Coefficient)**

LogP measures a molecule's lipophilicity - its preference for fat vs. water:

**Definition:**
LogP = log₁₀(concentration in octanol / concentration in water)

**Interpretation:**
• LogP < 0: Hydrophilic (water-loving)
• LogP 0-3: Balanced (ideal for oral drugs)
• LogP 3-5: Moderately lipophilic
• LogP > 5: Highly lipophilic (Lipinski violation)

**Why It Matters:**
• **Absorption**: Moderate LogP aids membrane permeation
• **Distribution**: High LogP may cause tissue accumulation
• **BBB Penetration**: LogP ~2-4 favors CNS access
• **Solubility**: High LogP reduces aqueous solubility

**Optimal Range:** LogP 1-3 for most oral drugs

In Quantiva, LogP is factored into drug-likeness and safety assessments.`;
  }

  // TPSA explanation
  if (/tpsa|polar.*surface|surface.*area/i.test(lower)) {
    return `📐 **TPSA (Topological Polar Surface Area)**

TPSA measures the surface area of polar atoms (N, O, and attached H):

**Significance:**
• Predicts membrane permeability
• Correlates with oral absorption
• Indicates CNS penetration potential

**Guidelines:**
• TPSA < 60 Å²: Good BBB penetration (CNS drugs)
• TPSA < 140 Å²: Good intestinal absorption
• TPSA > 140 Å²: Poor oral bioavailability likely

**Examples:**
• Caffeine: ~58 Å² (good CNS penetration)
• Aspirin: ~63 Å² (good absorption)
• Penicillin: ~138 Å² (moderate absorption)

Lower TPSA generally means better membrane permeability but may reduce aqueous solubility.`;
  }

  // Blood-Brain Barrier
  if (/bbb|blood.*brain|brain.*barrier|cns.*penetration|neuro/i.test(lower)) {
    return `🧠 **Blood-Brain Barrier (BBB) Penetration**

The BBB protects the brain by restricting molecule passage. Key factors for CNS drug design:

**Favorable Properties:**
• Molecular Weight < 450 Da
• LogP: 1-4 (optimal ~2-3)
• TPSA < 60-90 Å²
• H-bond donors ≤ 3
• H-bond acceptors ≤ 7
• Low P-glycoprotein substrate activity

**CNS MPO Score:**
Quantiva's CNS profile uses a multi-parameter optimization:
• Targets molecules likely to cross BBB
• Penalizes high MW, high TPSA, extreme LogP

**Tips:**
• Use CNS/Neurological disease profile for BBB-focused scoring
• Filter for LogP 1-4 and MW < 450
• Check H-bond counts (fewer is better for BBB)`;
  }

  // Molecular weight importance
  if (/molecular.*weight|mw|dalton|mass/i.test(lower) && !/top|best|ranked/i.test(lower)) {
    return `⚖️ **Molecular Weight (MW)**

Molecular weight significantly impacts drug properties:

**Lipinski Guideline:** MW ≤ 500 Da

**Why MW Matters:**
• **Absorption**: Smaller molecules absorb better (< 500 Da)
• **BBB Penetration**: < 450 Da preferred for CNS drugs
• **Metabolism**: Larger molecules may have complex metabolism
• **Solubility**: Generally decreases with increasing MW

**Size Categories:**
• Small molecules: < 500 Da (traditional drugs)
• "Beyond Rule of 5": 500-1000 Da (some successful drugs)
• Peptides: 1,000-10,000 Da
• Biologics: > 10,000 Da (antibodies, proteins)

**In Quantiva:**
MW is used in Lipinski analysis and affects the overall drug-likeness score.`;
  }

  // Hydrogen bonds
  if (/hydrogen.*bond|h.*bond|hbd|hba|donor|acceptor/i.test(lower)) {
    return `🔗 **Hydrogen Bond Donors & Acceptors**

Hydrogen bonds affect solubility, permeability, and target binding:

**H-Bond Donors (HBD):**
• Groups that donate H: -OH, -NH, -NH₂
• Lipinski limit: ≤ 5 donors

**H-Bond Acceptors (HBA):**
• Groups that accept H: =O, -O-, -N<, -N=
• Lipinski limit: ≤ 10 acceptors

**Impact on Drug Properties:**
• **Solubility**: More H-bonds → better water solubility
• **Permeability**: Fewer H-bonds → better membrane crossing
• **BBB**: ≤ 3 donors, ≤ 7 acceptors for CNS drugs
• **Binding**: H-bonds contribute to target affinity

**Design Strategy:**
Balance H-bonding for both target binding AND permeability. Intramolecular H-bonds can mask polarity.`;
  }

  // Data sources
  if (/pubchem|chembl|data.*source|where.*data|database/i.test(lower)) {
    return `🗄️ **Data Sources**

Quantiva integrates multiple compound databases:

**PubChem**
• NIH's free chemistry database
• 115M+ compounds
• Properties, bioactivity, safety data
• Real-time API integration

**ChEMBL**
• EBI's drug discovery database
• 2.4M+ bioactive compounds
• Curated drug-target data
• ADMET annotations

**Local Dataset**
• Pre-processed candidates
• Custom scoring metrics
• Offline availability

**Data Quality:**
• All sources provide standardized properties
• Quantiva normalizes data for consistent scoring
• PubChem is primary for molecule lookups
• ChEMBL provides bioactivity context`;
  }

  // Scoring methodology
  if (/scoring|score.*method|how.*score|calculate|algorithm|formula/i.test(lower)) {
    return `📈 **Scoring Methodology**

Quantiva uses a weighted multi-factor scoring system:

**Core Metrics:**
1. **Efficacy Index** (0-1)
   Based on: binding potential, target activity predictions, structural features

2. **Safety Index** (0-1)
   Based on: toxicity predictions, Lipinski compliance, ADMET flags

3. **Molecular Complexity** (0-1)
   Based on: structural features, synthetic accessibility, novelty

**Weighted Score Formula:**
\`Score = (w₁ × Efficacy) + (w₂ × Safety) + (w₃ × Complexity)\`

**Default Weights:**
• Efficacy: 40%
• Safety: 40%
• Complexity: 20%

**Probability Ranking:**
Final scores are converted to probabilities using softmax for relative comparisons.`;
  }

  // Export and reports
  if (/export|report|download|save|pdf|csv/i.test(lower)) {
    return `📤 **Export & Reports**

Quantiva offers multiple export options:

**Scientific Report (PDF)**
• Executive summary
• Top candidate profiles
• Property distributions
• Lipinski analysis
• Methodology notes

**Data Export (CSV/JSON)**
• Full candidate list with scores
• All molecular properties
• Filterable in spreadsheet apps

**How to Export:**
1. Apply desired filters
2. Click "Export" in dashboard
3. Choose format (PDF report or data file)
4. Download automatically generated

**Report Includes:**
• Scoring parameters used
• Filter criteria applied
• Statistical summaries
• Individual candidate cards`;
  }

  // Visualization features
  if (/visualization|3d|visualize|graph|chart|plot|display/i.test(lower)) {
    return `📊 **Visualization Features**

Quantiva provides multiple visualization tools:

**3D Chemical Universe**
• Interactive molecule space visualization
• Clusters by properties (MW, LogP, etc.)
• Color-coded by score or source

**Property Distributions**
• Histograms of MW, LogP, TPSA
• Score distributions
• Efficacy vs Safety scatter plots

**Candidate Cards**
• 2D structure images
• Property summaries
• Lipinski violation highlights
• Comparative views

**Dashboard Metrics**
• Real-time statistics
• Source breakdown charts
• Filter result counts

Navigate to the Visualization page to explore these features!`;
  }

  // Quantum-inspired explanation
  if (/quantum|exploration|algorithm|monte.*carlo|probabilistic/i.test(lower)) {
    return `⚛️ **Quantum-Inspired Exploration**

Quantiva uses quantum-inspired algorithms for molecule exploration:

**Probabilistic Ranking**
• Candidates scored using softmax distribution
• Higher-scored molecules have higher selection probability
• Allows exploration beyond top-N deterministic lists

**Neighborhood Boosting**
• Similar molecules can boost each other's scores
• Finds clusters of promising candidates
• Discovers structural analogs

**Adaptive Weighting**
• Disease profiles adjust scoring weights
• Explores different regions of chemical space
• Balances exploitation vs exploration

**Benefits:**
• Avoids local optima in candidate selection
• Discovers non-obvious candidates
• Mimics aspects of quantum superposition in search

This approach helps researchers discover diverse, high-quality candidates.`;
  }

  // Compare molecules
  if (/compare|versus|vs|difference|between.*molecules|similar/i.test(lower)) {
    return `🔄 **Comparing Molecules**

To compare molecules in Quantiva:

**Quick Comparison:**
Ask me about specific compounds:
• "What is aspirin?"
• "Tell me about ibuprofen"

**Property Comparison:**
Key properties to compare:
• Molecular Weight
• LogP (lipophilicity)
• H-bond donors/acceptors
• TPSA
• Lipinski violations
• Efficacy/Safety scores

**Dashboard Comparison:**
1. Use filters to narrow candidates
2. View side-by-side in results table
3. Sort by any property
4. Export selection for detailed analysis

**Tips:**
• Similar MW and LogP suggest similar ADME
• Compare Lipinski profiles for oral drug potential
• Check efficacy vs safety trade-offs`;
  }

  // Help/capabilities
  if (/help|what can you|capabilities|features|commands/i.test(lower)) {
    return `🔧 **Quantiva Assistant Capabilities**

I can help you with:

**🔬 Molecule Lookups**
• "What is aspirin?" - Get compound details from PubChem
• "Tell me about caffeine" - Properties, Lipinski analysis

**🎯 Disease Targets**
• "Find drugs for cancer" - Search compounds by condition
• "Diabetes treatments" - Disease-related molecules

**📊 Dataset & Stats**
• "Show dataset overview" - Total compounds, sources
• "Top 5 molecules" - Best-ranked candidates

**📚 Learn Concepts**
• "Explain Lipinski rules" - Drug-likeness criteria
• "What is LogP?" - Property explanations
• "ADMET properties" - Pharmacokinetics
• "What is TPSA?" - Polar surface area

**⚙️ Platform Help**
• "How does scoring work?" - Methodology
• "Explain filters" - Using the dashboard
• "Disease profiles" - Therapeutic targeting

Just ask naturally - I understand many phrasings!`;
  }

  // Simulation and exploration
  if (/simulation|explore|exploration|run.*simulation|start.*simulation|quantum.*run/i.test(lower)) {
    return `🔬 **Quantum-Inspired Exploration**

The simulation explores molecular candidate space probabilistically:

**How to Run:**
1. Go to **Simulation Controls** page
2. Set your **scoring weights** (efficacy, safety, complexity)
3. Choose **iteration count** and **batch size**
4. Click **Start Exploration**

**What Happens:**
• Candidates are scored using weighted metrics
• Probabilistic selection (softmax) picks molecules
• Neighborhood boosting discovers similar compounds
• Top candidates surface through iterations

**Parameters:**
• **Alpha**: Neighborhood influence (0.1-0.5)
• **Temperature**: Exploration randomness
• **Iterations**: How many rounds to run

Results appear in real-time with probability distributions!`;
  }

  // Dashboard navigation
  if (/dashboard|navigate|where.*find|how.*use|interface|ui|page|menu/i.test(lower)) {
    return `🖥️ **Dashboard Navigation**

**Main Pages:**

📍 **Landing Page** - Project overview and quick start
📍 **Dashboard** - Main exploration interface
📍 **Simulation Controls** - Run quantum exploration
📍 **Visualization** - 3D molecular space view
📍 **Results** - Ranked candidates and details
📍 **Dataset Selection** - Choose data sources
📍 **Settings** - Configure preferences

**Key Features:**
• **Search Bar** - Find molecules by name/SMILES
• **Filters Panel** - Narrow by scores/properties
• **Sort Controls** - Order by any column
• **Export Button** - Download reports

**Quick Actions:**
• Click molecule cards for details
• Use disease-aware mode for targeting
• Adjust weights with sliders`;
  }

  // Workflow steps
  if (/workflow|step|process|how.*start|getting.*started|begin|tutorial/i.test(lower)) {
    return `📋 **Quantiva Workflow**

**Step 1: Load Dataset**
• Choose from PubChem, ChEMBL, or local data
• Or upload custom molecular datasets

**Step 2: Configure Scoring**
• Set efficacy/safety/complexity weights
• Enable disease-aware profiles if needed

**Step 3: Apply Filters**
• Narrow by score ranges
• Filter by data source
• Search specific molecules

**Step 4: Run Exploration**
• Execute quantum-inspired search
• View real-time probability evolution
• Discover top candidates

**Step 5: Analyze Results**
• Review ranked molecules
• Check Lipinski compliance
• Compare properties

**Step 6: Export**
• Generate scientific reports
• Download CSV/JSON data`;
  }

  // Candidate/molecule cards
  if (/candidate.*card|molecule.*card|card.*view|detail.*view|molecule.*detail/i.test(lower)) {
    return `🎴 **Molecule Cards**

Each candidate card displays:

**Header:**
• Molecule name or ID
• Source dataset badge
• Overall drug score

**Properties:**
• Molecular Weight (g/mol)
• LogP (lipophilicity)
• H-Bond Donors/Acceptors
• TPSA (polar surface area)
• SMILES structure

**Scores:**
• Efficacy Index (0-1)
• Safety Index (0-1)
• Complexity Score (0-1)
• Weighted Total Score

**Indicators:**
• ✅ Lipinski compliant
• ⚠️ Violations highlighted
• 🏆 Rank position

Click any card for expanded details and structure visualization.`;
  }

  // Probability and softmax
  if (/probability|softmax|distribution|ranking.*method|how.*rank/i.test(lower)) {
    return `📊 **Probability-Based Ranking**

Quantiva uses **softmax probability** for ranking:

**Formula:**
\`P(molecule) = exp(score) / Σ exp(all_scores)\`

**Why Softmax?**
• Converts scores to probabilities (sum to 1)
• Higher scores = higher selection probability
• Maintains relative differences
• Allows probabilistic exploration

**Benefits:**
• Not purely deterministic (top-N)
• Discovers diverse candidates
• Balances exploitation vs exploration
• Similar to quantum probability amplitudes

**In Practice:**
• Score 0.8 has ~2.7x probability of score 0.6
• Temperature parameter adjusts spread
• Higher temp = more exploration`;
  }

  // Efficacy index
  if (/efficacy.*index|efficacy.*score|what.*efficacy|effectiveness/i.test(lower)) {
    return `💊 **Efficacy Index**

The efficacy index (0-1) predicts therapeutic effectiveness:

**Components:**
• Binding affinity predictions
• Target interaction potential
• Structural activity relationships
• Bioactivity data (when available)

**Score Interpretation:**
• 0.8-1.0: Excellent efficacy potential
• 0.6-0.8: Good efficacy
• 0.4-0.6: Moderate efficacy
• 0.2-0.4: Low efficacy
• 0.0-0.2: Poor efficacy

**In Quantiva:**
• Default weight: 40%
• Increase for potency-focused searches
• Balance with safety for drug candidates

Higher efficacy doesn't guarantee a good drug - always consider safety trade-offs.`;
  }

  // Safety index  
  if (/safety.*index|safety.*score|what.*safety|toxicity.*score/i.test(lower)) {
    return `🛡️ **Safety Index**

The safety index (0-1) predicts compound safety:

**Components:**
• Toxicity predictions
• Structural alerts (PAINS, Brenk)
• Lipinski compliance
• Known adverse effects data

**Score Interpretation:**
• 0.8-1.0: Excellent safety profile
• 0.6-0.8: Good safety
• 0.4-0.6: Moderate concerns
• 0.2-0.4: Safety issues likely
• 0.0-0.2: High toxicity risk

**In Quantiva:**
• Default weight: 40%
• Increase for safety-critical applications
• Higher weight for chronic treatments

Safe compounds with low efficacy may still fail - balance matters.`;
  }

  // Complexity score
  if (/complexity|molecular.*complexity|synthetic|accessibility/i.test(lower)) {
    return `🧩 **Molecular Complexity**

Complexity score (0-1) measures structural features:

**Factors:**
• Ring systems and fused rings
• Stereocenters
• Heteroatom diversity
• Synthetic accessibility

**Score Interpretation:**
• Low (0.0-0.3): Simple, easy to synthesize
• Medium (0.3-0.6): Balanced complexity
• High (0.6-1.0): Complex, harder synthesis

**Why It Matters:**
• Simpler molecules often better ADME
• Complex structures may have IP benefits
• Synthesis difficulty affects development cost

**Default Weight:** 20%

Balance complexity with efficacy and safety for optimal candidates.`;
  }

  // Real-time features
  if (/real.*time|live|streaming|update|refresh/i.test(lower)) {
    return `⚡ **Real-Time Features**

Quantiva provides live updates:

**Real-Time Scoring:**
• Scores computed on-the-fly
• Instant filter responses
• Live search results

**Live Data Integration:**
• PubChem API queries
• Fresh compound data
• Molecule lookups

**Streaming Visualization:**
• 3D chemical universe updates
• Probability evolution charts
• Dynamic ranking changes

**Performance:**
• Optimized for responsiveness
• Cached recent queries
• Background data loading`;
  }

  // PubChem integration
  if (/pubchem.*integration|api.*connection|external.*data|live.*molecule/i.test(lower)) {
    return `🔗 **PubChem Integration**

Quantiva connects to PubChem in real-time:

**What You Can Do:**
• Look up ANY molecule by name
• Get properties, structure, CID
• Search compounds by keyword
• Disease-related searches

**Data Retrieved:**
• Molecular Weight
• LogP (XLogP3)
• H-Bond Donors/Acceptors
• TPSA
• SMILES notation
• 2D structure image

**How to Use:**
Just ask: "What is [molecule name]?"
Examples:
• "What is aspirin?"
• "Tell me about metformin"
• "Find drugs for diabetes"

PubChem contains 115M+ compounds!`;
  }

  // Outbreak screening
  if (/outbreak|rapid|screening|emergency|urgent|pandemic|epidemic/i.test(lower)) {
    return `🚨 **Rapid Outbreak Screening**

Quantiva supports emergency drug discovery:

**Features:**
• Quick pivot to disease targets
• Rapid candidate screening
• Prioritized safety evaluation
• Fast iteration cycles

**Workflow:**
1. Enable Disease-Aware Mode
2. Enter disease/pathogen keyword
3. Search existing compounds
4. Prioritize repurposing candidates
5. Export for wet lab testing

**Optimizations:**
• Pre-filtered drug-like compounds
• Known safe compounds first
• Similar structure clustering
• Rapid ranking updates

Designed for high-urgency scenarios where speed matters.`;
  }

  // AI and explainability
  if (/ai|artificial.*intelligence|machine.*learning|explainab|interpret|why.*ranked|reason.*rank/i.test(lower)) {
    return `🧠 **AI & Explainability**

Quantiva provides transparent AI-driven insights:

**Explainable Rankings:**
• See WHY molecules are ranked
• Understand score contributions
• View property breakdowns

**AI Components:**
• Scoring algorithms
• Similarity detection
• Pattern recognition
• Natural language assistant

**Transparency:**
• No black-box decisions
• Clear weight contributions
• Reproducible results
• Documented methodology

**Assistant (Me!):**
I can explain any ranking decision - just ask "Why is [molecule] ranked high?" or "Explain the top candidates"`;
  }

  // Technology stack
  if (/technology|tech.*stack|built.*with|framework|architecture/i.test(lower)) {
    return `🛠️ **Technology Stack**

**Frontend:**
• React + TypeScript
• Vite build system
• Tailwind CSS
• Framer Motion animations
• Three.js (3D visualizations)

**Backend:**
• Node.js + Express
• MongoDB (optional)
• REST API architecture

**Integrations:**
• PubChem REST API
• ChEMBL API
• Google Gemini AI (assistant)

**Deployment:**
• Render.com compatible
• Docker support
• Static + API services`;
  }

  // Getting started / setup
  if (/get.*started|setup|install|run.*locally|development/i.test(lower)) {
    return `🚀 **Getting Started**

**Quick Start:**

**Backend:**
\`\`\`
cd backend
npm install
npm run dev
\`\`\`

**Frontend:**
\`\`\`
cd frontend
npm install
npm run dev
\`\`\`

**Environment Variables:**
• \`GEMINI_API_KEY\` - For AI assistant
• \`MONGODB_URI\` - Optional database
• \`PORT\` - Server port (default 8080)

**Access:**
• Frontend: http://localhost:5173
• Backend: http://localhost:8080
• API Health: /api/health`;
  }

  // What is Quantiva / project overview
  if (/what.*is.*quantiva|about.*quantiva|project.*about|tell.*about.*project|explain.*project/i.test(lower)) {
    return `🧬 **What is Quantiva?**

**Quantiva Explorer** is an interactive quantum-inspired molecular exploration system.

**Purpose:**
Simulate how drug candidates are discovered, filtered, and ranked within large chemical spaces.

**Key Capabilities:**
• 🔬 Probabilistic scoring of molecules
• 📊 Real-time visualization
• 🧠 Explainable AI decisions
• 🎯 Disease-aware targeting
• 📤 Scientific report generation

**Use Cases:**
• Drug discovery research
• Educational demonstrations
• Compound library screening
• Lead optimization studies

**Unique Features:**
• Quantum-inspired exploration algorithms
• PubChem live integration
• Multi-source dataset support
• Customizable scoring weights

Built for research teams to accelerate candidate selection!`;
  }

  // Thank you / appreciation
  if (/thank|thanks|appreciate|helpful|great.*job|good.*job|awesome|excellent/i.test(lower)) {
    return `You're welcome! 😊 I'm happy to help with your drug discovery research.

Feel free to ask me anything else about:
• Specific molecules or compounds
• Dataset statistics and rankings
• Drug discovery concepts (ADMET, Lipinski, etc.)
• How to use Quantiva features

Just type your question anytime!`;
  }

  // Goodbye / closing
  if (/bye|goodbye|see you|later|exit|quit|done|finished/i.test(lower)) {
    return `Goodbye! 👋 Good luck with your research!

Remember, you can always come back and ask me about:
• Molecule properties and lookups
• Dataset analysis
• Scoring methodology
• Drug discovery concepts

Happy exploring! 🧬`;
  }

  // Yes/No confirmation
  if (/^(yes|yeah|yep|sure|ok|okay|no|nope|nah)$/i.test(lower)) {
    return `I understand! Is there anything specific you'd like to know about?

**Quick suggestions:**
• "What is aspirin?" - Lookup any molecule
• "Show top 5 molecules" - See best candidates
• "Explain Lipinski rules" - Drug-likeness
• "How does scoring work?" - Methodology
• "Help" - See all my capabilities`;
  }

  // Who are you / about assistant
  if (/who.*you|your.*name|what.*are.*you|assistant/i.test(lower)) {
    return `🤖 **I'm Quantiva Assistant!**

I'm an AI-powered helper for the Quantiva drug discovery platform.

**What I Can Do:**
• Look up molecules from PubChem
• Explain drug discovery concepts
• Show dataset statistics
• Help you navigate the platform
• Answer questions about scoring

**My Knowledge:**
• ADMET, Lipinski, pharmacokinetics
• Molecular properties (LogP, MW, TPSA, etc.)
• Drug-likeness and safety
• Quantiva features and workflow

I work even without an internet connection for general questions, and connect to PubChem for live molecule data!`;
  }

  // Can you / do you / ability questions
  if (/can you|could you|do you|are you able|will you/i.test(lower)) {
    const canDoList = `Yes! Here's what I can help with:

**✅ I CAN:**
• Look up any molecule by name
• Explain drug discovery concepts
• Show dataset statistics
• Rank top molecules
• Search by disease/condition
• Explain scoring methodology
• Help navigate Quantiva

**❌ I CANNOT:**
• Provide medical advice
• Prescribe treatments
• Access external websites (except PubChem)
• Modify your dataset

What would you like me to help with?`;
    return canDoList;
  }

  // Example / demo / show me
  if (/example|demo|show.*how|demonstrate|sample/i.test(lower)) {
    return `📝 **Example Queries**

**Molecule Lookups:**
• "What is ibuprofen?"
• "Tell me about caffeine"
• "Find information on penicillin"

**Disease Searches:**
• "Find drugs for diabetes"
• "Cancer treatments"
• "Antibiotic compounds"

**Rankings:**
• "Top 5 molecules"
• "Best efficacy candidates"
• "Top safety molecules"

**Dataset:**
• "Show dataset overview"
• "Stats by source"
• "How many compounds?"

**Concepts:**
• "What is LogP?"
• "Explain ADMET"
• "Lipinski rules"

Try any of these or ask your own question!`;
  }

  // Greeting
  if (/^(hi|hello|hey|greetings)/i.test(lower)) {
    return `Hi! 👋 I'm Quantiva Assistant. I can help you with:

**🔬 Molecules & Compounds**
• "What is aspirin?" - PubChem lookup
• "Find drugs for cancer" - Disease search

**📊 Data & Rankings**
• "Show dataset overview" - Statistics
• "Top 5 molecules" - Best candidates

**📚 Learn Concepts**
• "Explain ADMET" - Pharmacokinetics
• "What is LogP?" - Property explanations
• "Lipinski rules" - Drug-likeness

**⚙️ Platform**
• "How does scoring work?" - Methodology
• "Help" - All capabilities

What would you like to explore?`;
  }

  // Default response
  return `I can help you with:

**🔬 Compounds & Chemistry**
• Molecule lookups: "What is aspirin?"
• Disease searches: "Find drugs for diabetes"
• SMILES notation, molecular properties

**📊 Data & Analysis**
• Dataset overview and statistics
• Top-ranked candidates
• Scoring methodology

**📚 Drug Discovery Concepts**
• ADMET properties
• Lipinski's Rule of Five
• LogP, TPSA, BBB penetration
• H-bond donors/acceptors

**⚙️ Platform Features**
• Filters and exports
• Visualizations
• Disease-aware profiles

Try: "What is ADMET?" or "Tell me about metformin" or "Help"`;
}

async function generateAssistantReply({ message, history = [] }) {
  const safeMessage = String(message || "").trim();
  if (!safeMessage) {
    return "Please ask me something about the molecule dataset!";
  }

  // Always get snapshot for context
  const snapshot = await getAssistantSnapshot();

  // ALWAYS try local response first - this handles all known questions without API
  // Local handler includes: molecule lookups (PubChem), disease searches, 
  // Lipinski, ADMET, LogP, scoring, filters, dataset stats, etc.
  const localReply = await generateLocalResponse(safeMessage, snapshot);
  
  // Check if local handler provided a specific answer (not the default fallback)
  const isDefaultResponse = localReply.startsWith("I can help you with:");
  
  // If we got a specific local answer, return it immediately (no API needed)
  if (!isDefaultResponse) {
    return localReply;
  }

  // Only use Gemini API for questions that don't match any local pattern
  // AND only if we have a valid API key
  if (!hasValidApiKey()) {
    console.log("No valid Gemini API key - returning local response");
    return localReply;
  }

  try {
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
        return reply || localReply; // Fallback to local if empty
      } else {
        // First message - include context
        const result = await model.generateContent(contextualMessage);
        const reply = result.response.text();
        return reply || localReply; // Fallback to local if empty
      }
    } catch (chatError) {
      // Any API error - return local response (already computed)
      console.warn("Gemini API error, using local response:", chatError.message || chatError);
      return localReply;
    }
  } catch (error) {
    // Any other error - return local response
    console.error("Error in assistant:", error);
    return localReply;
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

// Fetch live compound by name (PubChem, fallback local)
app.get("/api/molecule/:name", async (req, res) => {
  try {
    const name = String(req.params.name || "").trim();
    if (!name) return res.status(400).json({ error: "name required" });

    const result = await fetchCompoundByName(name);
    const source = result.source || (result.items && result.items.length ? 'pubchem' : 'local');
    const items = (result.items || []).slice(0, 50);

    // compute simple scores for each item using heuristics and existing scoring util
    const scored = items.map((it) => {
      const mw = Number(it.molecular_weight) || NaN;
      const logP = Number(it.logP) || NaN;
      const donors = Number(it.h_donors) || 0;
      const acceptors = Number(it.h_acceptors) || 0;
      const efficacy_index = Number.isFinite(mw) ? Math.max(0, Math.min(1, 1 - Math.abs(mw - 300) / 500)) : 0;
      const safety_index = Number.isFinite(logP) ? Math.max(0, Math.min(1, 1 - Math.abs(logP) / 6)) : 0;
      const molecular_complexity = Math.max(0, Math.min(1, (donors + acceptors) / 10));
      const weighted = computeWeightedScore({ efficacy_index, safety_index, molecular_complexity }, defaultWeights);
      return { ...it, efficacy_index, safety_index, molecular_complexity, weighted_score: weighted };
    });

    // softmax
    const exps = scored.map((s) => Math.exp(s.weighted_score));
    const sumExp = exps.reduce((a, b) => a + b, 0) || 1;
    const withProb = scored.map((s, i) => ({ ...s, probability: Number((exps[i] / sumExp).toFixed(6)) }));

    return res.json({ source, count: withProb.length, items: withProb });
  } catch (error) {
    console.error('/api/molecule error:', error);
    return res.status(500).json({ error: String(error) });
  }
});

// Search by disease/keyword -> returns compounds
app.get("/api/disease-search", async (req, res) => {
  try {
    const q = String(req.query.query || req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "query parameter is required" });

    const result = await fetchCompoundsByKeyword(q);
    const source = result.source || (result.items && result.items.length ? 'pubchem' : 'local');
    const items = (result.items || []).slice(0, 50);

    // score and softmax
    const scored = items.map((it) => {
      const mw = Number(it.molecular_weight) || NaN;
      const logP = Number(it.logP) || NaN;
      const donors = Number(it.h_donors) || 0;
      const acceptors = Number(it.h_acceptors) || 0;
      const efficacy_index = Number.isFinite(mw) ? Math.max(0, Math.min(1, 1 - Math.abs(mw - 300) / 500)) : 0;
      const safety_index = Number.isFinite(logP) ? Math.max(0, Math.min(1, 1 - Math.abs(logP) / 6)) : 0;
      const molecular_complexity = Math.max(0, Math.min(1, (donors + acceptors) / 10));
      const weighted_score = computeWeightedScore({ efficacy_index, safety_index, molecular_complexity }, defaultWeights);
      return { ...it, efficacy_index, safety_index, molecular_complexity, weighted_score };
    });

    const exps = scored.map((s) => Math.exp(s.weighted_score));
    const sumExp = exps.reduce((a, b) => a + b, 0) || 1;
    const withProb = scored.map((s, i) => ({ ...s, probability: Number((exps[i] / sumExp).toFixed(6)) }));

    return res.json({ source, count: withProb.length, items: withProb });
  } catch (error) {
    console.error('/api/disease-search error:', error);
    return res.status(500).json({ error: String(error) });
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
// Authentication endpoints

app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });
    if (!mongoReady || !isMongoConnected()) return res.status(503).json({ error: "Storage unavailable" });

    const existing = await User.findOne({ email: String(email).toLowerCase() }).lean();
    if (existing) return res.status(400).json({ error: "Email already in use" });

    const passwordHash = bcrypt.hashSync(String(password), 10);
    const user = await User.create({ name: String(name), email: String(email).toLowerCase(), passwordHash });
    const token = generateToken(user);
    return res.json({ token, user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error("/signup error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Missing fields" });
    if (!mongoReady || !isMongoConnected()) return res.status(503).json({ error: "Storage unavailable" });

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const ok = bcrypt.compareSync(String(password), user.passwordHash);
    if (!ok) return res.status(400).json({ error: "Invalid credentials" });

    const token = generateToken(user);
    return res.json({ token, user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error("/login error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

app.get("/me", authMiddleware, async (req, res) => {
  try {
    if (!mongoReady || !isMongoConnected()) return res.status(503).json({ error: "Storage unavailable" });
    const uid = req.user?.id;
    const user = await User.findById(uid).lean();
    if (!user) return res.status(404).json({ error: "Not found" });
    return res.json({ name: user.name, email: user.email, id: user._id });
  } catch (err) {
    console.error("/me error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

// Save and fetch user-scoped resources
app.post("/user/experiments", authMiddleware, async (req, res) => {
  try {
    if (!mongoReady || !isMongoConnected()) return res.status(503).json({ error: "Storage unavailable" });
    const uid = req.user.id;
    const payload = req.body || {};
    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: "Not found" });
    user.experiments.push({ data: payload, createdAt: new Date() });
    await user.save();
    return res.json({ ok: true });
  } catch (err) {
    console.error("/user/experiments POST error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

app.get("/user/experiments", authMiddleware, async (req, res) => {
  try {
    if (!mongoReady || !isMongoConnected()) return res.status(503).json({ error: "Storage unavailable" });
    const uid = req.user.id;
    const user = await User.findById(uid).lean();
    if (!user) return res.status(404).json({ error: "Not found" });
    return res.json({ experiments: user.experiments || [] });
  } catch (err) {
    console.error("/user/experiments GET error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

app.post("/user/configs", authMiddleware, async (req, res) => {
  try {
    if (!mongoReady || !isMongoConnected()) return res.status(503).json({ error: "Storage unavailable" });
    const uid = req.user.id;
    const payload = req.body || {};
    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: "Not found" });
    user.configs.push({ data: payload, createdAt: new Date() });
    await user.save();
    return res.json({ ok: true });
  } catch (err) {
    console.error("/user/configs POST error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

app.get("/user/configs", authMiddleware, async (req, res) => {
  try {
    if (!mongoReady || !isMongoConnected()) return res.status(503).json({ error: "Storage unavailable" });
    const uid = req.user.id;
    const user = await User.findById(uid).lean();
    if (!user) return res.status(404).json({ error: "Not found" });
    return res.json({ configs: user.configs || [] });
  } catch (err) {
    console.error("/user/configs GET error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

app.post("/user/history", authMiddleware, async (req, res) => {
  try {
    if (!mongoReady || !isMongoConnected()) return res.status(503).json({ error: "Storage unavailable" });
    const uid = req.user.id;
    const payload = req.body || {};
    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: "Not found" });
    user.history.push({ data: payload, createdAt: new Date() });
    await user.save();
    return res.json({ ok: true });
  } catch (err) {
    console.error("/user/history POST error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

app.get("/user/history", authMiddleware, async (req, res) => {
  try {
    if (!mongoReady || !isMongoConnected()) return res.status(503).json({ error: "Storage unavailable" });
    const uid = req.user.id;
    const user = await User.findById(uid).lean();
    if (!user) return res.status(404).json({ error: "Not found" });
    return res.json({ history: user.history || [] });
  } catch (err) {
    console.error("/user/history GET error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

app.post("/user/reports", authMiddleware, async (req, res) => {
  try {
    if (!mongoReady || !isMongoConnected()) return res.status(503).json({ error: "Storage unavailable" });
    const uid = req.user.id;
    const payload = req.body || {};
    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: "Not found" });
    user.reports.push({ data: payload, createdAt: new Date() });
    await user.save();
    return res.json({ ok: true });
  } catch (err) {
    console.error("/user/reports POST error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

app.get("/user/reports", authMiddleware, async (req, res) => {
  try {
    if (!mongoReady || !isMongoConnected()) return res.status(503).json({ error: "Storage unavailable" });
    const uid = req.user.id;
    const user = await User.findById(uid).lean();
    if (!user) return res.status(404).json({ error: "Not found" });
    return res.json({ reports: user.reports || [] });
  } catch (err) {
    console.error("/user/reports GET error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

app.post("/user/disease-experiments", authMiddleware, async (req, res) => {
  try {
    if (!mongoReady || !isMongoConnected()) return res.status(503).json({ error: "Storage unavailable" });
    const uid = req.user.id;
    const payload = req.body || {};
    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: "Not found" });
    user.diseaseExperiments.push({ data: payload, createdAt: new Date() });
    await user.save();
    return res.json({ ok: true });
  } catch (err) {
    console.error("/user/disease-experiments POST error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

app.get("/user/disease-experiments", authMiddleware, async (req, res) => {
  try {
    if (!mongoReady || !isMongoConnected()) return res.status(503).json({ error: "Storage unavailable" });
    const uid = req.user.id;
    const user = await User.findById(uid).lean();
    if (!user) return res.status(404).json({ error: "Not found" });
    return res.json({ diseaseExperiments: user.diseaseExperiments || [] });
  } catch (err) {
    console.error("/user/disease-experiments GET error:", err);
    return res.status(500).json({ error: String(err) });
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
