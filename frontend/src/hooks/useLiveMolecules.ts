import { useEffect, useState, useRef } from "react";

// Get API base URL from environment or use relative path for Vite proxy
function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.replace(/\/$/, '');
  }
  return '';
}

type LiveMolecule = {
  id: string;
  name?: string | null;
  molecular_weight?: number;
  logP?: number;
  h_donors?: number;
  h_acceptors?: number;
  score?: number;
  probability?: number;
  source?: string;
  smiles?: string | null;
};

export function useLiveMolecules(opts?: { limit?: number; alpha?: number }) {
  const { limit = 50, alpha = 0.1 } = opts || {};
  const [items, setItems] = useState<LiveMolecule[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [source, setSource] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);

  const fetchLive = async (timeoutMs = 3000) => {
    setStatus("loading");
    setError(null);
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));

    try {
      const apiBase = getApiBaseUrl();
      const url = `${apiBase}/api/live-molecules?limit=${limit}&alpha=${alpha}&timeoutMs=${timeoutMs}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      const data = Array.isArray(json.items) ? json.items : json.items?.items || [];
      setItems(data.slice(0, limit));
      setSource(json.source || null);
      setLastUpdated(Date.now());
      setStatus("ok");
    } catch (err: any) {
      clearTimeout(timer);
      setStatus("error");
      setError(err?.message || String(err));
      // fallback: try to load local processed_dataset.json from public
      try {
        const fallbackRes = await fetch(`/processed_dataset.json`);
        if (fallbackRes.ok) {
          const fallbackJson = await fallbackRes.json();
          const rows = Array.isArray(fallbackJson) ? fallbackJson : fallbackJson?.items || fallbackJson?.data || [];
          const normalized = rows.slice(0, limit).map((r: any) => ({
            id: String(r.candidate_id ?? r.id ?? r.molecule_chembl_id ?? Math.random()),
            name: r.name || r.pref_name || r.IUPACName || null,
            molecular_weight: Number(r.molecular_weight ?? r.MolecularWeight ?? r.mw ?? NaN),
            logP: Number(r.logP ?? r.xlogp ?? r.XLogP ?? r.calculated_logp ?? NaN),
            h_donors: Number(r.h_donors ?? r.hbond_donor_count ?? NaN),
            h_acceptors: Number(r.h_acceptors ?? r.hbond_acceptor_count ?? NaN),
            score: Number(r.drug_score ?? r.baseScore ?? NaN),
            probability: Number(r.probability ?? r.api_score ?? NaN),
            source: r.source_dataset || r.source || "local",
            smiles: r.smiles || null,
          }));
          setItems(normalized.slice(0, limit));
          setSource("local");
          setLastUpdated(Date.now());
          setStatus("ok");
          setError(null);
          return;
        }
      } catch (fbErr) {
        // ignore fallback error
      }
    }
  };

  useEffect(() => {
    fetchLive();
    // refresh every 60s while the component is mounted
    const interval = setInterval(() => fetchLive(), 60_000);
    return () => {
      controllerRef.current?.abort();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, alpha]);

  return { items, status, source, lastUpdated, error, refresh: fetchLive };
}
