import React, { useState } from "react";

interface SearchBarProps {
  onResults: (items: any[], source: string) => void;
}

export default function SearchBar({ onResults }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"name" | "disease">("name");
  const [loading, setLoading] = useState(false);

  async function doSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = String(query || "").trim();
    if (!q) return;
    setLoading(true);
    try {
      const url = mode === "name" ? `/api/molecule/${encodeURIComponent(q)}` : `/api/disease-search?query=${encodeURIComponent(q)}`;
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
      <div className="flex items-center gap-2">
        <label className={`btn btn-xs ${mode === 'name' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('name')}>Name</label>
        <label className={`btn btn-xs ${mode === 'disease' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('disease')}>Disease</label>
      </div>
      <input
        placeholder={mode === "name" ? "Search molecule name (e.g. aspirin)" : "Search disease keyword (e.g. cancer)"}
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
