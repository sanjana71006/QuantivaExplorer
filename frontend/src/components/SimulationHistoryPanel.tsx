import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, ChevronDown, ChevronUp, RotateCcw, Clock, Zap, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGlobalExploration, SimulationMetadata } from '@/context/GlobalExplorationContext';

export default function SimulationHistoryPanel() {
  const { simulationHistory, restoreSimulation, simulationMetadata } = useGlobalExploration();
  const [isExpanded, setIsExpanded] = useState(false);

  if (simulationHistory.length === 0) return null;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatWeights = (weights: SimulationMetadata['weights']) => {
    return Object.entries(weights)
      .map(([k, v]) => `${k.charAt(0).toUpperCase()}:${(v * 100).toFixed(0)}%`)
      .join(' ');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <History className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-foreground text-sm">Simulation History</h3>
            <p className="text-xs text-muted-foreground">{simulationHistory.length} previous run{simulationHistory.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border"
          >
            <div className="p-4 space-y-3">
              {simulationHistory.map((sim, index) => (
                <motion.div
                  key={sim.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-muted/30 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Run #{simulationHistory.length - index}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(sim.timestamp)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => restoreSimulation(sim.id)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Restore
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Zap className="h-3 w-3" />
                      <span>{sim.algorithm}</span>
                      {sim.diffusionEnabled && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">QW</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Filter className="h-3 w-3" />
                      <span>{sim.moleculeCount} molecules</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs">
                      <span className="text-muted-foreground">Top: </span>
                      <span className="text-foreground font-medium">{sim.topMolecule || 'N/A'}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Score: </span>
                      <span className="text-primary font-mono">{sim.topScore.toFixed(3)}</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-muted-foreground font-mono truncate">
                    {formatWeights(sim.weights)}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
