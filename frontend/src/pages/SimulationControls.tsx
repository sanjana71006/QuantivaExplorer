import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, RotateCcw, Loader2, AlertTriangle, Biohazard, Bug, Dna } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getDataset } from "@/lib/moleculeDataset";
import { scoreMolecules, defaultWeights, type ScoringWeights, type ScoredMolecule } from "@/lib/quantumEngine";

const SimulationControls = () => {
  const [weights, setWeights] = useState<ScoringWeights>({ ...defaultWeights });
  const [filterToxic, setFilterToxic] = useState(false);
  const [filterNonLipinski, setFilterNonLipinski] = useState(false);
  const [quantumMode, setQuantumMode] = useState(true);
  const [diseaseMode, setDiseaseMode] = useState("All");
  const [running, setRunning] = useState(false);
  const [dataset, setDataset] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [results, setResults] = useState<ScoredMolecule[] | null>(null);

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

  const updateWeight = (key: keyof ScoringWeights, value: number[]) => {
    setWeights((prev) => ({ ...prev, [key]: value[0] }));
  };

  const handleRun = useCallback(() => {
    setRunning(true);
    // Use requestAnimationFrame to allow UI update before heavy computation
    setTimeout(() => {
      if (!dataset.length) {
        setResults([]);
        setRunning(false);
        return;
      }

      let data = [...dataset];
      if (filterToxic) data = data.filter((m) => m.toxicity_risk < 0.5);
      if (filterNonLipinski) data = data.filter((m) => m.lipinski_compliant === 1);
      const scored = scoreMolecules(data, weights, diseaseMode);
      setResults(scored);
      setRunning(false);
    }, 100);
  }, [dataset, weights, filterToxic, filterNonLipinski, diseaseMode]);

  const handleReset = () => {
    setWeights({ ...defaultWeights });
    setFilterToxic(false);
    setFilterNonLipinski(false);
    setQuantumMode(true);
    setDiseaseMode("All");
    setResults(null);
  };

  const sliders: { key: keyof ScoringWeights; label: string }[] = [
    { key: "bindingAffinity", label: "Binding Affinity Weight" },
    { key: "toxicity", label: "Toxicity Weight" },
    { key: "solubility", label: "Solubility Weight" },
    { key: "lipinski", label: "Lipinski Compliance Weight" },
    { key: "molecularWeight", label: "Molecular Weight Score" },
    { key: "logP", label: "LogP Score Weight" },
  ];

  const outbreakModes = [
    { value: "All", label: "All Sources", icon: Dna },
    { value: "PubChem", label: "PubChem", icon: Biohazard },
    { value: "Delaney", label: "Delaney", icon: AlertTriangle },
    { value: "Quantum", label: "Quantum", icon: Bug },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground mb-1">Simulation Controls</h2>
        <p className="text-muted-foreground text-sm">Configure weights, filters, and source mode for quantum-inspired exploration.</p>
      </div>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      {/* Outbreak Mode Selector */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
        <h3 className="font-display font-semibold text-foreground mb-3">Dataset Source Mode</h3>
        <div className="flex flex-wrap gap-3">
          {outbreakModes.map((mode) => (
            <Button
              key={mode.value}
              variant={diseaseMode === mode.value ? "default" : "outline"}
              className={diseaseMode === mode.value ? "gradient-primary text-primary-foreground btn-glow" : "border-border hover:bg-muted/50"}
              onClick={() => setDiseaseMode(mode.value)}
            >
              <mode.icon className="mr-2 h-4 w-4" />
              {mode.label}
            </Button>
          ))}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Sliders */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-6 space-y-5">
          <h3 className="font-display font-semibold text-foreground">Weight Parameters</h3>
          {sliders.map((s) => (
            <div key={s.key} className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-sm text-muted-foreground">{s.label}</Label>
                <span className="text-sm font-mono text-primary">{weights[s.key].toFixed(2)}</span>
              </div>
              <Slider
                value={[weights[s.key]]}
                onValueChange={(v) => updateWeight(s.key, v)}
                max={1}
                step={0.01}
                className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary [&_.relative>div]:bg-primary"
              />
            </div>
          ))}
        </motion.div>

        {/* Toggles & Info */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-6 space-y-5">
          <h3 className="font-display font-semibold text-foreground">Filters & Modes</h3>

          <div className="flex items-center justify-between py-2">
            <Label className="text-sm text-muted-foreground">Filter High Toxicity ({">"}0.5)</Label>
            <Switch checked={filterToxic} onCheckedChange={setFilterToxic} className="data-[state=checked]:bg-primary" />
          </div>
          <div className="flex items-center justify-between py-2">
            <Label className="text-sm text-muted-foreground">Lipinski Compliant Only</Label>
            <Switch checked={filterNonLipinski} onCheckedChange={setFilterNonLipinski} className="data-[state=checked]:bg-primary" />
          </div>
          <div className="flex items-center justify-between py-2">
            <Label className="text-sm text-muted-foreground">Quantum Diffusion Mode</Label>
            <Switch checked={quantumMode} onCheckedChange={setQuantumMode} className="data-[state=checked]:bg-primary" />
          </div>

          {/* Weight Summary */}
          <div className="pt-3">
            <h3 className="font-display font-semibold text-foreground mb-3">Weight Distribution</h3>
            <div className="glass-card p-4 space-y-2">
              {sliders.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground flex-1 truncate">{s.label}</span>
                  <div className="score-bar flex-1">
                    <div className="score-bar-fill" style={{ width: `${weights[s.key] * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {results && (
            <div className="glass-card p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Molecules Scored</p>
              <p className="font-display text-3xl font-bold text-gradient">{results.length.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Top score: {results[0]?.weighted_score.toFixed(3)}
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Action Buttons */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4">
        <Button
          onClick={handleRun}
          disabled={running}
          className="btn-glow gradient-primary text-primary-foreground font-semibold px-8 h-12"
        >
          {running ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Running Simulation...
            </>
          ) : (
            <>
              <Play className="mr-2 h-5 w-5" />
              Run Simulation
            </>
          )}
        </Button>
        <Button variant="outline" onClick={handleReset} className="border-border hover:bg-muted/50 h-12 px-6">
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </motion.div>
    </div>
  );
};

export default SimulationControls;
