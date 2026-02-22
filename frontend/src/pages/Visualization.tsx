import { useState, useMemo, Suspense, useEffect } from "react";
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
import ChemicalUniverse3D from "@/components/ChemicalUniverse3D";
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
  const [show3D, setShow3D] = useState(true);
  const [dataset, setDataset] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const scored = useMemo(() => {
    return scoreMolecules(dataset, defaultWeights, diseaseFilter);
  }, [dataset, diseaseFilter]);

  const filtered = useMemo(
    () => scored.filter((m) => m.weighted_score >= threshold[0]),
    [scored, threshold]
  );

  // Heatmap from quantum walk
  const heatmapData = useMemo(() => {
    const history = quantumWalk(scored.slice(0, 100), 8);
    const last = history[history.length - 1];
    // Reshape into 10x10 grid
    return Array.from({ length: 10 }, (_, row) =>
      Array.from({ length: 10 }, (_, col) => ({
        row,
        col,
        value: last[row * 10 + col] || 0,
      }))
    ).flat();
  }, [scored]);

  const maxHeat = Math.max(...heatmapData.map((c) => c.value), 0.001);

  const explanation = useMemo(() => {
    if (!selectedMol) return null;
    return explainMolecule(selectedMol);
  }, [selectedMol]);

  // Scatter data (limit to 200 for recharts performance)
  const scatterData = useMemo(() => filtered.slice(0, 200), [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground mb-1">Visualization</h2>
        <p className="text-muted-foreground text-sm">Explore molecular clusters, probability distributions, and the 3D chemical universe.</p>
      </div>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

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
            <SelectItem value="Quantum">Quantum</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="border-primary/30 text-primary">
          {filtered.length.toLocaleString()} molecules
        </Badge>
      </div>

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
              />
            </Suspense>
          </div>
        </motion.div>
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
          <h3 className="font-display font-semibold text-foreground mb-4">Quantum Probability Heatmap</h3>
          <div className="grid grid-cols-10 gap-1">
            {heatmapData.map((cell, i) => {
              const norm = cell.value / maxHeat;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.003 }}
                  className="aspect-square rounded-sm cursor-pointer transition-transform hover:scale-110"
                  style={{
                    background: `linear-gradient(135deg, hsl(186, 100%, ${15 + 35 * norm}%), hsl(260, 60%, ${15 + 40 * norm}%))`,
                    opacity: 0.3 + norm * 0.7,
                  }}
                  title={`Molecule ${i + 1}: P = ${cell.value.toFixed(5)}`}
                />
              );
            })}
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
