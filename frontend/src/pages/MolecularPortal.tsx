import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import MoleculeBackground from '@/components/MoleculeBackground';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Zap, Beaker } from 'lucide-react';

export default function MolecularPortal() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [autoTransition, setAutoTransition] = useState(false);

  useEffect(() => {
    // Simulate molecular loading sequence
    const loadingTimer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    // Auto-transition after molecular visualization completes
    const transitionTimer = setTimeout(() => {
      setAutoTransition(true);
    }, 8000);

    return () => {
      clearTimeout(loadingTimer);
      clearTimeout(transitionTimer);
    };
  }, []);

  useEffect(() => {
    if (autoTransition) {
      const navigationTimer = setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
      return () => clearTimeout(navigationTimer);
    }
  }, [autoTransition, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 relative overflow-hidden flex items-center justify-center">
      {/* Animated background molecules */}
      <div className="absolute inset-0 opacity-40">
        <MoleculeBackground />
      </div>

      {/* Content overlay */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          {/* Loading state */}
          {isLoading && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="mb-8"
            >
              <div className="flex justify-center items-center gap-3 mb-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-8 h-8"
                >
                  <Beaker className="w-8 h-8 text-primary" />
                </motion.div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  Initializing Molecular Engine
                </h1>
              </div>
              <p className="text-lg text-muted-foreground">Loading quantum-inspired search parameters...</p>
            </motion.div>
          )}

          {/* Ready state */}
          {!isLoading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="space-y-8"
            >
              <div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.6, type: 'spring' }}
                  className="flex justify-center mb-6"
                >
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                      className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary rounded-full opacity-20 blur-lg"
                    />
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                      className="absolute inset-2 border-2 border-transparent border-t-primary border-r-accent rounded-full"
                    />
                    <Zap className="w-10 h-10 text-primary relative z-10" />
                  </div>
                </motion.div>

                <h2 className="text-5xl font-bold mb-4">
                  <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                    Quantum Engine Ready
                  </span>
                </h2>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
                  Molecular exploration space initialized. Your quantum-inspired search interface is prepared.
                </p>
              </div>

              {/* Molecular stats */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="grid grid-cols-3 gap-4 max-w-2xl mx-auto"
              >
                <div className="bg-card/50 backdrop-blur border border-border/50 rounded-lg p-4">
                  <Badge className="mb-2 bg-primary/20 text-primary">Active</Badge>
                  <div className="text-2xl font-bold">2,304</div>
                  <div className="text-sm text-muted-foreground">Quantum States</div>
                </div>
                <div className="bg-card/50 backdrop-blur border border-border/50 rounded-lg p-4">
                  <Badge className="mb-2 bg-accent/20 text-accent">Live</Badge>
                  <div className="text-2xl font-bold">146</div>
                  <div className="text-sm text-muted-foreground">Search Paths</div>
                </div>
                <div className="bg-card/50 backdrop-blur border border-border/50 rounded-lg p-4">
                  <Badge className="mb-2 bg-green-500/20 text-green-400">Ready</Badge>
                  <div className="text-2xl font-bold">100%</div>
                  <div className="text-sm text-muted-foreground">Calibrated</div>
                </div>
              </motion.div>

              {/* Action buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex gap-4 justify-center pt-4"
              >
                <Button
                  onClick={() => navigate('/dashboard')}
                  size="lg"
                  className="gap-2 px-8"
                >
                  Enter Explorer
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>

              {/* Auto-transition indicator */}
              {autoTransition && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-muted-foreground"
                >
                  Transitioning to Explorer...
                </motion.div>
              )}

              {/* Molecular visualization hints */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-sm text-muted-foreground mt-8"
              >
                <p>✨ Molecule space visualized in real-time above</p>
                <p>🧬 Quantum-inspired algorithm active</p>
                <p>⚡ Ready for drug discovery exploration</p>
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Floating particle effects */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              opacity: 0,
            }}
            animate={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              opacity: [0, 0.5, 0],
            }}
            transition={{
              duration: 8 + Math.random() * 4,
              repeat: Infinity,
              ease: 'linear',
              delay: Math.random() * 2,
            }}
            className="absolute w-1 h-1 bg-primary/30 rounded-full"
          />
        ))}
      </div>
    </div>
  );
}
