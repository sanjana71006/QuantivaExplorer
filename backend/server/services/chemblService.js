import fetch from "node-fetch";

// Fetch molecules from ChEMBL API. Returns an array of normalized molecule objects.
export async function fetchFromChembl({ limit = 50, timeoutMs = 3000 } = {}) {
  const url = `https://www.ebi.ac.uk/chembl/api/data/molecule.json?limit=${limit}`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error(`ChEMBL fetch failed: ${res.status}`);
    const json = await res.json();
    const rows = json?.molecules || json?.molecule || [];

    return rows.map((r) => ({
      id: r.molecule_chembl_id || r.chembl_id || String(Math.random()),
      name: r.pref_name || r.molecule_structures?.canonical_smiles || r.molecule_chembl_id,
      molecular_weight: Number(r.molecular_weight ?? r.mw_free ?? r.molecule_properties?.full_molweight ?? NaN),
      // ChEMBL often exposes calculated_logp or similar fields
      logP: Number(r.calculated_logp ?? r.molecule_properties?.logp ?? NaN),
      h_donors: Number(r.h_bond_donor_count ?? r.molecule_properties?.hbd ?? NaN),
      h_acceptors: Number(r.h_bond_acceptor_count ?? r.molecule_properties?.hba ?? NaN),
      source: "chembl",
      smiles: r.molecule_structures?.canonical_smiles || null,
    }));
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}
