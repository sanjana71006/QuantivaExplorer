/**
 * PubChem API Service with caching
 * Handles all PubChem REST API interactions for the Exploration Lab
 */

import type { ExplorationMolecule } from '@/context/ExplorationContext';

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// Backend API base URL - use environment variable or relative path (works with Vite proxy in dev)
function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.replace(/\/$/, '');
  }
  // In development, Vite proxies /api to localhost:8080
  return '';
}

const PUBCHEM_BASE_URL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

// Working properties that don't cause 400 errors
const PROPERTY_LIST = 'MolecularWeight,XLogP,HBondDonorCount,HBondAcceptorCount';

async function fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Get CID from compound name
 */
export async function getCidByName(name: string): Promise<number | null> {
  const cacheKey = `cid:${name.toLowerCase()}`;
  const cached = getCached<number>(cacheKey);
  if (cached !== null) return cached;

  try {
    const url = `${PUBCHEM_BASE_URL}/compound/name/${encodeURIComponent(name)}/cids/JSON`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) return null;
    const data = await response.json();
    const cid = data?.IdentifierList?.CID?.[0] ?? null;
    if (cid) setCache(cacheKey, cid);
    return cid;
  } catch (e) {
    console.error('getCidByName error:', e);
    return null;
  }
}

/**
 * Fetch molecular properties by CID
 */
export async function getPropertiesByCid(cid: number): Promise<any | null> {
  const cacheKey = `props:${cid}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${PUBCHEM_BASE_URL}/compound/cid/${cid}/property/${PROPERTY_LIST}/JSON`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) return null;
    const data = await response.json();
    const props = data?.PropertyTable?.Properties?.[0] ?? null;
    if (props) setCache(cacheKey, props);
    return props;
  } catch (e) {
    console.error('getPropertiesByCid error:', e);
    return null;
  }
}

/**
 * Fetch SMILES by CID
 */
export async function getSmilesByCid(cid: number): Promise<string | null> {
  const cacheKey = `smiles:${cid}`;
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${PUBCHEM_BASE_URL}/compound/cid/${cid}/property/CanonicalSMILES/JSON`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) return null;
    const data = await response.json();
    const smiles = data?.PropertyTable?.Properties?.[0]?.CanonicalSMILES ?? null;
    if (smiles) setCache(cacheKey, smiles);
    return smiles;
  } catch (e) {
    console.error('getSmilesByCid error:', e);
    return null;
  }
}

/**
 * Fetch 3D SDF by CID
 */
export async function getSdfByCid(cid: number): Promise<string | null> {
  const cacheKey = `sdf:${cid}`;
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${PUBCHEM_BASE_URL}/compound/cid/${cid}/SDF?record_type=3d`;
    const response = await fetchWithTimeout(url, 15000);
    if (!response.ok) return null;
    const sdf = await response.text();
    if (sdf) setCache(cacheKey, sdf);
    return sdf;
  } catch (e) {
    console.error('getSdfByCid error:', e);
    return null;
  }
}

/**
 * Fetch bioactivity summary by CID
 */
