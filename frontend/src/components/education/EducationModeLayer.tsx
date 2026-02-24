import { motion } from 'framer-motion';
import { useGlobalExploration } from '@/context/GlobalExplorationContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Lightbulb } from 'lucide-react';

export default function EducationModeLayer() {
  const { educationMode, diversityMetrics } = useGlobalExploration();

  if (!educationMode.enabled) return null;

  const guidanceMessages: Record<string, string> = {
    detailed: 'Move your mouse over elements for detailed explanations.',
    moderate: 'Key insights are highlighted. Click for more details.',
    minimal: 'Subtle visual cues guide your exploration.',
  };

  return (
    <div className="pointer-events-none space-y-4">
      {/* Top banner: Guidance level indicator */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none"
      >
        <Alert className="border-primary/50 bg-gradient-to-r from-primary/10 to-primary/5 w-96">
          <Lightbulb className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Education Mode Active:</strong> {guidanceMessages[educationMode.guidanceLevel]}
          </AlertDescription>
        </Alert>
      </motion.div>

      {/* Visual probability diffusion indicator */}
      <EducationOverlayHints />

      {/* Contribution factor highlighting */}
      <ContributionFactorTooltips />
    </div>
  );
}

function EducationOverlayHints() {
  const { educationMode, scoredResults, probabilityHistory } = useGlobalExploration();

  if (!educationMode.showStepExplainer || educationMode.currentStep !== 2) {
    return null;
  }

  const topMolecule = scoredResults[0];
  if (!topMolecule) return null;

  return (
    <motion.div
      className="fixed bottom-24 left-6 z-40 pointer-events-auto"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="bg-card border-2 border-primary/30 rounded-lg p-4 w-64 shadow-lg">
        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          Diffusion in Action
        </h4>
        <p className="text-xs text-muted-foreground mb-3">
          Probability spreads from high-scoring molecules (bright) to similar structurally molecules (dimmer).
        </p>

        {/* Gradient visualization */}
        <div className="space-y-2">
          <div className="text-xs font-medium">Probability Distribution:</div>
          <div className="bg-gradient-to-r from-primary via-primary/50 to-transparent h-6 rounded-sm border border-border" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>High</span>
            <span>Medium</span>
            <span>Low</span>
          </div>
        </div>

        <p className="text-xs text-primary mt-3 font-medium">
          💡 This prevents single outliers from dominating the search.
        </p>
      </div>
    </motion.div>
  );
}

function ContributionFactorTooltips() {
  const { educationMode, selectedMolecule, weights } = useGlobalExploration();

  if (!educationMode.enabled || !selectedMolecule || educationMode.guidanceLevel === 'minimal') {
    return null;
  }

  const factors = [
    { name: 'Binding', weight: weights.binding, color: 'text-blue-500' },
    { name: 'Toxicity', weight: weights.toxicity, color: 'text-red-500' },
    { name: 'Solubility', weight: weights.solubility, color: 'text-green-500' },
    { name: 'Lipinski', weight: weights.lipinski, color: 'text-amber-500' },
  ];

  const topFactor = factors.reduce((a, b) => (a.weight > b.weight ? a : b));

  return (
    <motion.div
      className="fixed bottom-24 right-6 z-40 pointer-events-auto"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      <div className="bg-card border-2 border-primary/30 rounded-lg p-4 w-72 shadow-lg">
        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <span className={`w-2 h-2 bg-primary rounded-full animate-pulse`} />
          Contributing Factors
        </h4>

        <div className="space-y-2.5">
          {factors.map((factor) => (
            <motion.div
              key={factor.name}
              className={`relative p-2 rounded border ${
                factor.name === topFactor.name
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border bg-muted/50'
              }`}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium ${factor.color}`}>{factor.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(factor.weight * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className={`h-full bg-gradient-to-r ${
                    factor.name === topFactor.name
                      ? 'from-primary to-primary/50'
                      : 'from-primary/40 to-primary/20'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${factor.weight * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
              </div>

              {factor.name === topFactor.name && (
                <motion.div
                  className="absolute -right-2 -top-2 bg-primary text-white text-xs px-2 py-0.5 rounded-full font-semibold"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  ⭐ Top
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
          ✨ The molecule scores highest on <strong>{topFactor.name}</strong>. This is why it ranks well.
        </p>
      </div>
    </motion.div>
  );
}
