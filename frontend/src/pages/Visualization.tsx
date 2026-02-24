import { useState, useMemo, Suspense, useEffect, lazy } from "react";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Atom, Maximize2, Zap } from "lucide-react";
import { scoreMolecules, quantumWalk, defaultWeights } from "@/lib/quantumEngine";
import { explainMolecule } from "@/lib/aiExplainer";
import { useLiveMolecules } from "@/hooks/useLiveMolecules";
import ApiStatusBadge from "@/components/ApiStatusBadge";
import SearchBar from "@/components/SearchBar";
import DataSourceBadge from "@/components/DataSourceBadge";
import VisualizationMetricsDashboard from "@/components/VisualizationMetricsDashboard";
import ProbabilityEvolutionReplay from "@/components/ProbabilityEvolutionReplay";
import DiversityWarningBanner from "@/components/DiversityWarningBanner";
import { useGlobalExploration } from "@/context/GlobalExplorationContext";
const ChemicalUniverse3D = lazy(() => import("@/components/ChemicalUniverse3D"));
import type { ScoredMolecule } from "@/lib/quantumEngine";

const diseaseColors: Record<string, string> = {
  PubChem: "hsl(186, 100%, 50%)",
  Delaney: "hsl(0, 84%, 60%)",
  Quantum: "hsl(160, 84%, 40%)",
  unknown: "hsl(260, 60%, 55%)",
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    const d = payload[0].payload;
    return (
      <div className="glass-card p-3 text-sm">
        <p className="font-semibold text-foreground">{d.name}</p>
        <p className="text-muted-foreground">MW: {d.molecular_weight}</p>
        <p className="text-muted-foreground">LogP: {d.logP}</p>
        <p className="text-primary">Score: {d.weighted_score?.toFixed(3)}</p>
        <p className="text-muted-foreground">{d.disease_target}</p>
      </div>
    );
  }
  return null;
};

