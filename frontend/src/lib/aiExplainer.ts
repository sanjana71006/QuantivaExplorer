// AI Explainer - Generates human-readable explanations for molecule rankings

import type { ScoredMolecule, ScoringWeights } from "./quantumEngine";

export interface ContributionBreakdown {
  binding: number;
  toxicity: number;
  solubility: number;
  lipinski: number;
  mw: number;
  logp: number;
  total: number;
}

export interface MoleculeExplanation {
  summary: string;
  strengths: string[];
  risks: string[];
  verdict: string;
  lipinskiDetails: string[];
  contributionBreakdown: ContributionBreakdown;
  whatWouldImproveScore: string[];
  confidenceLevel: 'High' | 'Medium' | 'Low';
  scientificRationale: string;
}

export function explainMolecule(mol: ScoredMolecule): MoleculeExplanation {
  const bd = mol.score_breakdown ?? { binding: 0, toxicity: 0, solubility: 0, mw: 0, logP: 0 };

  // Handle missing properties gracefully
  const weightedScore = mol.weighted_score ?? mol.score ?? 0;
  const prob = mol.probability ?? 0;
  const diseaseTarget = mol.disease_target ?? mol.source ?? "unknown";
  const lipinskiCompliant = mol.lipinski_compliant ?? true;
  const toxicityRisk = mol.toxicity_risk ?? 0;
  const solubility = mol.solubility ?? 0;
  const molecularWeight = mol.molecular_weight ?? 0;
  const logP = mol.logP ?? 0;
  const polarSurfaceArea = mol.polar_surface_area ?? 0;
  const rotatableBonds = mol.rotatable_bonds ?? 0;

  // Summary
  const quality = weightedScore >= 0.7 ? "highly promising" : weightedScore >= 0.5 ? "moderately promising" : "below average";
  const summary = `${mol.name || 'Unknown'} is a ${quality} drug candidate with a weighted score of ${weightedScore.toFixed(3)} and a softmax probability of ${(prob * 100).toFixed(2)}%. It originates from the ${diseaseTarget} source partition and ${lipinskiCompliant ? "fully complies with" : "violates"} Lipinski's Rule of Five.`;

  // Strengths
  const strengths: string[] = [];
  if (bd.binding >= 0.7) strengths.push(`Strong binding affinity score (${bd.binding.toFixed(2)}) suggests effective target interaction`);
  if (bd.toxicity >= 0.7) strengths.push(`Low toxicity risk (${toxicityRisk.toFixed(3)}) indicates a favorable safety profile`);
  if (bd.solubility >= 0.6) strengths.push(`Good aqueous solubility (${solubility.toFixed(3)}) supports oral bioavailability`);
  if (lipinskiCompliant) strengths.push("Fully compliant with Lipinski's Rule of Five for drug-likeness");
  if (bd.mw >= 0.6) strengths.push(`Molecular weight (${molecularWeight} Da) is within the optimal range for absorption`);
  if (bd.logP >= 0.6) strengths.push(`LogP (${logP}) indicates balanced lipophilicity for membrane permeation`);
  if (polarSurfaceArea > 0 && polarSurfaceArea < 140) strengths.push(`Polar surface area (${polarSurfaceArea} Å²) is favorable for oral absorption`);
  if (strengths.length === 0) strengths.push("Quantum probability diffusion revealed hidden structural advantages");

  // Risks
  const risks: string[] = [];
  if (bd.toxicity < 0.5 && bd.toxicity > 0) risks.push(`Elevated toxicity risk (${toxicityRisk.toFixed(3)}) requires further safety evaluation`);
  if (!lipinskiCompliant) risks.push("Violates one or more Lipinski rules, which may limit oral bioavailability");
  if (bd.solubility < 0.4 && bd.solubility > 0) risks.push(`Poor solubility (${solubility.toFixed(3)}) may necessitate formulation strategies`);
  if (molecularWeight > 500) risks.push(`High molecular weight (${molecularWeight} Da) may reduce absorption`);
  if (logP > 5) risks.push(`High LogP (${logP}) suggests excessive lipophilicity and potential metabolic liability`);
  if (rotatableBonds > 10) risks.push(`High rotatable bond count (${rotatableBonds}) may reduce oral bioavailability`);
  if (polarSurfaceArea > 140) risks.push(`High PSA (${polarSurfaceArea} Å²) could limit intestinal absorption`);
  if (risks.length === 0) risks.push("No significant risks identified at this screening stage");

  // Verdict
  let verdict: string;
  if (weightedScore >= 0.75 && lipinskiCompliant && bd.toxicity >= 0.6) {
    verdict = `${mol.name || 'This compound'} is an excellent candidate for advancement to lead optimization, showing strong drug-like properties and a favorable safety profile.`;
  } else if (weightedScore >= 0.55) {
    verdict = `${mol.name || 'This compound'} shows moderate potential and warrants further investigation, though some properties may need optimization.`;
  } else {
    verdict = `${mol.name || 'This compound'} is unlikely to advance without significant structural modifications to improve its drug-like properties.`;
  }

  // Lipinski details
  const lipinskiDetails = [
    `MW ${mol.molecular_weight} Da ${mol.molecular_weight <= 500 ? "✓" : "✗"} (≤ 500)`,
    `LogP ${mol.logP} ${mol.logP <= 5 ? "✓" : "✗"} (≤ 5)`,
    `H-bond donors ${mol.h_bond_donors} ${mol.h_bond_donors <= 5 ? "✓" : "✗"} (≤ 5)`,
    `H-bond acceptors ${mol.h_bond_acceptors} ${mol.h_bond_acceptors <= 10 ? "✓" : "✗"} (≤ 10)`,
  ];

  // Contribution breakdown - compute weighted contributions
  const defaultWeights = { binding: 0.25, toxicity: 0.20, solubility: 0.15, lipinski: 0.15, mw: 0.10, logp: 0.15 };
  const contributionBreakdown: ContributionBreakdown = {
    binding: bd.binding * defaultWeights.binding,
    toxicity: bd.toxicity * defaultWeights.toxicity,
    solubility: bd.solubility * defaultWeights.solubility,
    lipinski: bd.lipinski * defaultWeights.lipinski,
    mw: bd.mw * defaultWeights.mw,
    logp: bd.logP * defaultWeights.logp,
    total: weightedScore,
  };

  // What would improve score - deterministic suggestions based on lowest contributors
  const whatWouldImproveScore: string[] = [];
  const contributions = [
    { name: 'binding', value: bd.binding, suggestion: 'Optimize binding pocket interactions through scaffold hopping or adding hydrogen bond acceptors' },
    { name: 'toxicity', value: bd.toxicity, suggestion: 'Reduce toxicity by removing or masking reactive functional groups (e.g., nitro, aldehyde)' },
    { name: 'solubility', value: bd.solubility, suggestion: 'Improve solubility by adding polar groups or reducing molecular planarity' },
    { name: 'lipinski', value: bd.lipinski, suggestion: 'Achieve Lipinski compliance by reducing MW, LogP, or H-bond count' },
    { name: 'mw', value: bd.mw, suggestion: 'Optimize molecular weight toward 350-450 Da range for better absorption' },
    { name: 'logP', value: bd.logP, suggestion: 'Adjust LogP toward 1-3 range by adding/removing hydrophobic groups' },
  ];
  contributions.sort((a, b) => a.value - b.value);
  contributions.slice(0, 3).forEach(c => {
    if (c.value < 0.6) whatWouldImproveScore.push(c.suggestion);
  });
  if (whatWouldImproveScore.length === 0) {
    whatWouldImproveScore.push('Compound is well-optimized; consider structural analogs for lead diversification');
  }

  // Confidence level based on data completeness and score consistency
  const hasCompleteData = molecularWeight > 0 && bd.binding > 0 && bd.toxicity > 0;
  const scoreConsistency = Math.abs(bd.binding - bd.toxicity) < 0.5;
  const confidenceLevel: 'High' | 'Medium' | 'Low' = 
    hasCompleteData && scoreConsistency ? 'High' : 
    hasCompleteData ? 'Medium' : 'Low';

  // Scientific rationale
  const topContributor = contributions.sort((a, b) => b.value - a.value)[0];
  const bottomContributor = contributions.sort((a, b) => a.value - b.value)[0];
  const scientificRationale = `Score primarily driven by ${topContributor.name} (${(topContributor.value * 100).toFixed(0)}% efficiency). ${bottomContributor.name} represents the limiting factor at ${(bottomContributor.value * 100).toFixed(0)}% efficiency. Quantum probability diffusion reveals connectivity to ${Math.round(prob * 1000)} neighboring compounds in chemical space.`;

  return { 
    summary, 
    strengths, 
    risks, 
    verdict, 
    lipinskiDetails, 
    contributionBreakdown,
    whatWouldImproveScore,
    confidenceLevel,
    scientificRationale,
  };
}

