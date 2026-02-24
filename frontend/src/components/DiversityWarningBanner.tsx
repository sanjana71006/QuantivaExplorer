import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, TrendingDown } from 'lucide-react';
import { useGlobalExploration } from '@/context/GlobalExplorationContext';

const DiversityWarningBanner: React.FC = () => {
  const { diversityMetrics, scoredResults } = useGlobalExploration();

  // Determine warning level
  const getWarningLevel = () => {
    if (!diversityMetrics || scoredResults.length < 10) return null;

    const { diversityScore, clusterEstimate } = diversityMetrics;
    
    // Low diversity: score < 0.3 or very few clusters relative to size
    if (diversityScore < 0.25) {
      return {
        level: 'critical',
        message: 'Very low chemical diversity detected. Rankings may be heavily biased toward similar structures.',
        icon: AlertTriangle,
        bgColor: 'bg-destructive/10',
        borderColor: 'border-destructive/30',
        textColor: 'text-destructive',
      };
    }

    if (diversityScore < 0.4) {
      return {
        level: 'warning',
        message: 'Low chemical diversity may affect ranking accuracy. Consider expanding your dataset.',
        icon: AlertTriangle,
        bgColor: 'bg-warning/10',
        borderColor: 'border-warning/30',
        textColor: 'text-warning',
      };
    }

    // Check cluster ratio
    const expectedClusters = Math.sqrt(scoredResults.length);
    if (clusterEstimate < expectedClusters * 0.3) {
      return {
        level: 'info',
        message: 'Dataset shows clustering tendency. Chemical space coverage may be limited.',
        icon: Info,
        bgColor: 'bg-primary/10',
        borderColor: 'border-primary/30',
        textColor: 'text-primary',
      };
    }

    return null;
  };

  const warning = getWarningLevel();

  return (
    <AnimatePresence>
      {warning && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className={`rounded-lg border ${warning.bgColor} ${warning.borderColor} p-3 flex items-start gap-3`}
        >
          <warning.icon className={`h-4 w-4 ${warning.textColor} mt-0.5 flex-shrink-0`} />
          <div className="flex-1">
            <p className={`text-sm ${warning.textColor}`}>{warning.message}</p>
            {diversityMetrics && (
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>Diversity Index: {(diversityMetrics.diversityScore * 100).toFixed(0)}%</span>
                <span>Clusters: ~{diversityMetrics.clusterEstimate}</span>
                <span>Coverage: {(diversityMetrics.chemicalSpaceCoverage * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DiversityWarningBanner;