const Visualization = () => {
  // Global state from context - auto-synchronized with Simulation page
  const {
    scoredResults,
    filters,
    setFilters,
    selectedMolecule,
    selectMolecule,
    diffusionEnabled,
    diversityMetrics,
    probabilityHistory,
    weights,
    isLoadingDataset,
  } = useGlobalExploration();

  // Local visualization-specific state
  const [visualMode, setVisualMode] = useState<"galaxy" | "cluster" | "network" | "split">("galaxy");
  const [outbreakMode, setOutbreakMode] = useState<boolean>(false);
  const [show3D, setShow3D] = useState(true);
  const [attractorIds, setAttractorIds] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchSource, setSearchSource] = useState<string | null>(null);

  // Convert remote search items into Molecule shape and score them
  const liveSearchMolecules = useMemo(() => {
    if (!searchResults || !searchResults.length) return [];
    // Map incoming normalized records to Molecule interface expected by scoreMolecules
    const mapped = searchResults.slice(0, 50).map((it, i) => {
      const mw = Number(it.molecular_weight) || 0;
      const logP = Number(it.logP) || Number(it.XLogP) || 0;
      const donors = Number(it.h_donors ?? it.HBondDonorCount) || 0;
      const acceptors = Number(it.h_acceptors ?? it.HBondAcceptorCount) || 0;
      const smiles = it.smiles || it.CanonicalSMILES || '';
      // basic pca-like embedding from descriptors
      const pca_x = Number(((mw - 300) / 200) * 5);
      const pca_y = Number(((logP - 1) / 4) * 5);
      const pca_z = Number(((donors + acceptors) / 10 - 0.5) * 5);

      return {
        molecule_id: String(it.id || it.CID || `pub_${i}`),
        name: it.name || it.title || it.Name || `Compound ${i}`,
        smiles,
        source_dataset: searchSource || 'pubchem',
        formula: '',
        molecular_weight: mw,
        logP: logP,
        h_bond_donors: donors,
        h_bond_acceptors: acceptors,
        rotatable_bonds: 0,
        polar_surface_area: Number(it.tpsa ?? it.TPSA) || 0,
        solubility: 0.5,
        toxicity_risk: 0.2,
        efficacy_index: 0.5,
        safety_index: 0.5,
        molecular_complexity: 0.3,
        drug_score: 0.5,
        lipinski_compliant: 1,
        disease_target: searchSource === 'local' ? 'Local' : 'PubChem',
        drug_likeness_score: 0.5,
        pca_x,
        pca_y,
        pca_z,
      } as any;
    });

    const scored = scoreMolecules(mapped, defaultWeights);
    return scored.slice(0, 50);
  }, [searchResults, searchSource]);

  // Live molecules hook — shows live API data when available
  const { items: liveItems, status: liveStatus, source: liveSource, lastUpdated, refresh } = useLiveMolecules({ limit: 50 });

  // Use global scoredResults directly - no need for local dataset loading
  const scored = scoredResults;

  // Filter by score threshold from global context
  const filtered = useMemo(
    () => scored.filter((m) => m.weighted_score >= (filters.scoreThreshold || 0.3)),
    [scored, filters.scoreThreshold]
  );

  // Heatmap from quantum walk (improved UX)
  // Use top-N scored molecules for the heatmap (default N=50). The grid will be 10 columns by ceil(N/10) rows.
  const heatmapSize = 50; // change this to 100 if you prefer a 10x10 grid
  const heatmapCols = 10;

  const heatmapData = useMemo(() => {
    const subset = scored.slice(0, heatmapSize);
    if (subset.length === 0) return [];
    const history = quantumWalk(subset, 8);
    const last = history[history.length - 1];
    const rows = Math.ceil(heatmapSize / heatmapCols);

    // Build enriched cell objects that include molecule metadata and probability
    const cells: { row: number; col: number; value: number; molecule?: any; index: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < heatmapCols; c++) {
        const idx = r * heatmapCols + c;
        const prob = last?.[idx] || 0;
        cells.push({ row: r, col: c, value: prob, molecule: subset[idx], index: idx });
      }
    }
    return cells;
  }, [scored]);

  const maxHeat = Math.max(...heatmapData.map((c) => c.value), 0.000001);

  // Color interpolation across three stops for perceptual clarity
  const getHeatColor = (t: number) => {
    // clamp
    const v = Math.max(0, Math.min(1, t));
    // three stops: dark-blue -> cyan -> warm-yellow
    const low = { r: 31, g: 59, b: 123 };
    const mid = { r: 42, g: 183, b: 202 };
    const high = { r: 255, g: 209, b: 102 };
    if (v < 0.5) {
      const f = v / 0.5;
      const r = Math.round(low.r + (mid.r - low.r) * f);
      const g = Math.round(low.g + (mid.g - low.g) * f);
      const b = Math.round(low.b + (mid.b - low.b) * f);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      const f = (v - 0.5) / 0.5;
      const r = Math.round(mid.r + (high.r - mid.r) * f);
      const g = Math.round(mid.g + (high.g - mid.g) * f);
      const b = Math.round(mid.b + (high.b - mid.b) * f);
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  const explanation = useMemo(() => {
    if (!selectedMolecule) return null;
    return explainMolecule(selectedMolecule, weights);
  }, [selectedMolecule, weights]);

  // When outbreakMode is toggled on, compute top-5 attractors and set them
  useEffect(() => {
    if (outbreakMode) {
      const top = scored.slice(0, 5).map((s) => s.molecule_id).filter(Boolean) as string[];
      setAttractorIds(top);
    } else {
      setAttractorIds([]);
    }
  }, [outbreakMode, scored]);

  // Scatter data (limit to 200 for recharts performance)
  const scatterData = useMemo(() => filtered.slice(0, 200), [filtered]);

  // Merge liveSearchMolecules on top of filtered dataset for visualization (dedupe by id)
  const displayedMolecules = useMemo(() => {
    const map = new Map<string, any>();
    // add live search first
    for (const m of liveSearchMolecules) {
      map.set(m.molecule_id, m);
    }
    for (const m of filtered) {
      if (!map.has(m.molecule_id)) map.set(m.molecule_id, m);
    }
    return Array.from(map.values()).slice(0, 500);
  }, [liveSearchMolecules, filtered]);

  // small wrapper component rendered near top-right to show API status
  function LiveApiStatus() {
    return <ApiStatusBadge status={liveStatus} source={liveSource} lastUpdated={lastUpdated} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground mb-1">Visualization</h2>
        <p className="text-muted-foreground text-sm">Explore molecular clusters, probability distributions, and the 3D chemical universe.</p>
      </div>

      {isLoadingDataset && <p className="text-sm text-muted-foreground">Loading dataset...</p>}

      {/* Visualization Metrics Dashboard */}
      <VisualizationMetricsDashboard />

      {/* Diversity Warning Banner */}
      <DiversityWarningBanner />

      {/* Probability Evolution Replay */}
      <ProbabilityEvolutionReplay />

      {/* Live sync notification */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/10 rounded-lg p-3">
        <Zap className="h-4 w-4 text-primary" />
        <span>Visualization is synchronized with Simulation settings. Changes update in real-time.</span>
      </div>

      {/* Live API status */}
      <div className="flex items-center justify-end">
        <LiveApiStatus />
      </div>

      {/* Search bar + source badge */}
      <div className="glass-card p-4 flex items-center gap-4">
        <div className="flex-1">
          <SearchBar
            onResults={(items, source) => {
              setSearchResults(items || []);
              setSearchSource(String(source || 'local'));
              // auto-select first result if present
              if (Array.isArray(items) && items.length > 0) {
                const first = items[0];
                const candidate = {
                  molecule_id: String(first.id || first.CID || 'r1'),
                  name: first.name || first.Title || 'Result',
                  molecular_weight: Number(first.molecular_weight) || 0,
                  logP: Number(first.logP) || 0,
                  probability: 0,
                } as any;
                selectMolecule(candidate);
              }
            }}
          />
        </div>
        <DataSourceBadge source={searchSource} />
      </div>

      {/* Search result preview */}
      {searchResults && searchResults.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-start gap-4">
            <div className="w-36 h-36 bg-white rounded shadow flex items-center justify-center">
              {/* 2D image from PubChem if available */}
              <img src={searchResults[0].image_url || `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${searchResults[0].id}/PNG`} alt={searchResults[0].name || 'molecule'} className="max-w-full max-h-full" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold">{searchResults[0].name || searchResults[0].Title || 'Compound'}</h4>
                  <div className="text-xs text-muted-foreground">ID: {searchResults[0].id || searchResults[0].CID}</div>
                </div>
                <DataSourceBadge source={searchSource} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Molecular Weight</div>
                  <div className="font-medium">{searchResults[0].molecular_weight ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">LogP</div>
                  <div className="font-medium">{searchResults[0].logP ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">H Donors</div>
                  <div className="font-medium">{searchResults[0].h_donors ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">H Acceptors</div>
                  <div className="font-medium">{searchResults[0].h_acceptors ?? '—'}</div>
                </div>
              </div>

              <div className="mt-4">
                <button className="btn btn-sm btn-primary" onClick={() => {
                  // add first result into 3D view by updating selectedMol and ensuring liveSearchMolecules present
                  const it = searchResults[0];
                  const candidate = {
                    molecule_id: String(it.id || it.CID || 'r1'),
                    name: it.name || it.Title || 'Result',
                    molecular_weight: Number(it.molecular_weight) || 0,
                    logP: Number(it.logP) || 0,
                    probability: 0,
                  } as any;
                  selectMolecule(candidate);
                }}>Inspect</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">Score Threshold</Label>
        <Slider
          value={[filters.scoreThreshold || 0.3]}
          onValueChange={(v) => setFilters({ scoreThreshold: v[0] })}
          max={1}
          step={0.01}
          className="flex-1 [&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary [&_.relative>div]:bg-primary"
        />
        <span className="text-sm font-mono text-primary min-w-[3rem]">{(filters.scoreThreshold || 0.3).toFixed(2)}</span>
        <Select value={filters.sourceFilter || "All"} onValueChange={(v) => setFilters({ sourceFilter: v })}>
          <SelectTrigger className="w-36 bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="All">All Sources</SelectItem>
            <SelectItem value="PubChem">PubChem</SelectItem>
            <SelectItem value="Delaney">Delaney</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="border-primary/30 text-primary">
          {filtered.length.toLocaleString()} molecules
        </Badge>
        <div className="ml-4 flex items-center gap-3">
          <label className="text-sm text-muted-foreground">Visual Mode</label>
          <Select value={(visualMode as any) || "galaxy"} onValueChange={(v) => setVisualMode(v as any)}>
            <SelectTrigger className="w-44 bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="galaxy">Galaxy View</SelectItem>
              <SelectItem value="cluster">Cluster Heatmap</SelectItem>
              <SelectItem value="network">Network Graph</SelectItem>
              <SelectItem value="split">Classical vs Quantum (Split)</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Outbreak Mode</span>
            <Switch checked={outbreakMode} onCheckedChange={(v) => setOutbreakMode(Boolean(v))} />
          </div>
        </div>
      </div>

      {visualMode !== "split" ? (
        <>
          {/* 3D Chemical Universe */}
          {show3D && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
                  <Atom className="h-4 w-4 text-primary" />
                  3D Chemical Universe
                </h3>
                <p className="text-xs text-muted-foreground">Drag to rotate • Scroll to zoom • Click molecule to inspect</p>
              </div>
              <div className="h-[450px]">
                <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                  <ChemicalUniverse3D
                        molecules={displayedMolecules}
                    onSelectMolecule={selectMolecule}
                    selectedMoleculeId={selectedMolecule?.molecule_id || null}
                    attractorIds={attractorIds}
                    outbreak={outbreakMode}
                  />
                </Suspense>
              </div>
            </motion.div>
          )}

          {/* Probability Flow Map removed */}
        </>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4 divide-x divide-border">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
            <h3 className="font-display font-semibold text-foreground mb-3">Classical View (Left)</h3>
            <div style={{ height: 360 }}>
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 20%, 18%)" />
                  <XAxis dataKey="molecular_weight" name="MW" type="number" />
                  <YAxis dataKey="logP" name="LogP" type="number" />
                  <Scatter data={scatterData} onClick={(d: any) => d && selectMolecule(d)} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
            <h3 className="font-display font-semibold text-foreground mb-3">Quantum View (Right)</h3>
            <div className="h-[420px]">
              <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                <ChemicalUniverse3D
                  molecules={filtered.slice(0, 500)}
                  onSelectMolecule={selectMolecule}
                  selectedMoleculeId={selectedMolecule?.molecule_id || null}
                  attractorIds={attractorIds}
                  outbreak={outbreakMode}
                />
              </Suspense>
              {/* Probability Flow Map removed */}
            </div>
          </motion.div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Scatter Plot */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <h3 className="font-display font-semibold text-foreground mb-4">Molecular Property Scatter</h3>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 20%, 18%)" />
              <XAxis dataKey="molecular_weight" name="MW" type="number" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} axisLine={{ stroke: "hsl(222, 20%, 18%)" }} label={{ value: "Molecular Weight", position: "bottom", fill: "hsl(215, 20%, 55%)", fontSize: 12 }} />
              <YAxis dataKey="logP" name="LogP" type="number" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} axisLine={{ stroke: "hsl(222, 20%, 18%)" }} label={{ value: "LogP", angle: -90, position: "insideLeft", fill: "hsl(215, 20%, 55%)", fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={scatterData} cursor="pointer" onClick={(d: any) => d && selectMolecule(d)}>
                {scatterData.map((entry, i) => (
                  <Cell key={i} fill={diseaseColors[entry.disease_target] || diseaseColors.unknown} fillOpacity={0.7} r={4 + entry.drug_likeness_score * 8} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Quantum Probability Heatmap (hidden in split mode to avoid visual merging) */}
        {visualMode !== "split" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
            <h3 className="font-display font-semibold text-foreground mb-2">Quantum Probability Heatmap</h3>
            <p className="text-xs text-muted-foreground mb-3">Top {heatmapSize} candidates (by weighted score). Hover tiles to see molecule name and probability.</p>
            <div className="grid grid-cols-10 gap-1">
              {heatmapData.map((cell, i) => {
                const absProb = cell.value; // absolute probability
                const norm = absProb / maxHeat; // 0..1 intensity
                const mol = cell.molecule;
                const percent = (absProb * 100).toFixed(2);
                const bg = getHeatColor(norm);
                const isTop5 = cell.index < 5;

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.003 }}
                    className={`aspect-square rounded-sm cursor-pointer transition-transform hover:scale-105 relative flex items-center justify-center`}
                    style={{
                      background: bg,
                      boxShadow: isTop5 ? "0 0 0 3px rgba(255,215,102,0.18)" : undefined,
                      border: isTop5 ? "2px solid rgba(255,215,102,0.9)" : "1px solid rgba(255,255,255,0.06)",
                      opacity: 0.95,
                    }}
                    title={`#${cell.index + 1} ${mol?.name ?? "—"}: ${percent}%`}
                    onClick={() => mol && selectMolecule(mol)}
                  >
                    {/* Show percent label when reasonably visible */}
                    <div className="text-[10px] font-semibold text-white drop-shadow-sm" style={{ opacity: absProb > 0.0005 ? 1 : 0.0 }}>
                      {absProb > 0.0005 ? `${percent}%` : ""}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Colorbar / legend */}
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-3 rounded overflow-hidden" style={{ background: `linear-gradient(90deg, ${getHeatColor(0)} 0%, ${getHeatColor(0.5)} 50%, ${getHeatColor(1)} 100%)` }} />
              <div className="text-xs text-muted-foreground w-24 text-right">0%</div>
              <div className="text-xs text-muted-foreground w-28 text-right">Max: {(maxHeat * 100).toFixed(2)}%</div>
            </div>
            <div className="flex justify-between mt-3">
              <span className="text-xs text-muted-foreground">Low probability</span>
              <span className="text-xs text-muted-foreground">High probability</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* AI Explainer Panel */}
      {selectedMolecule && explanation && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 border-primary/20">
          <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
            <Atom className="h-5 w-5 text-primary" />
            Why this molecule? — {selectedMolecule.name}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">{explanation.summary}</p>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <h4 className="text-sm font-semibold text-success mb-2">✦ Key Strengths</h4>
              <ul className="space-y-1">
                {explanation.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-success mt-0.5">•</span> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-destructive mb-2">⚠ Potential Risks</h4>
              <ul className="space-y-1">
                {explanation.risks.map((r, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-destructive mt-0.5">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="glass-card p-3 mb-3">
            <h4 className="text-xs text-muted-foreground mb-2">Lipinski Rule of Five</h4>
            <div className="flex flex-wrap gap-2">
              {explanation.lipinskiDetails.map((d, i) => (
                <Badge key={i} variant="outline" className={`text-xs ${d.includes("✓") ? "border-success/30 text-success" : "border-destructive/30 text-destructive"}`}>
                  {d}
                </Badge>
              ))}
            </div>
          </div>

          <p className="text-sm text-foreground font-medium">{explanation.verdict}</p>
        </motion.div>
      )}
    </div>
  );
};

export default Visualization;
