import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useExploration } from '@/context/ExplorationContext';
import { getMoleculeImageUrl } from '@/services/pubchemApi';

export default function CompareDrawer() {
  const {
    comparedMolecules,
    compareDrawerOpen,
    toggleCompareDrawer,
    removeFromCompare,
    clearCompare,
    selectMolecule,
    openInspector,
    setVisualMode,
  } = useExploration();

  const handleViewInspector = (mol: any) => {
    selectMolecule(mol);
    openInspector();
  };

  const handleOpenCompareView = () => {
    if (comparedMolecules.length >= 2) {
      setVisualMode('compare');
    }
  };

  if (comparedMolecules.length === 0) {
    return null;
  }

  return (
    <>
      {/* Collapsed bar - always visible when there are compared molecules */}
      <AnimatePresence>
        {!compareDrawerOpen && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-40"
          >
            <div className="container mx-auto px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{comparedMolecules.length} molecules</Badge>
                <div className="flex -space-x-2">
                  {comparedMolecules.slice(0, 4).map((mol, i) => (
                    <div
                      key={mol.id}
                      className="h-8 w-8 rounded-full bg-white border-2 border-card overflow-hidden"
                      style={{ zIndex: 4 - i }}
                    >
                      <img
                        src={getMoleculeImageUrl(mol.cid)}
                        alt={mol.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenCompareView}
                  disabled={comparedMolecules.length < 2}
                >
                  Compare View
                </Button>
                <Button variant="ghost" size="icon" onClick={toggleCompareDrawer}>
                  <ChevronUp className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded drawer */}
      <AnimatePresence>
        {compareDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={toggleCompareDrawer}
              className="fixed inset-0 bg-background/80 z-40"
            />

            {/* Drawer */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-2xl z-50 rounded-t-xl max-h-[60vh] overflow-hidden"
            >
              {/* Header */}
              <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">Compare Molecules</h3>
                  <Badge variant="secondary">{comparedMolecules.length}/4</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={clearCompare}
                    className="text-xs"
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Clear All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenCompareView}
                    disabled={comparedMolecules.length < 2}
                  >
                    Full Compare View
                  </Button>
                  <Button variant="ghost" size="icon" onClick={toggleCompareDrawer}>
                    <ChevronDown className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Molecules grid */}
              <div className="p-4 overflow-y-auto max-h-[calc(60vh-56px)]">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {comparedMolecules.map((mol) => (
                    <motion.div
                      key={mol.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-muted/50 rounded-lg p-3 relative group"
                    >
                      {/* Remove button */}
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        onClick={() => removeFromCompare(mol.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>

                      {/* Image */}
                      <div
                        className="bg-white rounded-lg p-1 mb-2 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                        onClick={() => handleViewInspector(mol)}
                      >
                        <img
                          src={getMoleculeImageUrl(mol.cid)}
                          alt={mol.name}
                          className="w-full h-24 object-contain"
                        />
                      </div>

                      {/* Info */}
                      <h4 className="font-medium text-sm truncate">{mol.name}</h4>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          MW: {mol.molecular_weight.toFixed(0)}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {(mol.probability * 100).toFixed(0)}%
                        </Badge>
                      </div>

                      {/* Quick stats */}
                      <div className="mt-2 grid grid-cols-2 gap-1 text-[10px]">
                        <div className="text-muted-foreground">Drug-like:</div>
                        <div className="text-right">{(mol.drug_likeness * 100).toFixed(0)}%</div>
                        <div className="text-muted-foreground">Toxicity:</div>
                        <div className="text-right">{(mol.toxicity * 100).toFixed(0)}%</div>
                        <div className="text-muted-foreground">Efficacy:</div>
                        <div className="text-right">{(mol.efficacy * 100).toFixed(0)}%</div>
                      </div>
                    </motion.div>
                  ))}

                  {/* Empty slots */}
                  {Array.from({ length: 4 - comparedMolecules.length }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="border-2 border-dashed border-muted rounded-lg p-3 flex items-center justify-center min-h-[180px]"
                    >
                      <span className="text-muted-foreground text-xs">Empty slot</span>
                    </div>
                  ))}
                </div>

                {comparedMolecules.length >= 2 && (
                  <div className="mt-4 p-3 bg-primary/10 rounded-lg">
                    <h4 className="text-sm font-medium mb-2">Quick Comparison</h4>
                    <div className="grid grid-cols-5 gap-2 text-xs">
                      <div className="font-medium">Name</div>
                      <div className="font-medium text-center">MW</div>
                      <div className="font-medium text-center">LogP</div>
                      <div className="font-medium text-center">Drug-like</div>
                      <div className="font-medium text-center">Prob</div>
                      {comparedMolecules.map((mol) => (
                        <React.Fragment key={mol.id}>
                          <div className="truncate">{mol.name}</div>
                          <div className="text-center">{mol.molecular_weight.toFixed(0)}</div>
                          <div className="text-center">{mol.logP.toFixed(1)}</div>
                          <div className="text-center">{(mol.drug_likeness * 100).toFixed(0)}%</div>
                          <div className="text-center text-primary">{(mol.probability * 100).toFixed(0)}%</div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
