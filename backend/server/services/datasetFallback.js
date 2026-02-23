import fs from "fs/promises";
import path from "path";

export async function loadLocalDataset({ limit = 1000 } = {}) {
  // Look for processed_dataset.json in backend or repo root, then public
  const candidates = [
    path.resolve(process.cwd(), "backend/processed_dataset.json"),
    path.resolve(process.cwd(), "processed_dataset.json"),
    path.resolve(process.cwd(), "public/processed_dataset.json"),
  ];

  for (const p of candidates) {
    try {
      const raw = await fs.readFile(p, "utf8");
      const json = JSON.parse(raw);
      const rows = Array.isArray(json) ? json : json?.items || json?.data || json?.candidates || [];

      return rows.slice(0, limit).map((r) => ({
        id: String(r.candidate_id ?? r.id ?? r.molecule_chembl_id ?? r.CID ?? Math.random()),
        name: r.name || r.pref_name || r.IUPACName || null,
        molecular_weight: Number(r.molecular_weight ?? r.MolecularWeight ?? r.mw ?? NaN),
        logP: Number(r.logP ?? r.xlogp ?? r.XLogP ?? r.calculated_logp ?? NaN),
        h_donors: Number(r.h_donors ?? r.hbond_donor_count ?? r.HBondDonorCount ?? NaN),
        h_acceptors: Number(r.h_acceptors ?? r.hbond_acceptor_count ?? r.HBondAcceptorCount ?? NaN),
        source: String(r.source_dataset || r.source || "local"),
        smiles: r.smiles || r.canonical_smiles || null,
      }));
    } catch (err) {
      // try next path
    }
  }

  // If nothing found, return empty array
  return [];
}
