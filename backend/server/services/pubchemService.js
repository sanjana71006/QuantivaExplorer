import axios from 'axios';
import path from 'path';
import fs from 'fs';

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function setCache(key, value) {
  cache.set(key, { value, ts: Date.now() });
}

function getCache(key) {
  const v = cache.get(key);
  if (!v) return null;
  if (Date.now() - v.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return v.value;
}

async function fetchWithTimeout(url, opts = {}) {
  const instance = axios.create({ timeout: 3000 });
  const res = await instance.get(url, opts);
  return res;
}

function normalizeCompoundRecord(record, searchName = null) {
  const props = record;
  const cid = props.CID || props.cid || (props.Id && props.Id.Id) || null;
  // Prefer searchName (user query) for display, then IUPACName, then fallback
  const displayName = searchName || props.IUPACName || props.Title || props.CommonName || (props.synonyms && props.synonyms[0]) || (cid ? `CID:${cid}` : 'Unknown');
  return {
    id: cid,
    name: displayName,
    molecular_weight: props.MolecularWeight ?? null,
    logP: props.XLogP ?? props.XLogP3 ?? null,
    h_donors: props.HBondDonorCount ?? null,
    h_acceptors: props.HBondAcceptorCount ?? null,
    tpsa: props.TPSA ?? null,
    smiles: props.CanonicalSMILES ?? props.ConnectivitySMILES ?? props.SMILES ?? null,
    image_url: cid ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG` : null,
  };
}

async function loadLocalDataset() {
  try {
    const p = path.join(__dirname, '..', '..', 'processed_dataset.json');
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (parsed?.rows || []);
  } catch (e) {
    return [];
  }
}

export async function fetchCompoundByName(name) {
  const key = `compound_${name.toLowerCase()}`;
  const cached = getCache(key);
  if (cached) return { source: 'cache', items: cached };

  // Use CID-based flow since property-by-name endpoint is unreliable
  // First get CIDs by name, then fetch properties by CID
  const cidUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/cids/JSON`;
  try {
    const cidRes = await fetchWithTimeout(cidUrl, { responseType: 'json' });
    const cids = cidRes.data?.IdentifierList?.CID || [];
    if (Array.isArray(cids) && cids.length > 0) {
      const limited = cids.slice(0, 50);
      // Use working PubChem property names including IUPACName for display
      const propUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${limited.join(',')}/property/IUPACName,Title,MolecularWeight,XLogP,HBondDonorCount,HBondAcceptorCount/JSON`;
      const propRes = await fetchWithTimeout(propUrl, { responseType: 'json' });
      const props = propRes.data?.PropertyTable?.Properties || [];
      if (props.length > 0) {
        const normalized = props.map(normalizeCompoundRecord);
        setCache(key, normalized);
        return { source: 'pubchem', items: normalized };
      }
    }
  } catch (err) {
    console.warn(`PubChem fetch failed for '${name}':`, err && err.message ? err.message : String(err));
  }

  // Final fallback: local dataset
  const local = await loadLocalDataset();
  const matches = local.filter((row) => (String(row.name || '')).toLowerCase().includes(name.toLowerCase())).slice(0, 50);
  return { source: 'local', items: matches };
}

export async function fetchCompoundsByKeyword(keyword) {
  const key = `keyword_${keyword.toLowerCase()}`;
  const cached = getCache(key);
  if (cached) return { source: 'cache', items: cached };

  const cidUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(keyword)}/cids/JSON`;
  try {
    const cidRes = await fetchWithTimeout(cidUrl, { responseType: 'json' });
    const cids = cidRes.data?.IdentifierList?.CID || [];
    if (!Array.isArray(cids) || cids.length === 0) throw new Error('No CIDs');
    const limited = cids.slice(0, 50);
    const chunk = limited.join(',');
    // Use working PubChem property names including IUPACName for display
    const propUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${chunk}/property/IUPACName,Title,MolecularWeight,XLogP,HBondDonorCount,HBondAcceptorCount/JSON`;
    const propRes = await fetchWithTimeout(propUrl, { responseType: 'json' });
    const props = propRes.data?.PropertyTable?.Properties || [];
    const normalized = props.map(normalizeCompoundRecord);
    setCache(key, normalized);
    return { source: 'pubchem', items: normalized };
  } catch (e) {
    const local = await loadLocalDataset();
    const matches = local.filter((row) => {
      const txt = ((row.name || '') + ' ' + (row.disease_target || '') + ' ' + (row.description || '')).toLowerCase();
      return txt.includes(keyword.toLowerCase());
    }).slice(0, 50);
    return { source: 'local', items: matches };
  }
}

export const _cache = cache;

import fetch from "node-fetch";

// Try to fetch a small set of compounds from PubChem. This implementation uses
// the PUG REST property endpoint for a list of CIDs if available. We attempt a
// lightweight query and return an array of normalized molecules. Failures are
// handled by throwing so the caller can fallback.

const PUBCHEM_PROPERTY_URL = (cids) =>
  `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cids}/property/IUPACName,Title,MolecularWeight,XLogP,HBondDonorCount,HBondAcceptorCount/JSON`;

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
