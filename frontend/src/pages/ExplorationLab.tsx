import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExplorationProvider, useExploration } from '@/context/ExplorationContext';
import CommandBar from '@/components/exploration/CommandBar';
import GalaxyView from '@/components/exploration/GalaxyView';
import NetworkView from '@/components/exploration/NetworkView';
import RiskRewardMap from '@/components/exploration/RiskRewardMap';
import CompareView from '@/components/exploration/CompareView';
import SplitView from '@/components/exploration/SplitView';
import MoleculeInspector from '@/components/exploration/MoleculeInspector';
import CompareDrawer from '@/components/exploration/CompareDrawer';
import { fetchMoleculeByName } from '@/services/pubchemApi';

// Initial molecules to populate the lab
const INITIAL_MOLECULES = [
  'Aspirin',
  'Ibuprofen',
  'Caffeine',
  'Metformin',
  'Atorvastatin',
];

function ExplorationLabContent() {
  const { visualMode, addMolecule, molecules, isLoading, setLoading } = useExploration();

  // Load initial molecules on mount
  useEffect(() => {
    if (molecules.length === 0) {
      const loadInitialMolecules = async () => {
        setLoading(true);
        for (const name of INITIAL_MOLECULES) {
          try {
            const mol = await fetchMoleculeByName(name);
            if (mol) {
              addMolecule(mol);
            }
          } catch (e) {
            console.warn(`Failed to load ${name}:`, e);
          }
        }
        setLoading(false);
      };
      loadInitialMolecules();
    }
  }, []);

  const renderView = () => {
    switch (visualMode) {
      case 'galaxy':
        return <GalaxyView />;
      case 'network':
        return <NetworkView />;
      case 'risk-reward':
        return <RiskRewardMap />;
      case 'compare':
        return <CompareView />;
      case 'split':
        return <SplitView />;
      default:
        return <GalaxyView />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Command Bar */}
      <CommandBar />

      {/* Main Content */}
      <main className="pt-20 pb-24 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Loading indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-4 bg-primary/10 rounded-lg p-3 text-center"
            >
              <span className="text-primary animate-pulse">Loading molecules from PubChem...</span>
            </motion.div>
          )}

          {/* Title Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex items-center gap-4 mb-2">
              <Link to="/dashboard">
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
              🧪 Exploration Lab
            </h1>
            <p className="text-muted-foreground mt-2">
              Advanced Molecular Exploration Laboratory — powered by PubChem live API and quantum-inspired ranking
            </p>
          </motion.div>

          {/* View Mode Indicators */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm text-muted-foreground">
              Current View: <strong className="text-foreground capitalize">{visualMode}</strong>
            </span>
            <span className="text-sm text-muted-foreground">
              Molecules: <strong className="text-foreground">{molecules.length}/50</strong>
            </span>
          </div>

          {/* Dynamic View Renderer */}
          <motion.div
            key={visualMode}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="relative"
          >
            {renderView()}
          </motion.div>

          {/* Help Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-2">🔍 Search</h3>
              <p className="text-xs text-muted-foreground">
                Type any molecule name in the command bar to fetch live data from PubChem. 
                Click molecules to inspect their properties.
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-2">⚗️ Compare</h3>
              <p className="text-xs text-muted-foreground">
                Add up to 4 molecules to the compare drawer. Use the Compare View mode 
                to see radar charts and property breakdowns.
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-2">🌐 Similarity Expansion</h3>
              <p className="text-xs text-muted-foreground">
                Enable similarity mode to auto-fetch structurally similar molecules. 
                The Network View shows similarity connections.
              </p>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Molecule Inspector Panel */}
      <MoleculeInspector />

      {/* Compare Drawer */}
      <CompareDrawer />
    </div>
  );
}

export default function ExplorationLab() {
  return (
    <ExplorationProvider>
      <ExplorationLabContent />
    </ExplorationProvider>
  );
}
