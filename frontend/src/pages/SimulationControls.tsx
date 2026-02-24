import { useCallback } from "react";
import { motion } from "framer-motion";
import { Play, RotateCcw, Loader2, AlertTriangle, Biohazard, Bug, Dna, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGlobalExploration } from "@/context/GlobalExplorationContext";
import DiseaseAwarePanel from "@/components/DiseaseAwarePanel";
import SimulationHistoryPanel from "@/components/SimulationHistoryPanel";
import SensitivityAnalysisPanel from "@/components/SensitivityAnalysisPanel";
import PerformanceGuardrails from "@/components/PerformanceGuardrails";
import GuidedDemoMode from "@/components/GuidedDemoMode";

const SimulationControls = () => {
  const {
    weights,
    setWeights,
    filters,
    setFilters,
    diffusionEnabled,
    setDiffusionEnabled,
    scoringAlgorithm,
    setScoringAlgorithm,
    scoredResults,
    isLoadingDataset,
    datasetError,
    runSimulation,
    simulationMetadata,
  } = useGlobalExploration();

  const handleRun = useCallback(() => {
    runSimulation();
  }, [runSimulation]);

  const handleReset = useCallback(() => {
    setWeights({ binding: 0.25, toxicity: 0.20, solubility: 0.15, lipinski: 0.15, mw: 0.10, logp: 0.15 });
    setFilters({ lipinskiOnly: false, toxicityThreshold: 1.0, sourceFilter: 'All' });
    setDiffusionEnabled(true);
    setScoringAlgorithm('quantum');
  }, [setWeights, setFilters, setDiffusionEnabled, setScoringAlgorithm]);

  const sliders = [
    { key: "binding" as const, label: "Binding Affinity Weight" },
    { key: "toxicity" as const, label: "Toxicity Weight" },
    { key: "solubility" as const, label: "Solubility Weight" },
    { key: "lipinski" as const, label: "Lipinski Compliance Weight" },
    { key: "mw" as const, label: "Molecular Weight Score" },
    { key: "logp" as const, label: "LogP Score Weight" },
  ];

  const sourceModes = [
    { value: "All", label: "All Sources", icon: Dna },
    { value: "PubChem", label: "PubChem", icon: Biohazard },
    { value: "Delaney", label: "Delaney", icon: AlertTriangle },
    { value: "Quantum", label: "Quantum", icon: Bug },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground mb-1">Simulation Controls</h2>
        <p className="text-muted-foreground text-sm">Configure weights, filters, and source mode for quantum-inspired exploration. Changes are synchronized across all views.</p>
      </div>

      {datasetError && <p className="text-sm text-destructive">{datasetError}</p>}

      {/* Guided Demo Mode */}
      <GuidedDemoMode />

      {/* Performance Guardrails */}
      <PerformanceGuardrails />

      {/* Disease-Aware Mode Panel */}
      <DiseaseAwarePanel />

      {/* Source Mode Selector */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
        <h3 className="font-display font-semibold text-foreground mb-3">Dataset Source Filter</h3>
        <div className="flex flex-wrap gap-3">
          {sourceModes.map((mode) => (
            <Button
              key={mode.value}
              variant={filters.sourceFilter === mode.value ? "default" : "outline"}
              className={filters.sourceFilter === mode.value ? "gradient-primary text-primary-foreground btn-glow" : "border-border hover:bg-muted/50"}
              onClick={() => setFilters({ sourceFilter: mode.value })}
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
                onValueChange={(v) => setWeights({ [s.key]: v[0] })}
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
            <Switch 
              checked={filters.toxicityThreshold < 0.5} 
              onCheckedChange={(v) => setFilters({ toxicityThreshold: v ? 0.5 : 1.0 })} 
              className="data-[state=checked]:bg-primary" 
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <Label className="text-sm text-muted-foreground">Lipinski Compliant Only</Label>
            <Switch 
              checked={filters.lipinskiOnly} 
              onCheckedChange={(v) => setFilters({ lipinskiOnly: v })} 
              className="data-[state=checked]:bg-primary" 
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <Label className="text-sm text-muted-foreground">Quantum Diffusion Mode</Label>
            <Switch 
              checked={diffusionEnabled} 
              onCheckedChange={setDiffusionEnabled} 
              className="data-[state=checked]:bg-primary" 
            />
          </div>

          {/* Scoring Algorithm */}
          <div className="space-y-2 pt-2">
            <Label className="text-sm text-muted-foreground">Scoring Algorithm</Label>
            <Select value={scoringAlgorithm} onValueChange={(v: any) => setScoringAlgorithm(v)}>
              <SelectTrigger className="bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="quantum">Quantum-Inspired</SelectItem>
                <SelectItem value="classical">Classical</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
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

          {scoredResults.length > 0 && (
            <div className="glass-card p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Molecules Scored</p>
              <p className="font-display text-3xl font-bold text-gradient">{scoredResults.length.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Top score: {scoredResults[0]?.weighted_score.toFixed(3)}
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Simulation History */}
      <SimulationHistoryPanel />

      {/* Sensitivity Analysis */}
      <SensitivityAnalysisPanel />

      {/* Action Buttons */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4">
        <Button
          onClick={handleRun}
          disabled={isLoadingDataset}
          className="btn-glow gradient-primary text-primary-foreground font-semibold px-8 h-12"
        >
          {isLoadingDataset ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Play className="mr-2 h-5 w-5" />
              Save Snapshot
            </>
          )}
        </Button>
        <Button variant="outline" onClick={handleReset} className="border-border hover:bg-muted/50 h-12 px-6">
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </motion.div>

      {/* Live sync notification */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/10 rounded-lg p-3">
        <Zap className="h-4 w-4 text-primary" />
        <span>Changes are automatically synchronized to Visualization and Results pages in real-time.</span>
      </div>
    </div>
  );
};

export default SimulationControls;