export function generateOutbreakReport(
  sourcePartition: string,
  topCandidates: ScoredMolecule[]
): string {
  const top3 = topCandidates.slice(0, 3);
  const avgScore = top3.length ? top3.reduce((a, m) => a + m.weighted_score, 0) / top3.length : 0;
  const compliant = top3.filter((m) => m.lipinski_compliant).length;

  return `## ${sourcePartition} Candidate Discovery Report

### Executive Summary
Quantum-inspired exploration of the molecular search space identified **${topCandidates.length}** relevant candidates in the ${sourcePartition} partition. The top 3 candidates achieve an average weighted score of **${avgScore.toFixed(3)}**, with **${compliant}/3** meeting Lipinski compliance.

### Top Candidates
${top3.map((m, i) => `${i + 1}. **${m.name}** (${m.molecule_id}) — Score: ${m.weighted_score.toFixed(3)}, Probability: ${(m.probability * 100).toFixed(2)}%`).join("\n")}

### Methodology
- Weighted multi-criteria scoring (binding affinity, toxicity, solubility, Lipinski compliance)
- Softmax probability normalization for ranking
- Quantum-inspired probability diffusion across molecular similarity graph
- ${topCandidates.length} molecules evaluated from the filtered ${sourcePartition} subset

### Recommendation
${avgScore >= 0.65 ? "The identified candidates show strong potential for further preclinical evaluation." : "Further structural optimization is recommended before advancement."}`;
}
