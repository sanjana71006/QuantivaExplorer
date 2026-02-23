import React, { useState } from "react";

// Get API base URL from environment or use relative path for Vite proxy
function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.replace(/\/$/, '');
  }
  return '';
}

interface SearchBarProps {
  onResults: (items: any[], source: string) => void;
}

export default function SearchBar({ onResults }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  async function doSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = String(query || "").trim();
    if (!q) return;
    setLoading(true);
    try {
      const apiBase = getApiBaseUrl();
      const url = `${apiBase}/api/molecule/${encodeURIComponent(q)}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);
      const json = await resp.json();
      const items = Array.isArray(json.items) ? json.items : [];
      const source = json.source || "unknown";
      onResults(items, source);
    } catch (err) {
      console.warn("Search error", err);
      onResults([], "local");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={doSearch} className="flex items-center gap-3 w-full">
      <input
        placeholder="Search molecule name (e.g. aspirin)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="input input-sm flex-1"
      />
      <button type="submit" className="btn btn-sm btn-secondary" disabled={loading}>
        {loading ? "Searching..." : "Search"}
      </button>
    </form>
  );
}
