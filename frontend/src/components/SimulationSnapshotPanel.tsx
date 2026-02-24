import { motion } from 'framer-motion';
import { Zap, Clock, Database, BarChart3, Atom, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useGlobalExploration } from '@/context/GlobalExplorationContext';

export default function SimulationSnapshotPanel() {
  const { simulationMetadata, weights, diffusionEnabled, scoringAlgorithm, diseaseProfile } = useGlobalExploration();

  if (!simulationMetadata) {
    return null;
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const weightEntries = [
    { key: 'binding', label: 'Binding', value: weights.binding },
    { key: 'toxicity', label: 'Toxicity', value: weights.toxicity },
    { key: 'solubility', label: 'Solubility', value: weights.solubility },
    { key: 'lipinski', label: 'Lipinski', value: weights.lipinski },
    { key: 'mw', label: 'MW', value: weights.mw },
    { key: 'logp', label: 'LogP', value: weights.logp },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
          <Atom className="h-4 w-4 text-primary" />
          Simulation Snapshot
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatTime(simulationMetadata.timestamp)}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {/* Algorithm */}
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Algorithm</span>
          </div>
          <p className="font-medium text-foreground capitalize">{scoringAlgorithm}</p>
          {diffusionEnabled && (
            <Badge variant="outline" className="text-[10px] mt-1 border-primary/30 text-primary">
              Quantum Walk ON
            </Badge>
          )}
        </div>

        {/* Dataset */}
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Database className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Dataset</span>
          </div>
          <p className="font-medium text-foreground">{simulationMetadata.datasetName}</p>
          <p className="text-xs text-muted-foreground">{simulationMetadata.moleculeCount} molecules</p>
        </div>

        {/* Top Score */}
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Top Score</span>
          </div>
          <p className="font-display text-xl font-bold text-gradient">{simulationMetadata.topScore.toFixed(3)}</p>
        </div>

        {/* Disease Mode */}
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Disease Mode</span>
          </div>
          {diseaseProfile.enabled ? (
            <>
              <p className="font-medium text-foreground capitalize">{diseaseProfile.category}</p>
              <p className="text-xs text-muted-foreground truncate">{diseaseProfile.keyword}</p>
            </>
          ) : (
            <p className="font-medium text-muted-foreground">Disabled</p>
          )}
        </div>
      </div>

      {/* Weight Distribution */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Weight Distribution</p>
        <div className="flex gap-1 h-6">
          {weightEntries.map((w, i) => {
            const hues = [186, 0, 160, 45, 280, 260];
            return (
              <motion.div
                key={w.key}
                initial={{ width: 0 }}
                animate={{ width: `${w.value * 100}%` }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded relative group cursor-help"
                style={{ 
                  backgroundColor: `hsl(${hues[i]}, 70%, 50%)`,
                  minWidth: w.value > 0 ? '20px' : '0',
                }}
                title={`${w.label}: ${(w.value * 100).toFixed(0)}%`}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-medium text-white drop-shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    {w.label.charAt(0)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
          {weightEntries.map(w => (
            <span key={w.key}>{w.label}: {(w.value * 100).toFixed(0)}%</span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
