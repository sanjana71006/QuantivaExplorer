// Quantum-Inspired Exploration Engine
// Implements: weighted scoring, softmax ranking, probability diffusion (quantum walk)

import type { Molecule } from "./moleculeDataset";

export interface ScoringWeights {
  bindingAffinity: number;
  toxicity: number;
  solubility: number;
  lipinski: number;
  molecularWeight: number;
  logP: number;
}

export interface ScoredMolecule extends Molecule {
  weighted_score: number;
  probability: number;
  rank: number;
  score_breakdown: {
    binding: number;
    toxicity: number;
    solubility: number;
    lipinski: number;
    mw: number;
    logP: number;
  };
}

export const defaultWeights: ScoringWeights = {
  bindingAffinity: 0.25,
  toxicity: 0.20,
  solubility: 0.15,
  lipinski: 0.15,
  molecularWeight: 0.10,
  logP: 0.15,
};

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

// Rule-based drug scoring
function computeScoreBreakdown(mol: Molecule) {
  // Binding affinity approximation (prefer engineered efficacy index + structure features)
  const binding = clamp01(
    mol.efficacy_index * 0.65 +
    clamp01(1 - Math.abs(mol.polar_surface_area - 90) / 160) * 0.25 +
    clamp01(1 - mol.rotatable_bonds / 15) * 0.15
  );

  // Toxicity (inverted - lower is better)
  const toxicity = clamp01(1 - mol.toxicity_risk);

  const solubility = mol.solubility;

  const lipinski = mol.lipinski_compliant ? 1.0 : 0.3;

  // MW score (optimal around 300-450)
  const mw = clamp01(1 - Math.abs(mol.molecular_weight - 375) / 425);

  // LogP score (optimal 1-3)
  const logP = clamp01(1 - Math.abs(mol.logP - 2) / 5);

  return { binding, toxicity, solubility, lipinski, mw, logP };
}

export function scoreMolecules(
  molecules: Molecule[],
  weights: ScoringWeights = defaultWeights,
  diseaseFilter?: string
): ScoredMolecule[] {
  let filtered = molecules;
  if (diseaseFilter && diseaseFilter !== "All") {
    filtered = molecules.filter((m) => m.disease_target === diseaseFilter);
  }

  if (filtered.length === 0) {
    return [];
  }

  const scored = filtered.map((mol) => {
    const bd = computeScoreBreakdown(mol);
    const weighted_score =
      bd.binding * weights.bindingAffinity +
      bd.toxicity * weights.toxicity +
      bd.solubility * weights.solubility +
      bd.lipinski * weights.lipinski +
      bd.mw * weights.molecularWeight +
      bd.logP * weights.logP;

    return {
      ...mol,
      weighted_score: Math.round(weighted_score * 1000) / 1000,
      probability: 0, // computed below via softmax
      rank: 0,
      score_breakdown: bd,
    };
  });

  // Softmax probabilities
  const temperature = 5; // controls sharpness
  const maxScore = Math.max(...scored.map((s) => s.weighted_score));
  const expScores = scored.map((s) => Math.exp((s.weighted_score - maxScore) * temperature));
  const sumExp = expScores.reduce((a, b) => a + b, 0);

  scored.forEach((s, i) => {
    s.probability = Math.round((expScores[i] / sumExp) * 10000) / 10000;
  });

  // Sort by score descending
  scored.sort((a, b) => b.weighted_score - a.weighted_score);
  scored.forEach((s, i) => (s.rank = i + 1));

  return scored;
}

// Quantum-inspired probability diffusion on molecular similarity graph
export function quantumWalk(
  molecules: ScoredMolecule[],
  iterations: number = 10,
  diffusionRate: number = 0.3
): number[][] {
  const n = Math.min(molecules.length, 100); // limit for performance
  const subset = molecules.slice(0, n);

  // Build adjacency based on PCA distance
  const adjacency: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = subset[i].pca_x - subset[j].pca_x;
      const dy = subset[i].pca_y - subset[j].pca_y;
      const dz = subset[i].pca_z - subset[j].pca_z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const sim = Math.exp(-dist * 0.5);
      adjacency[i][j] = sim;
      adjacency[j][i] = sim;
    }
  }

  // Normalize rows
  for (let i = 0; i < n; i++) {
    const sum = adjacency[i].reduce((a, b) => a + b, 0);
    if (sum > 0) adjacency[i] = adjacency[i].map((v) => v / sum);
  }

  // Initialize probability vector
  let prob = subset.map((m) => m.probability);
  const probSum = prob.reduce((a, b) => a + b, 0);
  prob = prob.map((p) => p / (probSum || 1));

  // Store heatmap history
  const history: number[][] = [prob.slice()];

  // Iterative diffusion
  for (let iter = 0; iter < iterations; iter++) {
    const newProb = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        newProb[i] += adjacency[j][i] * prob[j];
      }
    }
    // Mix with original
    prob = prob.map((p, i) => (1 - diffusionRate) * p + diffusionRate * newProb[i]);
    // Normalize
    const s = prob.reduce((a, b) => a + b, 0);
    prob = prob.map((p) => p / (s || 1));
    history.push(prob.slice());
  }

  return history;
}

// Get top candidates
export function getTopCandidates(scored: ScoredMolecule[], topN: number = 20): ScoredMolecule[] {
  return scored.slice(0, topN);
}
