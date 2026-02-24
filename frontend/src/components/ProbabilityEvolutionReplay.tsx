import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Zap, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGlobalExploration } from '@/context/GlobalExplorationContext';
import { quantumWalk } from '@/lib/quantumEngine';

interface DiffusionFrame {
  step: number;
  probabilities: number[];
  entropy: number;
  maxProb: number;
  converged: boolean;
}

const ProbabilityEvolutionReplay: React.FC = () => {
  const { scoredResults, diffusionEnabled } = useGlobalExploration();
  const [frames, setFrames] = useState<DiffusionFrame[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Compute entropy for a probability distribution
  const computeEntropy = (probs: number[]): number => {
    return -probs.reduce((sum, p) => {
      if (p > 0) return sum + p * Math.log2(p);
      return sum;
    }, 0);
  };

  // Generate diffusion frames
  const generateFrames = useCallback(() => {
    if (scoredResults.length === 0) return;

    const subset = scoredResults.slice(0, 50); // Use top 50 for visualization
    const steps = 12;
    const history = quantumWalk(subset, steps);
    
    const newFrames: DiffusionFrame[] = history.map((probs, idx) => {
      const entropy = computeEntropy(probs);
      const maxProb = Math.max(...probs);
      const uniformEntropy = Math.log2(probs.length);
      const converged = entropy < uniformEntropy * 0.6; // Converged when entropy drops significantly

      return {
        step: idx,
        probabilities: probs,
        entropy,
        maxProb,
        converged,
      };
    });

    setFrames(newFrames);
    setCurrentFrame(0);
    setIsGenerated(true);
  }, [scoredResults]);

  // Play/pause animation
  useEffect(() => {
    if (isPlaying && frames.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentFrame((prev) => {
          if (prev >= frames.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 400);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, frames.length]);

  const handlePlay = () => {
    if (!isGenerated) {
      generateFrames();
      setTimeout(() => setIsPlaying(true), 100);
    } else {
      setIsPlaying(true);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentFrame(0);
  };

  const currentData = frames[currentFrame];
  const topMolecules = currentData
    ? currentData.probabilities
        .map((p, i) => ({ idx: i, prob: p, name: scoredResults[i]?.name || `Mol ${i}` }))
        .sort((a, b) => b.prob - a.prob)
        .slice(0, 8)
    : [];

  if (!diffusionEnabled || scoredResults.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="font-display font-semibold text-foreground text-sm">
            Quantum Diffusion Replay
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {!isPlaying ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handlePlay}
              className="border-primary/30 text-primary hover:bg-primary/10"
            >
              <Play className="h-3 w-3 mr-1" />
              {isGenerated ? 'Resume' : 'Replay'}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsPlaying(false)}
              className="border-primary/30 text-primary hover:bg-primary/10"
            >
              <Pause className="h-3 w-3 mr-1" />
              Pause
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {isGenerated && currentData && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Step {currentData.step + 1} of {frames.length}</span>
              <span>{currentData.converged ? '✓ Converged' : 'Diffusing...'}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-cyan-400"
                initial={{ width: 0 }}
                animate={{ width: `${((currentFrame + 1) / frames.length) * 100}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 bg-muted/20 rounded-lg">
              <p className="text-xs text-muted-foreground">Entropy</p>
              <p className="font-mono text-sm text-foreground">
                {currentData.entropy.toFixed(2)}
              </p>
            </div>
            <div className="text-center p-2 bg-muted/20 rounded-lg">
              <p className="text-xs text-muted-foreground">Max Prob</p>
              <p className="font-mono text-sm text-primary">
                {(currentData.maxProb * 100).toFixed(1)}%
              </p>
            </div>
            <div className="text-center p-2 bg-muted/20 rounded-lg">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className={`text-sm font-medium ${currentData.converged ? 'text-success' : 'text-warning'}`}>
                {currentData.converged ? 'Stable' : 'Active'}
              </p>
            </div>
          </div>

          {/* Probability distribution visualization */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Top probability concentrations:</p>
            <div className="space-y-1">
              {topMolecules.map((mol, idx) => (
                <motion.div
                  key={mol.idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2"
                >
                  <span className="text-xs text-muted-foreground w-20 truncate">
                    {mol.name}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, hsl(${186 - idx * 15}, 100%, 50%), hsl(${186 - idx * 15}, 80%, 40%))`,
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${mol.prob * 100 * 10}%` }} // Scale for visibility
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span className="text-xs font-mono text-foreground w-12 text-right">
                    {(mol.prob * 100).toFixed(1)}%
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Animation indicator */}
          <AnimatePresence>
            {isPlaying && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center gap-2 text-xs text-primary"
              >
                <Activity className="h-3 w-3 animate-pulse" />
                <span>Quantum walk in progress...</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {!isGenerated && (
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm">Click "Replay" to visualize quantum diffusion</p>
          <p className="text-xs mt-1">Watch probability flow from uniform to converged distribution</p>
        </div>
      )}
    </motion.div>
  );
};

export default ProbabilityEvolutionReplay;
