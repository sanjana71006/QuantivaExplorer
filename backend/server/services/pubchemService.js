import fetch from "node-fetch";

// Try to fetch a small set of compounds from PubChem. This implementation uses
// the PUG REST property endpoint for a list of CIDs if available. We attempt a
// lightweight query and return an array of normalized molecules. Failures are
// handled by throwing so the caller can fallback.

const PUBCHEM_PROPERTY_URL = (cids) =>
  `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cids}/property/MolecularWeight,XLogP,HBondDonorCount,HBondAcceptorCount,IUPACName/JSON`;

export async function fetchFromPubchem({ limit = 50, timeoutMs = 3000 } = {}) {
  // Simple strategy: fetch a small page of CIDs from PubChem's compound 'list' by querying a common name.
  // Because PubChem does not provide a straightforward "give me N random compounds" endpoint,
  // we use a lightweight approach: try a search for common drug-like name 'aspirin' to obtain nearby CIDs,
  // then fetch properties for the first N CIDs returned. This is best-effort; callers must be prepared to fallback.
  const searchUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/aspirin/cids/JSON`;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(searchUrl, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error(`PubChem search failed: ${res.status}`);
    const json = await res.json();
    const cids = (json?.IdentifierList?.CID || []).slice(0, limit);
    if (!cids.length) throw new Error("No CIDs found from PubChem search");

    const propUrl = PUBCHEM_PROPERTY_URL(cids.join(","));
    const propRes = await fetch(propUrl, { signal: controller.signal });
    if (!propRes.ok) throw new Error(`PubChem properties fetch failed: ${propRes.status}`);
    const propJson = await propRes.json();
    const props = propJson?.PropertyTable?.Properties || [];

    return props.map((p) => ({
      id: String(p?.CID ?? ""),
      name: p?.IUPACName || `CID:${p?.CID}`,
      molecular_weight: Number(p?.MolecularWeight ?? NaN),
      logP: Number(p?.XLogP ?? NaN),
      h_donors: Number(p?.HBondDonorCount ?? NaN),
      h_acceptors: Number(p?.HBondAcceptorCount ?? NaN),
      source: "pubchem",
    }));
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}
