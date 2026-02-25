import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Layers, GitBranch, Sparkles, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useGlobalExploration } from '@/context/GlobalExplorationContext';
import MetricTooltip from '@/components/MetricTooltip';

export default function VisualizationMetricsDashboard() {
  const { scoredResults, diversityMetrics, probabilityHistory, diffusionEnabled } = useGlobalExploration();

  const metrics = useMemo(() => {
    if (!scoredResults.length) return null;

    // Probability concentration (entropy-based)
    const probs = scoredResults.map(m => m.probability);
    const entropy = -probs.reduce((sum, p) => {
      if (p > 0) return sum + p * Math.log2(p);
      return sum;
    }, 0);
    const maxEntropy = Math.log2(scoredResults.length);
    const uniformity = maxEntropy > 0 ? entropy / maxEntropy : 0;

    // Top probability mass
    const top10Probs = probs.slice(0, 10).reduce((a, b) => a + b, 0);
    
    // Score distribution
    const scores = scoredResults.map(m => m.weighted_score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const scoreVariance = scores.reduce((a, b) => a + (b - avgScore) ** 2, 0) / scores.length;
    const scoreStdDev = Math.sqrt(scoreVariance);

    // Quantum walk effect (probability shift)
    let diffusionShift = 0;
    if (probabilityHistory.length >= 2) {
      const initial = probabilityHistory[0];
      const final = probabilityHistory[probabilityHistory.length - 1];
      diffusionShift = initial.reduce((sum, p, i) => sum + Math.abs(p - (final[i] || 0)), 0) / 2;
    }

    return {
      uniformity,
      top10Concentration: top10Probs,
      avgScore,
      scoreStdDev,
      diffusionShift,
      moleculeCount: scoredResults.length,
    };
  }, [scoredResults, probabilityHistory]);

  if (!metrics || !diversityMetrics) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 mb-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm text-foreground">Chemical Space Metrics</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Diversity Index */}
        <div className="bg-muted/30 rounded-lg p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Layers className="h-3 w-3 text-primary" />
          </div>
          <p className="text-lg font-bold text-foreground">{diversityMetrics.diversityScore.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">Diversity Index <MetricTooltip metric="diversity" /></p>
          <Badge 
            variant="outline" 
            className={`text-[9px] mt-1 ${
              diversityMetrics.diversityLevel === 'High' ? 'border-success/50 text-success' :
              diversityMetrics.diversityLevel === 'Medium' ? 'border-warning/50 text-warning' :
              'border-destructive/50 text-destructive'
            }`}
          >
            {diversityMetrics.diversityLevel}
          </Badge>
        </div>

        {/* Cluster Estimate */}
        <div className="bg-muted/30 rounded-lg p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <GitBranch className="h-3 w-3 text-primary" />
          </div>
          <p className="text-lg font-bold text-foreground">{diversityMetrics.clusterEstimate}</p>
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">Est. Clusters <MetricTooltip metric="clusters" /></p>
        </div>

        {/* Chemical Space Coverage */}
        <div className="bg-muted/30 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-foreground">{(diversityMetrics.chemicalSpaceCoverage * 100).toFixed(0)}%</p>
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">Space Coverage <MetricTooltip metric="coverage" /></p>
          <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${diversityMetrics.chemicalSpaceCoverage * 100}%` }}
            />
          </div>
        </div>

        {/* Probability Uniformity */}
        <div className="bg-muted/30 rounded-lg p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Activity className="h-3 w-3 text-primary" />
          </div>
          <p className="text-lg font-bold text-foreground">{(metrics.uniformity * 100).toFixed(0)}%</p>
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">Prob. Uniformity <MetricTooltip metric="uniformity" /></p>
        </div>

        {/* Quantum Diffusion Effect */}
        <div className="bg-muted/30 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-foreground">
            {diffusionEnabled ? `${(metrics.diffusionShift * 100).toFixed(1)}%` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">QW Shift <MetricTooltip metric="qwShift" /></p>
          {diffusionEnabled && (
            <Badge variant="outline" className="text-[9px] mt-1 border-primary/50 text-primary">
              Active
            </Badge>
          )}
        </div>
      </div>

      {/* Score distribution mini-bar */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Avg Score: <span className="text-foreground font-medium">{metrics.avgScore.toFixed(3)}</span>
          </span>
          <span className="text-muted-foreground">
            σ = <span className="text-foreground font-mono">{metrics.scoreStdDev.toFixed(3)}</span>
          </span>
          <span className="text-muted-foreground">
            Top-10 Mass: <span className="text-foreground font-medium">{(metrics.top10Concentration * 100).toFixed(1)}%</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}
