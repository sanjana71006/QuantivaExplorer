import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Sparkles, Loader2, CheckCircle2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useGlobalExploration } from '@/context/GlobalExplorationContext';
import { useNavigate } from 'react-router-dom';

interface DemoStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
}

const GuidedDemoMode: React.FC = () => {
  const navigate = useNavigate();
  const {
    setDatasetMode,
    setDiffusionEnabled,
    setFilters,
    setWeights,
    selectMolecule,
    scoredResults,
    isLoadingDataset,
  } = useGlobalExploration();

  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<DemoStep[]>([
    { id: 'dataset', label: 'Load benchmark dataset', description: 'Loading 500 molecules for exploration', completed: false },
    { id: 'weights', label: 'Configure optimal weights', description: 'Setting drug-discovery focused weights', completed: false },
    { id: 'diffusion', label: 'Enable quantum diffusion', description: 'Activating probability-based ranking', completed: false },
    { id: 'visualize', label: 'Navigate to visualization', description: 'Opening Galaxy View', completed: false },
    { id: 'highlight', label: 'Highlight top candidates', description: 'Selecting top-ranked molecule', completed: false },
  ]);

  const runDemoSequence = useCallback(async () => {
    setIsRunning(true);
    setCurrentStep(0);

    // Step 1: Load local dataset (demo mode)
    setSteps(prev => prev.map((s, i) => i === 0 ? { ...s, completed: false } : s));
    setDatasetMode('local');
    await new Promise(r => setTimeout(r, 800));
    setSteps(prev => prev.map((s, i) => i === 0 ? { ...s, completed: true } : s));
    setCurrentStep(1);

    // Step 2: Configure weights
    await new Promise(r => setTimeout(r, 500));
    setWeights({
      binding: 0.85,
      toxicity: 0.75,
      solubility: 0.65,
      lipinski: 0.90,
      mw: 0.50,
      logp: 0.55,
    });
    setSteps(prev => prev.map((s, i) => i === 1 ? { ...s, completed: true } : s));
    setCurrentStep(2);

    // Step 3: Enable diffusion
    await new Promise(r => setTimeout(r, 500));
    setDiffusionEnabled(true);
    setFilters({ lipinskiOnly: true, toxicityThreshold: 0.5, sourceFilter: 'All' });
    setSteps(prev => prev.map((s, i) => i === 2 ? { ...s, completed: true } : s));
    setCurrentStep(3);

    // Step 4: Navigate to visualization
    await new Promise(r => setTimeout(r, 600));
    navigate('/visualization');
    setSteps(prev => prev.map((s, i) => i === 3 ? { ...s, completed: true } : s));
    setCurrentStep(4);

    // Step 5: Highlight top candidate
    await new Promise(r => setTimeout(r, 1000));
    // Wait for results to load then select top molecule
    const checkResults = setInterval(() => {
      if (scoredResults.length > 0) {
        clearInterval(checkResults);
        selectMolecule(scoredResults[0]);
        setSteps(prev => prev.map((s, i) => i === 4 ? { ...s, completed: true } : s));
        setCurrentStep(5);
        setIsRunning(false);
      }
    }, 200);

    // Timeout fallback
    setTimeout(() => {
      clearInterval(checkResults);
      setIsRunning(false);
    }, 5000);
  }, [setDatasetMode, setDiffusionEnabled, setFilters, setWeights, selectMolecule, navigate, scoredResults]);

  const handleToggleDemo = (enabled: boolean) => {
    setIsDemoMode(enabled);
    if (enabled) {
      runDemoSequence();
    } else {
      // Reset steps
      setSteps(prev => prev.map(s => ({ ...s, completed: false })));
      setCurrentStep(0);
      setIsRunning(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card border-primary/20 overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold text-foreground text-sm">
              Guided Demo Mode
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isRunning && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-primary flex items-center gap-1"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                Running...
              </motion.span>
            )}
            <Switch
              checked={isDemoMode}
              onCheckedChange={handleToggleDemo}
              disabled={isRunning}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          One-click storytelling for presentations. Automatically configures optimal settings and navigates through key features.
        </p>
      </div>

      <AnimatePresence>
        {isDemoMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border overflow-hidden"
          >
            <div className="p-4 space-y-2">
              {steps.map((step, idx) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    currentStep === idx && isRunning
                      ? 'bg-primary/10'
                      : step.completed
                      ? 'bg-success/5'
                      : 'bg-muted/10'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {step.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : currentStep === idx && isRunning ? (
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-muted-foreground/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${step.completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {step.label}
                    </p>
                    {currentStep === idx && isRunning && (
                      <p className="text-xs text-primary">{step.description}</p>
                    )}
                  </div>
                  {step.completed && (
                    <ChevronRight className="h-4 w-4 text-success flex-shrink-0" />
                  )}
                </motion.div>
              ))}
            </div>

            {!isRunning && steps.every(s => s.completed) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 pt-0"
              >
                <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-center">
                  <p className="text-sm text-success font-medium">Demo complete!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Explore the visualization and inspect top candidates.
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default GuidedDemoMode;
