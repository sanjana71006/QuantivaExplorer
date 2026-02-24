export interface Molecule {
  molecule_id: string;
  name: string;
  smiles: string;
  source_dataset: string;
  formula: string;
  molecular_weight: number;
  logP: number;
  h_bond_donors: number;
  h_bond_acceptors: number;
  rotatable_bonds: number;
  polar_surface_area: number;
  solubility: number;
  toxicity_risk: number;
  efficacy_index: number;
  safety_index: number;
  molecular_complexity: number;
  drug_score: number;
  lipinski_compliant: 0 | 1;
  disease_target: string;
  drug_likeness_score: number;
  pca_x: number;
  pca_y: number;
  pca_z: number;
}

interface RawMoleculeRecord {
  candidate_id: string;
  source_dataset: string;
  name: string;
  smiles: string;
  molecular_weight: number;
  polar_area: number;
  xlogp: number;
  h_bond_donor_count: number;
  h_bond_acceptor_count: number;
  rotatable_bond_count: number;
  toxicity: number;
  solubility: number;
  efficacy_index: number;
  safety_index: number;
  molecular_complexity: number;
  drug_score: number;
}

const DATASET_URL = "/processed_dataset.json";

let cachedDataset: Molecule[] | null = null;
let inflight: Promise<Molecule[]> | null = null;

function clamp01(v: number) {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

function normalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  if (span <= 0) return values.map(() => 0.5);
  return values.map((v) => (v - min) / span);
}

function toSourceLabel(source: string): string {
  if (source.includes("pubchem")) return "PubChem";
  if (source.includes("delaney")) return "Delaney";
  if (source.includes("quantum")) return "Quantum";
  return source;
}

function computeLipinski(mw: number, logP: number, donors: number, acceptors: number): 0 | 1 {
  return mw <= 500 && logP <= 5 && donors <= 5 && acceptors <= 10 ? 1 : 0;
}

function transformRows(rows: RawMoleculeRecord[]): Molecule[] {
  const mw = normalize(rows.map((r) => Number(r.molecular_weight) || 0));
  const logp = normalize(rows.map((r) => Number(r.xlogp) || 0));
  const efficacy = normalize(rows.map((r) => Number(r.efficacy_index) || 0));
  const safety = normalize(rows.map((r) => Number(r.safety_index) || 0));
  const complexity = normalize(rows.map((r) => Number(r.molecular_complexity) || 0));

  return rows.map((row, i) => {
    const molecularWeight = Number(row.molecular_weight) || 0;
    const xlogp = Number(row.xlogp) || 0;
    const donors = Number(row.h_bond_donor_count) || 0;
    const acceptors = Number(row.h_bond_acceptor_count) || 0;
    const lipinski = computeLipinski(molecularWeight, xlogp, donors, acceptors);
    const sourceLabel = toSourceLabel(String(row.source_dataset || "unknown"));

    return {
      molecule_id: String(row.candidate_id || `candidate_${i + 1}`),
      name: String(row.name || "unknown"),
      smiles: String(row.smiles || "unknown"),
      source_dataset: String(row.source_dataset || "unknown"),
      formula: String(row.smiles || "unknown"),
      molecular_weight: molecularWeight,
      logP: xlogp,
      h_bond_donors: donors,
      h_bond_acceptors: acceptors,
      rotatable_bonds: Number(row.rotatable_bond_count) || 0,
      polar_surface_area: Number(row.polar_area) || 0,
      solubility: clamp01(Number(row.solubility) || 0),
      toxicity_risk: clamp01(Number(row.toxicity) || 0),
      efficacy_index: clamp01(Number(row.efficacy_index) || 0),
      safety_index: clamp01(Number(row.safety_index) || 0),
      molecular_complexity: clamp01(Number(row.molecular_complexity) || 0),
      drug_score: clamp01(Number(row.drug_score) || 0),
      lipinski_compliant: lipinski,
      disease_target: sourceLabel,
      drug_likeness_score: clamp01(Number(row.drug_score) || 0),
      // Lightweight deterministic pseudo-embedding from normalized chemical descriptors.
      pca_x: Number(((mw[i] - 0.5) * 10 + (efficacy[i] - 0.5) * 6).toFixed(3)),
      pca_y: Number(((logp[i] - 0.5) * 10 + (safety[i] - 0.5) * 5).toFixed(3)),
      pca_z: Number(((complexity[i] - 0.5) * 10 + (efficacy[i] - safety[i]) * 4).toFixed(3)),
    };
  });
}

export async function getDataset(): Promise<Molecule[]> {
  if (cachedDataset) return cachedDataset;
  if (inflight) return inflight;

  inflight = fetch(DATASET_URL)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load dataset: ${response.status} ${response.statusText}`);
      }
      return response.json() as Promise<RawMoleculeRecord[]>;
    })
    .then((rows) => transformRows(rows))
    .then((rows) => {
      cachedDataset = rows;
      return rows;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export async function getDatasetSlice(size: string): Promise<Molecule[]> {
  const all = await getDataset();
  switch (size) {
    case "small":
      return all.slice(0, 50);
    case "benchmark":
      return all.slice(0, 500);
    case "full":
    case "local":
    case "pubchem":
    case "hybrid":
    default:
      return all;
  }
}

export function getDatasetStats(molecules: Molecule[]) {
  // Guard against undefined/null input
  if (!molecules || !Array.isArray(molecules)) {
    return {
      count: 0,
      features: 19,
      avgScore: 0,
      avgMW: 0,
      lipinskiCompliant: 0,
      sourceBreakdown: {},
    };
  }

  const safeAvg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  const sourceBreakdown = molecules.reduce<Record<string, number>>((acc, m) => {
    acc[m.disease_target] = (acc[m.disease_target] || 0) + 1;
    return acc;
  }, {});

  return {
    count: molecules.length,
    features: 19,
    avgScore: Math.round(safeAvg(molecules.map((m) => m.drug_likeness_score)) * 1000) / 1000,
    avgMW: Math.round(safeAvg(molecules.map((m) => m.molecular_weight)) * 100) / 100,
    lipinskiCompliant: molecules.filter((m) => m.lipinski_compliant).length,
    sourceBreakdown,
  };
}
