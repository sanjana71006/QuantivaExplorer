import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

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
  const [error, setError] = useState<string | null>(null);

  async function doSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = String(query || "").trim();
    if (!q) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const apiBase = getApiBaseUrl();
      const url = `${apiBase}/api/molecule/${encodeURIComponent(q)}`;
      console.log(`🔍 Searching: ${url}`);
      
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Search failed: ${resp.status} ${resp.statusText}`);
      }
      
      const json = await resp.json();
      console.log(`✅ Search results:`, json);
      
      const items = Array.isArray(json.items) ? json.items : [];
      const source = json.source || "unknown";
      
      if (items.length === 0) {
        setError(`No results found for "${q}"`);
      }
      
      onResults(items, source);
    } catch (err) {
      console.error("Search error:", err);
      setError(err instanceof Error ? err.message : "Search failed");
      onResults([], "local");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2 w-full">
      <form onSubmit={doSearch} className="flex items-center gap-3 w-full">
        <Input
          placeholder="Search molecule name (e.g. aspirin, cortisone)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-background border-border"
        />
        <Button 
          type="submit" 
          disabled={loading || !query.trim()}
          className="gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Search
            </>
          )}
        </Button>
      </form>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
