import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, Zap, Database, TrendingUp, Sparkles, X } from 'lucide-react';
import { useGlobalExploration } from '@/context/GlobalExplorationContext';

interface ScoringStep {
  step: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  details: string[];
  formula?: string;
  example?: string;
}

export default function SimulationStepExplainer() {
  const { educationMode, setEducationMode, scoredResults, weights } = useGlobalExploration();
  const [autoPlay, setAutoPlay] = useState(true);

  if (!educationMode.enabled || !educationMode.showStepExplainer) {
    return null;
  }

  const topMolecule = scoredResults[0];

  const steps: ScoringStep[] = [
    {
      step: 1,
      title: 'Weighted Sum',
      description: 'Calculate weighted sum of all scoring factors',
      icon: <Database className="w-5 h-5" />,
      details: [
        `Binding (${(weights.binding * 100).toFixed(0)}%): Affinity to target`,
        `Toxicity (${(weights.toxicity * 100).toFixed(0)}%): Safety risk assessment`,
        `Solubility (${(weights.solubility * 100).toFixed(0)}%): Bioavailability`,
        `Lipinski (${(weights.lipinski * 100).toFixed(0)}%): Drug-likeness rules`,
        `MW (${(weights.mw * 100).toFixed(0)}%): Molecular weight compliance`,
        `LogP (${(weights.logp * 100).toFixed(0)}%): Hydrophobicity balance`,
      ],
      formula: 'score = Σ(weight_i × factor_i)',
      example: `Top molecule: ${topMolecule?.name || 'N/A'}`,
    },
    {
      step: 2,
      title: 'Softmax Normalization',
      description: 'Convert raw scores to probabilities (0-1)',
      icon: <TrendingUp className="w-5 h-5" />,
      details: [
        'Softmax function ensures scores sum to 1.0',
        'Higher scoring molecules get higher probability',
        'Enables fair comparison across different scales',
        'Prevents single dominant factor',
      ],
      formula: 'P(i) = e^score_i / Σ(e^score_j)',
      example: `Top molecule probability: ${topMolecule ? (topMolecule.probability * 100).toFixed(1) : 0}%`,
    },
    {
      step: 3,
      title: 'Quantum Diffusion',
      description: 'Spread probability across similar molecules',
      icon: <Sparkles className="w-5 h-5" />,
      details: [
        'Probability redistributes based on molecular similarity',
        'Similar molecules receive probability from top candidate',
        'Models biological uncertainty and flexibility',
        'Creates smooth probability landscape',
      ],
      formula: 'P_diffused(i) = P(i) + α × Σ(similarity(i,j) × P(j))',
      example: 'Neighboring molecules in chemical space benefit from high-scoring neighbors',
    },
    {
      step: 4,
      title: 'Final Ranking',
      description: 'Rank molecules by final probability scores',
      icon: <Zap className="w-5 h-5" />,
      details: [
        `Total molecules evaluated: ${scoredResults.length}`,
        `Top 3 ranked candidates visible in visualization`,
        `Selection can guide further experimental validation`,
        `Scores are reproducible and explainable`,
      ],
      formula: 'Rank: sort(P_final) in descending order',
      example: `Diversity score: ${scoredResults.length > 0 ? 'High' : 'Medium'}`,
    },
  ];

  const currentStep = steps[educationMode.currentStep] || steps[0];
  const animationSpeed = educationMode.animationSpeed === 'slow' ? 0.1 : educationMode.animationSpeed === 'fast' ? 0.04 : 0.06;

  useEffect(() => {
    if (!autoPlay) return;

    const interval = setInterval(() => {
      setEducationMode({
        currentStep: (educationMode.currentStep + 1) % steps.length,
      });
    }, 4000); // 4 seconds per step

    return () => clearInterval(interval);
  }, [autoPlay, educationMode.currentStep, steps.length, setEducationMode]);

  const handleClose = () => {
    setEducationMode({ showStepExplainer: false });
  };

  const handleNextStep = () => {
    setEducationMode({
      currentStep: (educationMode.currentStep + 1) % steps.length,
    });
  };

  const handlePrevStep = () => {
    setEducationMode({
      currentStep: (educationMode.currentStep - 1 + steps.length) % steps.length,
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-4 right-4 w-96 z-50"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-background via-background to-primary/5 shadow-2xl">
          <CardHeader className="pb-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <motion.div
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                >
                  {currentStep.icon}
                </motion.div>
                <CardTitle className="text-lg">{currentStep.title}</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-6 w-6"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardDescription className="text-sm">{currentStep.description}</CardDescription>
            <div className="flex gap-1 pt-1">
              {steps.map((_, idx) => (
                <motion.div
                  key={idx}
                  className={`h-1 flex-1 rounded-full ${
                    idx === educationMode.currentStep
                      ? 'bg-primary'
                      : idx < educationMode.currentStep
                      ? 'bg-primary/50'
                      : 'bg-muted'
                  }`}
                  layoutId={`progress-${idx}`}
                  transition={{ duration: 0.3 }}
                />
              ))}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Details */}
            <motion.div
              key={`details-${educationMode.currentStep}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-2"
            >
              {currentStep.details.map((detail, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * animationSpeed }}
                  className="flex items-start gap-2 text-sm"
                >
                  <div className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0" />
                  <span className="text-muted-foreground">{detail}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* Formula */}
            {currentStep.formula && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-muted/50 p-2 rounded border border-border text-xs font-mono text-center text-primary"
              >
                {currentStep.formula}
              </motion.div>
            )}

            {/* Example */}
            {currentStep.example && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-2 text-xs p-2 bg-primary/5 rounded border border-primary/20"
              >
                <Sparkles className="w-3 h-3 text-primary flex-shrink-0" />
                <span className="text-foreground">{currentStep.example}</span>
              </motion.div>
            )}

            {/* Controls */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-2 pt-2"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevStep}
                className="text-xs"
              >
                ← Previous
              </Button>
              <Button
                variant={autoPlay ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAutoPlay(!autoPlay)}
                className="text-xs flex-1"
              >
                {autoPlay ? '⏸ Pause' : '▶ Play'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextStep}
                className="text-xs"
              >
                Next <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </motion.div>

            {/* Step indicator */}
            <div className="text-xs text-muted-foreground text-center">
              Step {educationMode.currentStep + 1} of {steps.length}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