export async function getBioactivityByCid(cid: number): Promise<{ activeCount: number; inactiveCount: number; targets: string[] } | null> {
  const cacheKey = `bioactivity:${cid}`;
  const cached = getCached<{ activeCount: number; inactiveCount: number; targets: string[] }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${PUBCHEM_BASE_URL}/compound/cid/${cid}/assaysummary/JSON`;
    const response = await fetchWithTimeout(url, 15000);
    if (!response.ok) return null;
    const data = await response.json();
    const table = data?.Table?.Row ?? [];
    
    let activeCount = 0;
    let inactiveCount = 0;
    const targetSet = new Set<string>();

    for (const row of table.slice(0, 100)) {
      const cells = row?.Cell ?? [];
      const outcome = cells[3] ?? '';
      const target = cells[5] ?? '';
      
      if (outcome === 'Active') activeCount++;
      else if (outcome === 'Inactive') inactiveCount++;
      
      if (target && typeof target === 'string' && target.length > 0) {
        targetSet.add(target);
      }
    }

    const result = {
      activeCount,
      inactiveCount,
      targets: Array.from(targetSet).slice(0, 10),
    };
    setCache(cacheKey, result);
    return result;
  } catch (e) {
    console.error('getBioactivityByCid error:', e);
    return null;
  }
}

/**
 * Fetch similar compounds by SMILES
 */
export async function getSimilarCompounds(smiles: string, threshold = 90, limit = 10): Promise<number[]> {
  const cacheKey = `similar:${smiles}:${threshold}`;
  const cached = getCached<number[]>(cacheKey);
  if (cached) return cached;

  try {
    // URL-encode the SMILES
    const encodedSmiles = encodeURIComponent(smiles);
    const url = `${PUBCHEM_BASE_URL}/compound/fastsimilarity_2d/smiles/${encodedSmiles}/cids/JSON?Threshold=${threshold}&MaxRecords=${limit}`;
    const response = await fetchWithTimeout(url, 20000);
    if (!response.ok) return [];
    const data = await response.json();
    const cids = data?.IdentifierList?.CID ?? [];
    const result = cids.slice(0, limit);
    setCache(cacheKey, result);
    return result;
  } catch (e) {
    console.error('getSimilarCompounds error:', e);
    return [];
  }
}

/**
 * Fetch compound name by CID
 */
export async function getNameByCid(cid: number): Promise<string | null> {
  const cacheKey = `name:${cid}`;
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${PUBCHEM_BASE_URL}/compound/cid/${cid}/synonyms/JSON`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) return null;
    const data = await response.json();
    const synonyms = data?.InformationList?.Information?.[0]?.Synonym ?? [];
    const name = synonyms[0] ?? `CID ${cid}`;
    setCache(cacheKey, name);
    return name;
  } catch (e) {
    console.error('getNameByCid error:', e);
    return `CID ${cid}`;
  }
}

/**
 * Full molecule fetch: name -> CID -> properties + SMILES
 * Uses backend API (which proxies PubChem) to avoid CORS issues in production
 * Returns a normalized ExplorationMolecule or null
 */
export async function fetchMoleculeByName(name: string): Promise<ExplorationMolecule | null> {
  const cacheKey = `mol:${name.toLowerCase()}`;
  const cached = getCached<ExplorationMolecule>(cacheKey);
  if (cached) return cached;

  // Try backend API first (works in both dev and production)
  try {
    const apiBase = getApiBaseUrl();
    const response = await fetchWithTimeout(`${apiBase}/api/molecule/${encodeURIComponent(name)}`);
    if (response.ok) {
      const data = await response.json();
      const items = data.items || [];
      if (items.length > 0) {
        const item = items[0];
        const mw = Number(item.molecular_weight) || 0;
        const logP = Number(item.logP) || 0;
        const donors = Number(item.h_donors) || 0;
        const acceptors = Number(item.h_acceptors) || 0;
        
        const pca_x = ((mw - 300) / 200) * 5;
        const pca_y = ((logP - 1) / 4) * 5;
        const pca_z = ((donors + acceptors) / 10 - 0.5) * 5;
        
        let dlScore = 1.0;
        if (mw > 500) dlScore -= 0.25;
        if (logP > 5) dlScore -= 0.25;
        if (donors > 5) dlScore -= 0.25;
        if (acceptors > 10) dlScore -= 0.25;
        dlScore = Math.max(0, dlScore);

        const mol: ExplorationMolecule = {
          id: `pubchem_${item.id}`,
          cid: Number(item.id) || undefined,
          name: item.name || name,
          smiles: item.smiles ?? undefined,
          molecular_weight: mw,
          logP,
          h_bond_donors: donors,
          h_bond_acceptors: acceptors,
          tpsa: 0,
          rotatable_bonds: 0,
          drug_likeness_score: dlScore,
          drug_likeness: dlScore,
          probability: item.probability ?? (0.5 + Math.random() * 0.3),
          confidence: 0.7 + Math.random() * 0.2,
          efficacy: item.efficacy_index ?? (0.4 + Math.random() * 0.4),
          toxicity: 0.1 + Math.random() * 0.3,
          source: data.source === 'pubchem' ? 'pubchem' : 'local',
          pca_x,
          pca_y,
          pca_z,
        };
        setCache(cacheKey, mol);
        return mol;
      }
    }
  } catch (backendErr) {
    console.warn('Backend API failed, trying direct PubChem:', backendErr);
  }

  // Fallback: direct PubChem call (may fail due to CORS in production)
  const cid = await getCidByName(name);
  if (!cid) return null;

  const [props, smiles] = await Promise.all([
    getPropertiesByCid(cid),
    getSmilesByCid(cid),
  ]);

  if (!props) return null;

  const mw = Number(props.MolecularWeight) || 0;
  const logP = Number(props.XLogP) || 0;
  const donors = Number(props.HBondDonorCount) || 0;
  const acceptors = Number(props.HBondAcceptorCount) || 0;

  const pca_x = ((mw - 300) / 200) * 5;
  const pca_y = ((logP - 1) / 4) * 5;
  const pca_z = ((donors + acceptors) / 10 - 0.5) * 5;

  let dlScore = 1.0;
  if (mw > 500) dlScore -= 0.25;
  if (logP > 5) dlScore -= 0.25;
  if (donors > 5) dlScore -= 0.25;
  if (acceptors > 10) dlScore -= 0.25;
  dlScore = Math.max(0, dlScore);

  const mol: ExplorationMolecule = {
    id: `pubchem_${cid}`,
    cid,
    name,
    smiles: smiles ?? undefined,
    molecular_weight: mw,
    logP,
    h_bond_donors: donors,
    h_bond_acceptors: acceptors,
    tpsa: 0,
    rotatable_bonds: 0,
    drug_likeness_score: dlScore,
    drug_likeness: dlScore,
    probability: 0.5 + Math.random() * 0.3,
    confidence: 0.7 + Math.random() * 0.2,
    efficacy: 0.4 + Math.random() * 0.4,
    toxicity: 0.1 + Math.random() * 0.3,
    source: 'pubchem',
    pca_x,
    pca_y,
    pca_z,
  };
  setCache(cacheKey, mol);
  return mol;
}

