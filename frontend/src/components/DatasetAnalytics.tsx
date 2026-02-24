import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Activity, Target, Shield, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useGlobalExploration } from '@/context/GlobalExplorationContext';
import type { Molecule } from '@/lib/moleculeDataset';

interface HistogramBin {
  label: string;
  count: number;
  percentage: number;
}

function computeHistogram(values: number[], binCount: number = 5): HistogramBin[] {
  if (values.length === 0) return [];
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const binSize = range / binCount;
  
  const bins: number[] = Array(binCount).fill(0);
  values.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / binSize), binCount - 1);
    bins[idx]++;
  });
  
  return bins.map((count, i) => ({
    label: `${(min + i * binSize).toFixed(0)}-${(min + (i + 1) * binSize).toFixed(0)}`,
    count,
    percentage: (count / values.length) * 100,
  }));
}

function MiniHistogram({ data, label, color }: { data: HistogramBin[]; label: string; color: string }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-end gap-0.5 h-12">
        {data.map((bin, i) => (
          <div
            key={i}
            className="flex-1 rounded-t transition-all hover:opacity-80"
            style={{
              height: `${(bin.count / maxCount) * 100}%`,
              backgroundColor: color,
              minHeight: bin.count > 0 ? '4px' : '0',
            }}
            title={`${bin.label}: ${bin.count} (${bin.percentage.toFixed(1)}%)`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0]?.label.split('-')[0]}</span>
        <span>{data[data.length - 1]?.label.split('-')[1]}</span>
      </div>
    </div>
  );
}

export default function DatasetAnalytics() {
  const { currentDataset, diversityMetrics } = useGlobalExploration();

  const analytics = useMemo(() => {
    if (!currentDataset.length) return null;

    const mws = currentDataset.map(m => m.molecular_weight);
    const logPs = currentDataset.map(m => m.logP);
    const scores = currentDataset.map(m => m.drug_likeness_score);
    
    const lipinskiPass = currentDataset.filter(m => m.lipinski_compliant === 1).length;
    const lipinskiRate = (lipinskiPass / currentDataset.length) * 100;

    const avgMW = mws.reduce((a, b) => a + b, 0) / mws.length;
    const avgLogP = logPs.reduce((a, b) => a + b, 0) / logPs.length;
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    return {
      mwHistogram: computeHistogram(mws, 6),
      logPHistogram: computeHistogram(logPs, 6),
      scoreHistogram: computeHistogram(scores.map(s => s * 100), 5),
      lipinskiRate,
      lipinskiPass,
      avgMW,
      avgLogP,
      avgScore,
      totalCount: currentDataset.length,
    };
  }, [currentDataset]);

  if (!analytics) {
    return (
      <div className="glass-card p-4 text-center text-sm text-muted-foreground">
        Loading dataset analytics...
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Dataset Intelligence
        </h3>
        <Badge variant="outline" className="text-xs">
          {analytics.totalCount} molecules
        </Badge>
      </div>

      {/* Diversity Score */}
      {diversityMetrics && (
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Dataset Diversity
            </span>
            <Badge 
              variant="outline" 
              className={`text-xs ${
                diversityMetrics.diversityLevel === 'High' ? 'border-success/50 text-success' :
                diversityMetrics.diversityLevel === 'Medium' ? 'border-warning/50 text-warning' :
                'border-destructive/50 text-destructive'
              }`}
            >
              {diversityMetrics.diversityLevel}
            </Badge>
          </div>
          <div className="score-bar mb-2">
            <motion.div 
              className="score-bar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${diversityMetrics.diversityScore * 100}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div>
              <span className="block text-foreground font-medium">{diversityMetrics.clusterEstimate}</span>
              Est. Clusters
            </div>
            <div>
              <span className="block text-foreground font-medium">{(diversityMetrics.chemicalSpaceCoverage * 100).toFixed(0)}%</span>
              Space Coverage
            </div>
            <div>
              <span className="block text-foreground font-medium">{diversityMetrics.diversityScore.toFixed(2)}</span>
              Diversity Index
            </div>
          </div>
        </div>
      )}

      {/* Histograms */}
      <div className="grid grid-cols-3 gap-4">
        <MiniHistogram 
          data={analytics.mwHistogram} 
          label="MW Distribution" 
          color="hsl(186, 100%, 50%)" 
        />
        <MiniHistogram 
          data={analytics.logPHistogram} 
          label="LogP Distribution" 
          color="hsl(260, 60%, 55%)" 
        />
        <MiniHistogram 
          data={analytics.scoreHistogram} 
          label="Drug Score %" 
          color="hsl(45, 93%, 47%)" 
        />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-3">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Activity className="h-3 w-3 text-primary" />
          </div>
          <p className="text-lg font-bold text-foreground">{analytics.avgMW.toFixed(0)}</p>
          <p className="text-[10px] text-muted-foreground">Avg MW</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Target className="h-3 w-3 text-primary" />
          </div>
          <p className="text-lg font-bold text-foreground">{analytics.avgLogP.toFixed(1)}</p>
          <p className="text-[10px] text-muted-foreground">Avg LogP</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <BarChart3 className="h-3 w-3 text-primary" />
          </div>
          <p className="text-lg font-bold text-foreground">{(analytics.avgScore * 100).toFixed(0)}%</p>
          <p className="text-[10px] text-muted-foreground">Avg Score</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Shield className="h-3 w-3 text-success" />
          </div>
          <p className="text-lg font-bold text-success">{analytics.lipinskiRate.toFixed(0)}%</p>
          <p className="text-[10px] text-muted-foreground">Lipinski Pass</p>
        </div>
      </div>
    </motion.div>
  );
}
