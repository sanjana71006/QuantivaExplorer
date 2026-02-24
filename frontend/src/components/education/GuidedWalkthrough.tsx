import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Play, X, Volume2, VolumeX } from 'lucide-react';
import { useGlobalExploration } from '@/context/GlobalExplorationContext';

interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  action: string;
  target?: string;
  highlightArea?: 'molecule-inspector' | '3d-universe' | 'heatmap' | 'metrics';
}

export default function GuidedWalkthrough() {
  const { educationMode, setEducationMode, selectedMolecule, scoredResults } = useGlobalExploration();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [narrationEnabled, setNarrationEnabled] = useState(true);

  const steps: WalkthroughStep[] = [
    {
      id: 'intro',
      title: 'Welcome to Quantiva Explorer',
      description: 'This guided tour will show you how to explore drug candidates intelligently.',
      action: 'Click next to begin exploring',
      highlightArea: undefined,
    },
    {
      id: 'weights',
      title: 'Understand Scoring Weights',
      description: 'Each property has a weight in the scoring algorithm. Higher weights = more importance.',
      action: 'Hover over weight sliders to see their current values',
      highlightArea: 'metrics',
    },
    {
      id: 'select',
      title: 'Select a Molecule',
      description: 'Click on any molecule in the 3D space to inspect it in detail.',
      action: 'The right panel shows molecular properties and Lipinski compliance',
      highlightArea: '3d-universe',
    },
    {
      id: 'ranking',
      title: 'Understand the Rankings',
      description: 'Molecules are ranked by their weighted score. Top scores appear first.',
      action: 'Look at the probability values - they represent the likelihood of being the best candidate',
      highlightArea: 'heatmap',
    },
    {
      id: 'diffusion',
      title: 'Quantum Diffusion Effect',
      description: 'When enabled, probability spreads to chemically similar molecules.',
      action: 'This models biological flexibility and reduces overfitting',
      highlightArea: '3d-universe',
    },
    {
      id: 'filters',
      title: 'Apply Filters',
      description: 'Narrow results by Lipinski compliance, toxicity, or data source.',
      action: 'Filtered results automatically update the entire visualization',
      highlightArea: undefined,
    },
    {
      id: 'disease',
      title: 'Disease-Aware Scoring',
      description: 'Adjust weights for specific disease categories (cancer, CNS, infectious, etc.)',
      action: 'Different diseases need different molecular properties',
      highlightArea: undefined,
    },
    {
      id: 'compare',
      title: 'Compare Molecules',
      description: 'Add up to 4 molecules to a comparison view for side-by-side analysis.',
      action: 'Use the compare feature to make data-driven decisions',
      highlightArea: 'molecule-inspector',
    },
    {
      id: 'export',
      title: 'Export Scientific Report',
      description: 'Generate a detailed PDF report of your findings and methodology.',
      action: 'Include molecular structures, scores, and explanations',
      highlightArea: undefined,
    },
    {
      id: 'finish',
      title: 'You\'re All Set!',
      description: 'You now understand the core features of Quantiva Explorer.',
      action: 'Use Education Mode\'s Scoring Walkthrough to dive deeper into algorithms',
      highlightArea: undefined,
    },
  ];

  useEffect(() => {
    if (narrationEnabled && isActive) {
      speak(steps[currentStep].description);
    }
  }, [currentStep, narrationEnabled, isActive]);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleStart = () => {
    setIsActive(true);
    setCurrentStep(0);
    setEducationMode({ enabled: true });
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    setIsActive(false);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  if (!isActive) {
    return (
      <motion.button
        onClick={handleStart}
        className="fixed bottom-6 left-6 p-3 rounded-full bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all z-40"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="Start guided tour"
      >
        <Play className="w-5 h-5" />
      </motion.button>
    );
  }

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40 pointer-events-auto" />

        {/* Modal */}
        <motion.div
          className="relative pointer-events-auto"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <Card className="w-96 bg-gradient-to-br from-background to-primary/5 border-2 border-primary/30 shadow-2xl">
            <CardHeader className="pb-3 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">{step.title}</CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleFinish}
                  className="h-6 w-6 -m-2"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Progress bar */}
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/50"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Action card */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 bg-primary/10 border border-primary/20 rounded-lg"
              >
                <p className="text-sm font-medium text-foreground">{step.action}</p>
              </motion.div>

              {/* Step indicator */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">
                  Step {currentStep + 1} of {steps.length}
                </span>
                <div className="flex gap-1">
                  {steps.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1.5 w-1.5 rounded-full transition-colors ${
                        idx <= currentStep ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Controls */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                  className="text-xs flex-1"
                >
                  ← Back
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setNarrationEnabled(!narrationEnabled)}
                  className="h-9 w-9"
                  title={narrationEnabled ? 'Disable narration' : 'Enable narration'}
                >
                  {narrationEnabled ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleNext}
                  className="text-xs flex-1 gap-1"
                >
                  {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                  {currentStep < steps.length - 1 && (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </Button>
              </div>

              {/* Help text */}
              <p className="text-xs text-muted-foreground text-center border-t pt-2">
                You can skip this anytime by closing the guide
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