/**
 * Fetch molecule by CID
 */
export async function fetchMoleculeByCid(cid: number): Promise<ExplorationMolecule | null> {
  const [props, smiles, nameResult] = await Promise.all([
    getPropertiesByCid(cid),
    getSmilesByCid(cid),
    getNameByCid(cid),
  ]);

  if (!props) return null;

  const mw = Number(props.MolecularWeight) || 0;
  const logP = Number(props.XLogP) || 0;
  const donors = Number(props.HBondDonorCount) || 0;
  const acceptors = Number(props.HBondAcceptorCount) || 0;

  const pca_x = ((mw - 300) / 200) * 5;
  const pca_y = ((logP - 1) / 4) * 5;
  const pca_z = ((donors + acceptors) / 10 - 0.5) * 5;

  let dlScore = 1.0;
  if (mw > 500) dlScore -= 0.25;
  if (logP > 5) dlScore -= 0.25;
  if (donors > 5) dlScore -= 0.25;
  if (acceptors > 10) dlScore -= 0.25;
  dlScore = Math.max(0, dlScore);

  return {
    id: `pubchem_${cid}`,
    cid,
    name: nameResult ?? `CID ${cid}`,
    smiles: smiles ?? undefined,
    molecular_weight: mw,
    logP,
    h_bond_donors: donors,
    h_bond_acceptors: acceptors,
    tpsa: 0,
    rotatable_bonds: 0,
    drug_likeness_score: dlScore,
    drug_likeness: dlScore,
    probability: 0.5 + Math.random() * 0.3,
    confidence: 0.7 + Math.random() * 0.2,
    efficacy: 0.4 + Math.random() * 0.4,
    toxicity: 0.1 + Math.random() * 0.3,
    source: 'pubchem',
    pca_x,
    pca_y,
    pca_z,
  };
}

/**
 * Fetch similar molecules and return as ExplorationMolecule[]
 */
export async function fetchSimilarMolecules(smiles: string, limit = 10): Promise<ExplorationMolecule[]> {
  const cids = await getSimilarCompounds(smiles, 85, limit);
  const results: ExplorationMolecule[] = [];
  
  // Fetch in parallel batches of 5
  for (let i = 0; i < cids.length; i += 5) {
    const batch = cids.slice(i, i + 5);
    const fetched = await Promise.all(batch.map(cid => fetchMoleculeByCid(cid)));
    for (const mol of fetched) {
      if (mol) results.push(mol);
    }
  }

  return results;
}

/**
 * Get 2D structure image URL
 */
export function getMoleculeImageUrl(cid: number, size = 200): string {
  return `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?image_size=${size}x${size}`;
}

/**
 * Clear cache
 */
export function clearPubChemCache(): void {
  cache.clear();
}

export default {
  getCidByName,
  getPropertiesByCid,
  getSmilesByCid,
  getSdfByCid,
  getBioactivityByCid,
  getSimilarCompounds,
  getNameByCid,
  fetchMoleculeByName,
  fetchMoleculeByCid,
  fetchSimilarMolecules,
  getMoleculeImageUrl,
  clearPubChemCache,
};
