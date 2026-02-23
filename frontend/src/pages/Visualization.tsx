import { useState, useMemo, Suspense, useEffect, lazy } from "react";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Atom, Maximize2 } from "lucide-react";
import { getDataset } from "@/lib/moleculeDataset";
import { scoreMolecules, quantumWalk, defaultWeights } from "@/lib/quantumEngine";
import { explainMolecule } from "@/lib/aiExplainer";
import { useLiveMolecules } from "@/hooks/useLiveMolecules";
import ApiStatusBadge from "@/components/ApiStatusBadge";
const ChemicalUniverse3D = lazy(() => import("@/components/ChemicalUniverse3D"));
import ProbabilityFlowMap from "@/components/ProbabilityFlowMap";
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
  const [threshold, setThreshold] = useState([0.3]);
  const [diseaseFilter, setDiseaseFilter] = useState("All");
  const [selectedMol, setSelectedMol] = useState<ScoredMolecule | null>(null);
  const [attractorIds, setAttractorIds] = useState<string[]>([]);
  const [visualMode, setVisualMode] = useState<"galaxy" | "cluster" | "network" | "split">("galaxy");
  const [outbreakMode, setOutbreakMode] = useState<boolean>(false);
  const [show3D, setShow3D] = useState(true);
  const [dataset, setDataset] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Live molecules hook — shows live API data when available
  const { items: liveItems, status: liveStatus, source: liveSource, lastUpdated, refresh } = useLiveMolecules({ limit: 50 });

  useEffect(() => {
    let active = true;
    getDataset()
      .then((rows) => {
        if (!active) return;
        setDataset(rows);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load dataset");
      });

    return () => {
      active = false;
    };
  }, []);

  // If user selects the UI 'Quantum' mode, don't use it as a dataset source filter.
  // Treat 'Quantum' as a visualization/mode choice (i.e. equivalent to 'All' for source filtering).
  const effectiveFilter = diseaseFilter === "Quantum" ? "All" : diseaseFilter;

  const scored = useMemo(() => {
    return scoreMolecules(dataset, defaultWeights, effectiveFilter);
  }, [dataset, effectiveFilter]);

  const filtered = useMemo(
    () => scored.filter((m) => m.weighted_score >= threshold[0]),
    [scored, threshold]
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
    if (!selectedMol) return null;
    return explainMolecule(selectedMol);
  }, [selectedMol]);

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

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      {/* Live API status */}
      <div className="flex items-center justify-end">
        <LiveApiStatus />
      </div>

      {/* Controls */}
      <div className="glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">Score Threshold</Label>
        <Slider
          value={threshold}
          onValueChange={setThreshold}
          max={1}
          step={0.01}
          className="flex-1 [&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary [&_.relative>div]:bg-primary"
        />
        <span className="text-sm font-mono text-primary min-w-[3rem]">{threshold[0].toFixed(2)}</span>
        <Select value={diseaseFilter} onValueChange={setDiseaseFilter}>
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
                    molecules={filtered.slice(0, 500)}
                    onSelectMolecule={setSelectedMol}
                    selectedMoleculeId={selectedMol?.molecule_id || null}
                    attractorIds={attractorIds}
                    outbreak={outbreakMode}
                  />
                </Suspense>
              </div>
            </motion.div>
          )}

          {/* GPU Probability Flow Map */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
                <Atom className="h-4 w-4 text-primary" />
                Probability Flow Map (GPU)
              </h3>
              <p className="text-xs text-muted-foreground">Animated diffusion across embedding space</p>
            </div>
            <ProbabilityFlowMap
              molecules={filtered.slice(0, 500).map((m) => ({ pca_x: m.pca_x, pca_y: m.pca_y, probability: m.probability, id: m.molecule_id }))}
              size={128}
              onTopIndices={(indices: number[]) => {
                // map indices back to molecule ids and set attractors
                const subset = filtered.slice(0, 500);
                const ids = indices.map((i) => subset[i]?.molecule_id).filter(Boolean) as string[];
                setAttractorIds(ids);
              }}
            />
          </motion.div>
        </>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
            <h3 className="font-display font-semibold text-foreground mb-3">Classical View (Left)</h3>
            <div style={{ height: 360 }}>
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 20%, 18%)" />
                  <XAxis dataKey="molecular_weight" name="MW" type="number" />
                  <YAxis dataKey="logP" name="LogP" type="number" />
                  <Scatter data={scatterData} onClick={(d: any) => d && setSelectedMol(d)} />
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
                  onSelectMolecule={setSelectedMol}
                  selectedMoleculeId={selectedMol?.molecule_id || null}
                  attractorIds={attractorIds}
                  outbreak={outbreakMode}
                />
              </Suspense>
              <div className="mt-3">
                <ProbabilityFlowMap
                  molecules={filtered.slice(0, 500).map((m) => ({ pca_x: m.pca_x, pca_y: m.pca_y, probability: m.probability, id: m.molecule_id }))}
                  size={128}
                  onTopIndices={(indices: number[]) => {
                    const subset = filtered.slice(0, 500);
                    const ids = indices.map((i) => subset[i]?.molecule_id).filter(Boolean) as string[];
                    setAttractorIds(ids);
                  }}
                />
              </div>
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
              <Scatter data={scatterData} cursor="pointer" onClick={(d: any) => d && setSelectedMol(d)}>
                {scatterData.map((entry, i) => (
                  <Cell key={i} fill={diseaseColors[entry.disease_target] || diseaseColors.unknown} fillOpacity={0.7} r={4 + entry.drug_likeness_score * 8} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Quantum Probability Heatmap */}
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
                    onClick={() => mol && setSelectedMol(mol)}
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
      </div>

      {/* AI Explainer Panel */}
      {selectedMol && explanation && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 border-primary/20">
          <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
            <Atom className="h-5 w-5 text-primary" />
            Why this molecule? — {selectedMol.name}
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
