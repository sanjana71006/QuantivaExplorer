import React, { useState, useCallback } from 'react';
import { Search, Plus, Loader2, Trash2, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useExploration, VisualMode, DataSource } from '@/context/ExplorationContext';
import { fetchMoleculeByName } from '@/services/pubchemApi';

const visualModeLabels: Record<VisualMode, string> = {
  galaxy: '🌌 Galaxy View',
  network: '🕸 Network View',
  'risk-reward': '🔥 Risk-Reward Map',
  compare: '📊 Compare View',
  split: '🧪 Classical vs Quantum',
};

const dataSourceLabels: Record<DataSource, string> = {
  local: 'Local',
  pubchem: 'PubChem',
  hybrid: 'Hybrid',
};

export default function CommandBar() {
  const {
    molecules,
    selectedMolecule,
    visualMode,
    dataSource,
    isLoading,
    setVisualMode,
    addMolecule,
    addToCompare,
    setLoading,
    clearAll,
  } = useExploration();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setLoading(true);
    try {
      const mol = await fetchMoleculeByName(searchQuery.trim());
      if (mol) {
        addMolecule(mol);
      } else {
        console.warn('Molecule not found:', searchQuery);
      }
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setSearchLoading(false);
      setLoading(false);
    }
  }, [searchQuery, addMolecule, setLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleAddToCompare = () => {
    if (selectedMolecule) {
      addToCompare(selectedMolecule);
    }
  };

  return (
    <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-[400px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search PubChem (e.g., aspirin)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 bg-card border-border"
              disabled={searchLoading}
            />
          </div>
          <Button onClick={handleSearch} disabled={searchLoading || !searchQuery.trim()} size="sm">
            {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        {/* Add to Compare */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddToCompare}
          disabled={!selectedMolecule}
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          Compare
        </Button>

        {/* Similarity / Outbreak toggles removed */}

        {/* Data Source */}
        <Badge variant="outline" className="px-3 py-1 gap-1">
          <FlaskConical className="h-3 w-3" />
          {dataSourceLabels[dataSource]}
        </Badge>

        {/* Visual Mode */}
        <Select value={visualMode} onValueChange={(v) => setVisualMode(v as VisualMode)}>
          <SelectTrigger className="w-[200px] bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {Object.entries(visualModeLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Molecule Count */}
        <Badge variant="secondary" className="px-3 py-1">
          {molecules.length} / 50 molecules
        </Badge>

        {/* Clear All */}
        <Button variant="ghost" size="sm" onClick={clearAll} className="text-destructive hover:text-destructive gap-1">
          <Trash2 className="h-4 w-4" />
          Clear All
        </Button>

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        )}
      </div>
    </div>
  );
}
