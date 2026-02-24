import React, { useMemo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { useGlobalExploration } from '@/context/GlobalExplorationContext';
import { Badge } from '@/components/ui/badge';

interface RankChange {
  molecule_id: string;
  name: string;
  previousRank: number;
  currentRank: number;
  previousScore: number;
  currentScore: number;
  rankDelta: number;
  scoreDelta: number;
}

const SensitivityAnalysisPanel: React.FC = () => {
  const { scoredResults, weights } = useGlobalExploration();
  const [isExpanded, setIsExpanded] = useState(true);
  const [rankChanges, setRankChanges] = useState<RankChange[]>([]);
  
  // Store previous results for comparison
  const previousResultsRef = useRef<Map<string, { rank: number; score: number }>>(new Map());
  const isFirstRenderRef = useRef(true);

  // Track weight changes and compute rank shifts
  useEffect(() => {
    if (scoredResults.length === 0) return;

    const currentMap = new Map<string, { rank: number; score: number }>();
    scoredResults.forEach((mol, idx) => {
      currentMap.set(mol.molecule_id, { rank: idx + 1, score: mol.weighted_score });
    });

    // Skip first render (no previous to compare)
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      previousResultsRef.current = currentMap;
      return;
    }

    const previousMap = previousResultsRef.current;
    const changes: RankChange[] = [];

    scoredResults.forEach((mol, idx) => {
      const currentRank = idx + 1;
      const currentScore = mol.weighted_score;
      const previous = previousMap.get(mol.molecule_id);
      
      if (previous) {
        const rankDelta = previous.rank - currentRank; // positive = moved up
        const scoreDelta = currentScore - previous.score;
        
        if (Math.abs(rankDelta) > 0) {
          changes.push({
            molecule_id: mol.molecule_id,
            name: mol.name,
            previousRank: previous.rank,
            currentRank,
            previousScore: previous.score,
            currentScore,
            rankDelta,
            scoreDelta,
          });
        }
      }
    });

    // Sort by absolute rank change, take top 5
    changes.sort((a, b) => Math.abs(b.rankDelta) - Math.abs(a.rankDelta));
    setRankChanges(changes.slice(0, 5));

    // Update previous for next comparison
    previousResultsRef.current = currentMap;
  }, [scoredResults, weights]);

  if (rankChanges.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card border-primary/20"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="font-display font-semibold text-foreground text-sm">
            Sensitivity Analysis
          </span>
          <Badge variant="outline" className="border-primary/30 text-primary text-xs">
            {rankChanges.length} molecules shifted
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                Top molecules affected by weight changes:
              </p>
              {rankChanges.map((change, idx) => (
                <motion.div
                  key={change.molecule_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      {change.rankDelta > 0 ? (
                        <TrendingUp className="h-4 w-4 text-success" />
                      ) : change.rankDelta < 0 ? (
                        <TrendingDown className="h-4 w-4 text-destructive" />
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground truncate max-w-[150px]">
                        {change.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Rank: {change.previousRank} → {change.currentRank}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-sm font-mono font-bold ${
                        change.rankDelta > 0 ? 'text-success' : 
                        change.rankDelta < 0 ? 'text-destructive' : 
                        'text-muted-foreground'
                      }`}>
                        {change.rankDelta > 0 ? '+' : ''}{change.rankDelta}
                      </p>
                      <p className="text-xs text-muted-foreground">rank shift</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-mono ${
                        change.scoreDelta > 0 ? 'text-success' : 
                        change.scoreDelta < 0 ? 'text-destructive' : 
                        'text-muted-foreground'
                      }`}>
                        {change.scoreDelta > 0 ? '+' : ''}{change.scoreDelta.toFixed(3)}
                      </p>
                      <p className="text-xs text-muted-foreground">Δ score</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SensitivityAnalysisPanel;
