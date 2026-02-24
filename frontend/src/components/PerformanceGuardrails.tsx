import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Zap, Shield } from 'lucide-react';
import { useGlobalExploration } from '@/context/GlobalExplorationContext';

const PerformanceGuardrails: React.FC = () => {
  const { scoredResults, diffusionEnabled, setDiffusionEnabled } = useGlobalExploration();

  const moleculeCount = scoredResults.length;
  const PERFORMANCE_THRESHOLD = 2000;
  const WARNING_THRESHOLD = 1500;

  // Auto-disable diffusion for large datasets
  useEffect(() => {
    if (moleculeCount > PERFORMANCE_THRESHOLD && diffusionEnabled) {
      setDiffusionEnabled(false);
    }
  }, [moleculeCount, diffusionEnabled, setDiffusionEnabled]);

  // Determine warning state
  const getPerformanceState = () => {
    if (moleculeCount > PERFORMANCE_THRESHOLD) {
      return {
        level: 'critical',
        icon: Shield,
        message: `Large dataset detected (${moleculeCount.toLocaleString()} molecules). Quantum diffusion auto-disabled for performance.`,
        bgColor: 'bg-warning/10',
        borderColor: 'border-warning/30',
        textColor: 'text-warning',
      };
    }

    if (moleculeCount > WARNING_THRESHOLD && diffusionEnabled) {
      return {
        level: 'warning',
        icon: AlertTriangle,
        message: `Dataset size (${moleculeCount.toLocaleString()}) may affect diffusion performance. Consider disabling for faster response.`,
        bgColor: 'bg-primary/10',
        borderColor: 'border-primary/30',
        textColor: 'text-primary',
      };
    }

    return null;
  };

  const state = getPerformanceState();

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className={`rounded-lg border ${state.bgColor} ${state.borderColor} p-3 flex items-start gap-3`}
        >
          <state.icon className={`h-4 w-4 ${state.textColor} mt-0.5 flex-shrink-0`} />
          <div className="flex-1">
            <p className={`text-sm ${state.textColor}`}>{state.message}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Diffusion: {diffusionEnabled ? 'Active' : 'Disabled'}
              </span>
              {state.level === 'critical' && (
                <span className="text-success">Performance mode active</span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PerformanceGuardrails;
